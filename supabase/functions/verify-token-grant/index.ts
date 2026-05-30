/**
 * verify-token-grant — Pillar 2.
 *
 * Verifies that the caller (signed-in user) owns a Solana wallet that holds
 * the creator's pump.fun token, then upserts a 24h grant in
 * creator_token_grants. The works/storage RLS policies read this grant via
 * holds_creator_token() to unlock the creator's private feed.
 *
 * Body (Zod-validated):
 *   { creatorId, walletAddress, signature (base58), message }
 *
 * - message must contain creatorId and a fresh ISO timestamp (< 5min old).
 * - signature is the wallet's signMessage() output over `message`.
 * - We verify with tweetnacl, then call Solana JSON-RPC
 *   getTokenAccountsByOwner({owner: walletAddress, mint: creator.token_mint})
 *   and sum uiAmount across accounts. Any non-zero balance grants access.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import bs58 from "https://esm.sh/bs58@5.0.0";

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

const BodySchema = z.object({
  creatorId: z.string().uuid(),
  walletAddress: z.string().min(32).max(48),
  signature: z.string().min(64),
  message: z.string().min(10).max(500),
});

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const GRANT_TTL_HOURS = 24;
const MESSAGE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

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
  const { creatorId, walletAddress, signature, message } = parsed.data;

  // ── Message freshness + binding.
  if (!message.includes(creatorId)) {
    return json(400, { error: "message must reference creatorId" });
  }
  const tsMatch = message.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/);
  if (!tsMatch) return json(400, { error: "message must include ISO timestamp" });
  const msgAge = Date.now() - new Date(tsMatch[1]).getTime();
  if (Number.isNaN(msgAge) || msgAge < 0 || msgAge > MESSAGE_MAX_AGE_MS) {
    return json(400, { error: "message expired, please re-sign" });
  }

  // ── Verify signature with tweetnacl.
  let sigOk = false;
  try {
    const sigBytes = bs58.decode(signature);
    const pubBytes = bs58.decode(walletAddress);
    const msgBytes = new TextEncoder().encode(message);
    sigOk = nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch (e) {
    return json(400, { error: "invalid signature encoding" });
  }
  if (!sigOk) return json(401, { error: "signature does not match wallet" });

  // ── Look up creator's approved token mint.
  const admin = createClient(supabaseUrl, serviceKey);
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
    const rpcRes = await fetch(SOLANA_RPC, {
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
