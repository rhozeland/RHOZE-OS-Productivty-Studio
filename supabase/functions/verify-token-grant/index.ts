/**
 * verify-token-grant — Pillar 2.
 *
 * Verifies that the caller (signed-in user) owns a Solana wallet that holds
 * the creator's pump.fun token, then upserts a 24h grant in
 * creator_token_grants. The works/storage RLS policies read this grant via
 * holds_creator_token() to unlock the creator's private feed.
 *
 * Body (Zod-validated):
 *   { action: "challenge", creatorId, walletAddress }
 *     → stores a one-time challenge (user, wallet, creator, nonce, 5min
 *       expiry) and returns { challengeId, message, expiresAt }.
 *   { action: "grant", challengeId, walletAddress, signature (base58) }
 *     → atomically consumes the challenge, then verifies the signature over
 *       the stored message. A challenge gets exactly one attempt.
 *
 * - walletAddress must be the caller's linked wallet (profiles.wallet_address,
 *   set only after a signed ownership proof).
 * - After verifying the signature we call Solana JSON-RPC
 *   getTokenAccountsByOwner({owner: walletAddress, mint: creator.token_mint})
 *   and sum uiAmount across accounts. Any non-zero balance grants access.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { getSolanaConfig } from "../_shared/solana-config.ts";
import { isValidWalletSignature } from "../_shared/wallet-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const WalletAddress = z.string().min(32).max(48);

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("challenge"),
    creatorId: z.string().uuid(),
    walletAddress: WalletAddress,
  }),
  z.object({
    action: z.literal("grant"),
    challengeId: z.string().uuid(),
    walletAddress: WalletAddress,
    signature: z.string().min(64).max(128),
  }),
]);

const GRANT_TTL_HOURS = 24;
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_GRANT_PURPOSE = "rhoze-token-grant";
// Raised by the limit_open_wallet_verification_challenges trigger.
const CHALLENGE_LIMIT_ERROR = "wallet_verification_challenge_limit";

const buildChallengeMessage = (p: {
  userId: string;
  creatorId: string;
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}) =>
  [
    "Rhozeland wants you to confirm you hold this creator's token.",
    "",
    "Signing unlocks their token-gated posts on your Rhozeland account. It is free and does not send a transaction.",
    "",
    `Purpose: ${TOKEN_GRANT_PURPOSE}`,
    `Creator ID: ${p.creatorId}`,
    `Wallet: ${p.walletAddress}`,
    `User ID: ${p.userId}`,
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt}`,
    `Expiration Time: ${p.expiresAt}`,
  ].join("\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  // ── Auth: caller must be signed in.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "missing auth" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "invalid auth" });
  const userId = userData.user.id;

  // ── Validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid json" });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: "invalid body", details: parsed.error.flatten() });
  }
  const { walletAddress } = parsed.data;

  // ── Wallet must be the one verified and linked to this account.
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("wallet_address")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr) return json(500, { error: profileErr.message });
  if (!profile?.wallet_address) {
    return json(403, {
      error: "Verify a wallet in the Wallet menu before unlocking with a token.",
      code: "wallet_not_verified",
    });
  }
  if (profile.wallet_address !== walletAddress) {
    return json(403, {
      error: "Connect the wallet verified on your account to unlock with a token.",
      code: "wallet_not_linked",
    });
  }

  const nowIso = new Date().toISOString();

  if (parsed.data.action === "challenge") {
    const { creatorId } = parsed.data;

    const { error: cleanupErr } = await admin
      .from("wallet_verification_challenges")
      .delete()
      .eq("user_id", userId)
      .is("consumed_at", null)
      .lte("expires_at", nowIso);
    if (cleanupErr) return json(500, { error: cleanupErr.message });

    const nonce = crypto.randomUUID().replaceAll("-", "");
    const challengeExpiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
    const message = buildChallengeMessage({
      userId,
      creatorId,
      walletAddress,
      nonce,
      issuedAt: nowIso,
      expiresAt: challengeExpiresAt,
    });

    const { data: row, error: insertErr } = await admin
      .from("wallet_verification_challenges")
      .insert({
        user_id: userId,
        wallet_address: walletAddress,
        purpose: TOKEN_GRANT_PURPOSE,
        creator_id: creatorId,
        nonce,
        message,
        issued_at: nowIso,
        expires_at: challengeExpiresAt,
      })
      .select("id")
      .single();
    if (insertErr?.message?.includes(CHALLENGE_LIMIT_ERROR)) {
      return json(429, {
        error: "Too many pending requests. Wait a few minutes and try again.",
        code: "too_many_requests",
      });
    }
    if (insertErr) return json(500, { error: insertErr.message });

    return json(200, { challengeId: row.id, message, expiresAt: challengeExpiresAt });
  }

  // ── Consume the challenge atomically: only one request can ever match.
  const { challengeId, signature } = parsed.data;
  const { data: challenge, error: consumeErr } = await admin
    .from("wallet_verification_challenges")
    .update({ consumed_at: nowIso })
    .eq("id", challengeId)
    .eq("user_id", userId)
    .eq("wallet_address", walletAddress)
    .eq("purpose", TOKEN_GRANT_PURPOSE)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("message, creator_id")
    .maybeSingle();
  if (consumeErr) return json(500, { error: consumeErr.message });
  if (!challenge) {
    return json(400, {
      error: "This unlock request is invalid, expired, or already used. Please try again.",
      code: "invalid_challenge",
    });
  }
  const creatorId: string = challenge.creator_id;

  // ── Proves the caller controls the linked wallet right now.
  if (!isValidWalletSignature(challenge.message, signature, walletAddress)) {
    return json(401, { error: "signature does not match wallet" });
  }

  // ── Look up creator's approved token mint.
  const { data: creator, error: creatorErr } = await admin
    .from("profiles")
    .select("token_mint_address, token_ticker, token_submission_status")
    .eq("id", creatorId)
    .maybeSingle();
  if (creatorErr) return json(500, { error: creatorErr.message });
  if (!creator?.token_mint_address) {
    return json(404, { error: "creator has not linked a token" });
  }
  if (creator.token_submission_status && creator.token_submission_status !== "approved") {
    return json(403, { error: "creator's token is not yet approved" });
  }

  // ── Query Solana RPC for SPL balance.
  let uiBalance = 0;
  try {
    const rpcRes = await fetch(getSolanaConfig().rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: creator.token_mint_address },
          { encoding: "jsonParsed" },
        ],
      }),
    });
    if (!rpcRes.ok) throw new Error(`rpc http ${rpcRes.status}`);
    const rpcJson = await rpcRes.json();
    if (rpcJson.error) throw new Error(rpcJson.error.message || "rpc error");
    const accounts = rpcJson?.result?.value ?? [];
    for (const acct of accounts) {
      const amt = acct?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof amt === "number") uiBalance += amt;
    }
  } catch (e) {
    return json(502, { error: `solana rpc failed: ${(e as Error).message}` });
  }

  if (uiBalance <= 0) {
    return json(200, { granted: false, balance: 0, reason: "wallet does not hold this token" });
  }

  // ── Upsert grant (24h TTL).
  const expiresAt = new Date(Date.now() + GRANT_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { error: upsertErr } = await admin
    .from("creator_token_grants")
    .upsert(
      {
        user_id: userId,
        creator_id: creatorId,
        wallet_address: walletAddress,
        mint_address: creator.token_mint_address,
        balance: uiBalance,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,creator_id" },
    );
  if (upsertErr) return json(500, { error: upsertErr.message });

  return json(200, {
    granted: true,
    balance: uiBalance,
    ticker: creator.token_ticker,
    expiresAt,
  });
});
