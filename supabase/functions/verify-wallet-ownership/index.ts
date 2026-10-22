/**
 * verify-wallet-ownership
 *
 * Proves the signed-in user controls a Solana wallet before that wallet is
 * linked to their profile. Both actions require a valid Supabase session; the
 * user id always comes from the JWT, never from the request body.
 *
 *   { action: "challenge", walletAddress }
 *     → stores a one-time challenge bound to (user, wallet, random nonce,
 *       5-minute expiry, purpose) and returns { challengeId, message, expiresAt }.
 *
 *   { action: "verify", challengeId, walletAddress, message, signature }
 *     → atomically consumes the challenge (must belong to this user and this
 *       wallet, be unexpired and unused), requires `message` to equal the
 *       issued text, verifies the base58 ed25519 signature with tweetnacl, and
 *       only then writes profiles.wallet_address.
 *
 * A challenge gets exactly one verify attempt: a bad signature or an edited
 * message burns it, and the client must request a new one. The cap on open
 * challenges per user lives in the database.
 */

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { ed25519 } from "https://esm.sh/@noble/curves@1.4.0/ed25519";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (status: number, code: string, error: string) =>
  json(status, { error, code });

const PURPOSE = "rhoze-wallet-verification";
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
// Raised by the limit_open_wallet_verification_challenges trigger.
const CHALLENGE_LIMIT_ERROR = "wallet_verification_challenge_limit";

// tweetnacl accepts small-order public keys, for which one fixed signature
// verifies every message. No private key stands behind them, so they can
// never prove ownership. fromHex also rejects off-curve and non-canonical
// encodings.
const isOwnableWalletKey = (pubBytes: Uint8Array) => {
  try {
    return !ed25519.ExtendedPoint.fromHex(pubBytes).isSmallOrder();
  } catch {
    return false;
  }
};

// A Solana wallet address is the base58 encoding of a 32-byte ed25519 public key.
const isWalletAddress = (value: string) => {
  try {
    const bytes = bs58.decode(value);
    return bytes.length === 32 && isOwnableWalletKey(bytes);
  } catch {
    return false;
  }
};

const WalletAddress = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
  .refine(isWalletAddress);

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("challenge"),
    walletAddress: WalletAddress,
  }),
  z.object({
    action: z.literal("verify"),
    challengeId: z.string().uuid(),
    walletAddress: WalletAddress,
    message: z.string().min(1).max(2000),
    signature: z.string().min(64).max(128),
  }),
]);

type VerifyInput = Extract<z.infer<typeof BodySchema>, { action: "verify" }>;

const randomNonce = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const buildChallengeMessage = (p: {
  userId: string;
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}) =>
  [
    "Rhozeland wants you to verify ownership of this Solana wallet.",
    "",
    "Signing links this wallet to your Rhozeland account. It is free and does not send a transaction.",
    "",
    `Purpose: ${PURPOSE}`,
    `Wallet: ${p.walletAddress}`,
    `User ID: ${p.userId}`,
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt}`,
    `Expiration Time: ${p.expiresAt}`,
  ].join("\n");

const isValidSignature = (
  message: string,
  signature: string,
  walletAddress: string,
) => {
  try {
    const sigBytes = bs58.decode(signature);
    const pubBytes = bs58.decode(walletAddress);
    if (sigBytes.length !== nacl.sign.signatureLength) return false;
    if (pubBytes.length !== nacl.sign.publicKeyLength) return false;
    if (!isOwnableWalletKey(pubBytes)) return false;
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      sigBytes,
      pubBytes,
    );
  } catch {
    return false;
  }
};

const WALLET_ALREADY_LINKED =
  "Your account is already linked to a different wallet. Disconnect it in Settings → Wallet, then verify the new one.";

async function createChallenge(
  admin: SupabaseClient,
  userId: string,
  walletAddress: string,
) {
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("wallet_address")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr) throw profileErr;
  if (!profile) {
    return fail(
      404,
      "profile_not_found",
      "Finish setting up your profile before linking a wallet.",
    );
  }

  // Never let this endpoint replace an existing wallet — the current one has
  // to be unlinked first.
  const linked = profile.wallet_address || null;
  if (linked === walletAddress) {
    return fail(
      409,
      "already_linked",
      "This wallet is already linked to your account.",
    );
  }
  if (linked) return fail(409, "wallet_already_linked", WALLET_ALREADY_LINKED);

  const now = new Date();
  const nowIso = now.toISOString();

  // Housekeeping: drop this user's expired, never-used challenges.
  const { error: cleanupErr } = await admin
    .from("wallet_verification_challenges")
    .delete()
    .eq("user_id", userId)
    .is("consumed_at", null)
    .lte("expires_at", nowIso);
  if (cleanupErr) throw cleanupErr;

  const nonce = randomNonce();
  const issuedAt = nowIso;
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();
  const message = buildChallengeMessage({
    userId,
    walletAddress,
    nonce,
    issuedAt,
    expiresAt,
  });

  const { data: row, error: insertErr } = await admin
    .from("wallet_verification_challenges")
    .insert({
      user_id: userId,
      wallet_address: walletAddress,
      purpose: PURPOSE,
      nonce,
      message,
      issued_at: issuedAt,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (insertErr?.message?.includes(CHALLENGE_LIMIT_ERROR)) {
    return fail(
      429,
      "too_many_requests",
      "Too many pending wallet verifications. Wait a few minutes and try again.",
    );
  }
  if (insertErr) throw insertErr;

  return json(200, { challengeId: row.id, message, expiresAt });
}

async function verifyChallenge(
  admin: SupabaseClient,
  userId: string,
  input: VerifyInput,
) {
  const { challengeId, walletAddress, message, signature } = input;
  const nowIso = new Date().toISOString();

  // 1. Consume the challenge atomically. Matching on the session user and the
  //    submitted wallet means a challenge issued to another user or for
  //    another wallet never matches (and is not burned by the attempt).
  const { data: challenge, error: consumeErr } = await admin
    .from("wallet_verification_challenges")
    .update({ consumed_at: nowIso })
    .eq("id", challengeId)
    .eq("user_id", userId)
    .eq("wallet_address", walletAddress)
    .eq("purpose", PURPOSE)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("message")
    .maybeSingle();
  if (consumeErr) throw consumeErr;
  if (!challenge) {
    return fail(
      400,
      "invalid_challenge",
      "This verification request is invalid, expired, or already used. Please try again.",
    );
  }

  // 2. The wallet must have signed exactly what we issued.
  if (message !== challenge.message) {
    return fail(
      400,
      "message_mismatch",
      "The signed message doesn't match the verification request. Please try again.",
    );
  }

  // 3. Verify the ed25519 signature against the wallet's public key.
  if (!isValidSignature(challenge.message, signature, walletAddress)) {
    return fail(
      401,
      "invalid_signature",
      "The signature could not be verified for this wallet.",
    );
  }

  // 4. Only now link the wallet — and only if the account has none yet.
  const { data: linked, error: linkErr } = await admin
    .from("profiles")
    .update({ wallet_address: walletAddress, wallet_locked: true })
    .eq("user_id", userId)
    .or('wallet_address.is.null,wallet_address.eq.""')
    .select("wallet_address")
    .maybeSingle();
  if (linkErr) throw linkErr;

  if (!linked) {
    // Nothing updated: either the profile is gone or a wallet was linked in
    // the meantime (e.g. the same wallet verified from another tab).
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("wallet_address")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile) {
      return fail(
        404,
        "profile_not_found",
        "Finish setting up your profile before linking a wallet.",
      );
    }
    if (profile.wallet_address !== walletAddress) {
      return fail(409, "wallet_already_linked", WALLET_ALREADY_LINKED);
    }
  }

  return json(200, { verified: true, walletAddress });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return fail(405, "method_not_allowed", "Method not allowed.");

  // ── Auth: caller must be signed in. The user id comes from the JWT only.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return fail(401, "unauthorized", "Sign in to verify a wallet.");
  }
  const jwt = authHeader.slice("Bearer ".length).trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return fail(
      401,
      "unauthorized",
      "Your session has expired. Sign in again.",
    );
  }
  const userId = userData.user.id;

  // ── Validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "invalid_request", "Invalid request.");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_request", "Invalid request.");

  try {
    return parsed.data.action === "challenge"
      ? await createChallenge(admin, userId, parsed.data.walletAddress)
      : await verifyChallenge(admin, userId, parsed.data);
  } catch (e) {
    console.error(
      "verify-wallet-ownership failed:",
      (e as Error)?.message ?? e,
    );
    return fail(
      500,
      "server_error",
      "Wallet verification is unavailable right now. Please try again.",
    );
  }
});
