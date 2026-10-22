import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const ChallengeSchema = z.object({
  action: z.literal("challenge"),
  mintAddress: z.string().min(32).max(44),
  signerWallet: z.string().min(32).max(44),
});

const VerifySchema = z.object({
  action: z.literal("verify"),
  challengeId: z.string().uuid(),
  signature: z.string().min(80).max(100),
});

const BodySchema = z.discriminatedUnion("action", [
  ChallengeSchema,
  VerifySchema,
]);

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PUMP_API = "https://frontend-api-v3.pump.fun/coins/";

function isSolanaAddress(address: string): boolean {
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}
/**
 * Retrieves the creator wallet address associated with a pump.fun token
 * 
 * Uses the provided token mint address to query pump.fun's coin details
 * API and retrieve the wallet address reported as the token's creator
 * 
 * 
 * @param mintAddress - The Solana mint address identifying the token
 * @returns A promise containing the creator's wallet address
 */
async function getPumpCreatorWallet(mintAddress: string): Promise<string | null> {
  const response = await fetch(`${PUMP_API}${encodeURIComponent(mintAddress)}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Rhozeland/1.0)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Pump.fun returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("creator" in payload) ||
    typeof payload.creator !== "string"
  ) {
    return null;
  }

  return payload.creator;
}

// Return an error response on failure, or null when the account wallet matches.
async function checkAccountWallet(
  admin: SupabaseClient,
  userId: string,
  creatorWallet: string,
): Promise<Response | null> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("wallet_address")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return json(500, {
      verified: false,
      code: "wallet-lookup-failed",
      error: "Unable to retrieve the account wallet",
    });
  }

  if (!profile?.wallet_address) {
    return json(409, {
      verified: false,
      code: "wallet-not-linked",
      error: "Verify and link your wallet before submitting the token",
    });
  }

  if (profile.wallet_address !== creatorWallet) {
    return json(409, {
      verified: false,
      code: "account_wallet_mismatch",
      error: "The mint creator wallet must match the wallet connected to the account",
    });
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json(401, { error: "missing authorization" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: "server configuration is incomplete" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json(401, { error: "invalid authorization" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid json" });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json(400, {
      error: "invalid request body",
      details: parsed.error.flatten(),
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const userId = userData.user.id;

  if (parsed.data.action === "challenge") {
    const { mintAddress, signerWallet } = parsed.data;
    if (!isSolanaAddress(mintAddress) || !isSolanaAddress(signerWallet)) {
      return json(400, { error: "invalid Solana address" });
    }

    let creatorWallet: string | null;
    try {
      creatorWallet = await getPumpCreatorWallet(mintAddress);
    } catch (error) {
      console.error("Pump.fun creator lookup failed", error);
      return json(502, { error: "could not verify the mint with Pump.fun" });
    }

    if (!creatorWallet || !isSolanaAddress(creatorWallet)) {
      return json(404, { error: "Pump.fun did not return a valid creator wallet" });
    }
    if (creatorWallet !== signerWallet) {
      return json(409, {
        error: "Connect the wallet used to launch this mint on Pump.fun.",
        code: "wallet_mismatch",
        creatorWallet,
      });
    }

    const walletError = await checkAccountWallet(admin, userId, creatorWallet);
    if (walletError) return walletError;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
    const challengeId = crypto.randomUUID();
    const message = [
      "Rhozeland artist mint ownership verification",
      `Mint: ${mintAddress}`,
      `Creator wallet: ${creatorWallet}`,
      `Rhozeland user: ${userId}`,
      `Challenge: ${challengeId}`,
      `Issued: ${now.toISOString()}`,
      `Expires: ${expiresAt.toISOString()}`,
      "Sign this message to prove control of the creator wallet. This is not a transaction and does not spend SOL.",
    ].join("\n");

    const { error: cleanupError } = await admin
      .from("artist_mint_verification_challenges")
      .delete()
      .lt("expires_at", now.toISOString());
    if (cleanupError) {
      console.error("Expired mint challenge cleanup failed", cleanupError);
      return json(500, { error: "could not create a verification challenge" });
    }

    const { error: insertError } = await admin
      .from("artist_mint_verification_challenges")
      .insert({
        id: challengeId,
        user_id: userId,
        mint_address: mintAddress,
        creator_wallet: creatorWallet,
        message,
        expires_at: expiresAt.toISOString(),
      });
    if (insertError) {
      console.error("Mint challenge insert failed", insertError);
      return json(500, { error: "could not create a verification challenge" });
    }

    return json(200, {
      challengeId,
      message,
      creatorWallet,
      mintAddress,
      expiresAt: expiresAt.toISOString(),
    });
  }

  const { challengeId, signature } = parsed.data;
  const now = new Date().toISOString();
  const { data: challenge, error: challengeError } = await admin
    .from("artist_mint_verification_challenges")
    .select("id,mint_address,creator_wallet,message,expires_at,consumed_at")
    .eq("id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (challengeError) {
    console.error("Mint challenge lookup failed", challengeError);
    return json(500, { error: "could not load verification challenge" });
  }
  if (!challenge) return json(404, { error: "verification challenge not found" });
  if (challenge.consumed_at) {
    return json(409, { error: "verification challenge has already been used" });
  }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return json(410, { error: "verification challenge expired; request a new one" });
  }

  let signatureBytes: Uint8Array;
  let creatorWalletBytes: Uint8Array;
  try {
    signatureBytes = bs58.decode(signature);
    creatorWalletBytes = bs58.decode(challenge.creator_wallet);
  } catch {
    return json(400, { error: "invalid signature encoding" });
  }
  if (
    signatureBytes.length !== nacl.sign.signatureLength ||
    creatorWalletBytes.length !== nacl.sign.publicKeyLength
  ) {
    return json(400, { error: "invalid signature or creator wallet length" });
  }

  const signatureValid = nacl.sign.detached.verify(
    new TextEncoder().encode(challenge.message),
    signatureBytes,
    creatorWalletBytes,
  );
  if (!signatureValid) {
    return json(401, { error: "signature does not match the mint creator wallet" });
  }

  const walletError = await checkAccountWallet(admin, userId, challenge.creator_wallet);
  if (walletError) return walletError;

  const consumedAt = new Date().toISOString();
  const { data: consumed, error: consumeError } = await admin
    .from("artist_mint_verification_challenges")
    .update({ consumed_at: consumedAt })
    .eq("id", challengeId)
    .eq("user_id", userId)
    .is("consumed_at", null)
    .gt("expires_at", consumedAt)
    .select("id")
    .maybeSingle();

  if (consumeError) {
    console.error("Mint challenge consumption failed", consumeError);
    return json(500, { error: "could not complete mint ownership verification" });
  }
  if (!consumed) {
    return json(409, { error: "verification challenge expired or has already been used" });
  }

  return json(200, {
    verified: true,
    mintAddress: challenge.mint_address,
    creatorWallet: challenge.creator_wallet,
  });
});
