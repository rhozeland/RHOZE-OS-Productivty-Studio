import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { getSolanaConfig } from "../_shared/solana-config.ts";
import { CLUSTER_GENESIS_HASHES } from "../_shared/solana-cluster.ts";
import {
  accountInfoValue,
  buildExternalMintChallengeMessage,
  isInitializedSplMintAccount,
  isSolanaPublicKey,
  parsePumpCoin,
} from "../_shared/external-mint-attachment.ts";
import { isOwnableWalletKey, isValidWalletSignature } from "../_shared/wallet-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const TargetType = z.enum(["project", "work"]);
const ChallengeSchema = z.object({
  action: z.literal("challenge"),
  mintAddress: z.string().min(32).max(44),
  targetType: TargetType,
  targetId: z.string().uuid(),
  signerWallet: z.string().min(32).max(44),
});
const AttachSchema = z.object({
  action: z.literal("attach"),
  challengeId: z.string().uuid(),
  signature: z.string().min(64).max(128),
});
const BodySchema = z.discriminatedUnion("action", [ChallengeSchema, AttachSchema]);

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PUMP_COIN_API = "https://frontend-api-v3.pump.fun/coins/";
const TOKEN_ACCOUNT_MIN_SIZE = 82;

type AdminClient = SupabaseClient;

const isOwnablePublicKey = (address: string) => {
  try {
    const bytes = bs58.decode(address);
    return bytes.length === 32 && isOwnableWalletKey(bytes);
  } catch {
    return false;
  }
};

async function rpc<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Solana RPC returned HTTP ${response.status}`);
  const result = await response.json();
  if (result?.error) throw new Error("Solana RPC could not verify the mint");
  return result.result as T;
}

async function validateMintOnConfiguredNetwork(mintAddress: string) {
  if (!isSolanaPublicKey(mintAddress)) {
    return { status: 400, error: "invalid Solana mint address" } as const;
  }

  const config = getSolanaConfig();
  const genesisHash = await rpc<string>(config.rpcUrl, "getGenesisHash");
  if (genesisHash !== CLUSTER_GENESIS_HASHES[config.cluster]) {
    throw new Error("configured Solana RPC is connected to the wrong network");
  }

  const accountResponse = await rpc<{
    context?: { slot?: number };
    value?: {
      owner?: string;
      executable?: boolean;
      data?: [string, string];
    } | null;
  }>(config.rpcUrl, "getAccountInfo", [mintAddress, { encoding: "base64", commitment: "confirmed" }]);
  const account = accountInfoValue(accountResponse);

  if (!account || !Array.isArray(account.data) || typeof account.data[0] !== "string") {
    return { status: 404, error: "mint is not an initialized token on the configured Solana network" } as const;
  }

  let mintData: Uint8Array;
  try {
    mintData = Uint8Array.from(atob(account.data[0]), (character) => character.charCodeAt(0));
  } catch {
    return { status: 404, error: "mint account data could not be verified" } as const;
  }

  // SPL Mint layout: decimals at byte 44 and initialized flag at byte 45.
  if (!isInitializedSplMintAccount({
    owner: account.owner,
    executable: account.executable,
    data: mintData.length >= TOKEN_ACCOUNT_MIN_SIZE ? mintData : null,
  }, config.tokenProgramId)) {
    return { status: 404, error: "mint account is not an initialized supported SPL token" } as const;
  }

  return { status: 200 } as const;
}

async function fetchVerifiedPumpCoin(mintAddress: string) {
  const response = await fetch(`${PUMP_COIN_API}${encodeURIComponent(mintAddress)}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Rhozeland/1.0)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return { status: 404 as const };
  if (!response.ok) return { status: 502 as const };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 502 as const };
  }

  const coin = parsePumpCoin(payload, mintAddress);
  if (!coin || !isOwnablePublicKey(coin.creatorWallet)) {
    return { status: 404 as const };
  }
  return { status: 200 as const, coin };
}

const mintMetadata = (coin: { mint: string; name: string; ticker: string; imageUrl: string | null }) => ({
  mint: coin.mint,
  name: coin.name,
  ticker: coin.ticker,
  imageUrl: coin.imageUrl,
});

async function createChallenge(
  admin: AdminClient,
  userId: string,
  input: z.infer<typeof ChallengeSchema>,
) {
  if (!isSolanaPublicKey(input.mintAddress) || !isOwnablePublicKey(input.signerWallet)) {
    return json(400, { error: "invalid Solana address" });
  }

  const table = input.targetType === "project" ? "projects" : "works";
  const { data: target, error: targetError } = await admin
    .from(table)
    .select("id,user_id,linked_token_id,linked_token_mint")
    .eq("id", input.targetId)
    .eq("user_id", userId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) return json(404, { error: "target not found or not owned by this account" });

  const networkMint = await validateMintOnConfiguredNetwork(input.mintAddress);
  if (networkMint.status !== 200) return json(networkMint.status, { error: networkMint.error });

  const pumpResult = await fetchVerifiedPumpCoin(input.mintAddress);
  if (pumpResult.status !== 200) {
    return json(pumpResult.status, {
      error: pumpResult.status === 404
        ? "pump.fun did not verify this mint"
        : "pump.fun could not verify this mint right now",
    });
  }
  if (pumpResult.coin.creatorWallet !== input.signerWallet) {
    return json(409, { error: "connect and sign with the wallet that created this pump.fun mint", code: "creator_wallet_mismatch" });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const challengeId = crypto.randomUUID();
  const nonce = bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
  const message = buildExternalMintChallengeMessage({
    challengeId,
    userId,
    targetType: input.targetType,
    targetId: input.targetId,
    mint: pumpResult.coin.mint,
    creatorWallet: pumpResult.coin.creatorWallet,
    nonce,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  await admin
    .from("external_mint_attachment_challenges")
    .delete()
    .eq("user_id", userId)
    .or(`consumed_at.not.is.null,expires_at.lte.${now.toISOString()}`);

  const { error: insertError } = await admin
    .from("external_mint_attachment_challenges")
    .insert({
      id: challengeId,
      user_id: userId,
      target_type: input.targetType,
      target_id: input.targetId,
      mint_address: pumpResult.coin.mint,
      creator_wallet: pumpResult.coin.creatorWallet,
      message,
      token_name: pumpResult.coin.name,
      token_ticker: pumpResult.coin.ticker,
      token_image_url: pumpResult.coin.imageUrl,
      previous_linked_token_id: target.linked_token_id,
      previous_linked_token_mint: target.linked_token_mint,
      expires_at: expiresAt.toISOString(),
    });
  if (insertError) throw insertError;

  return json(200, {
    challengeId,
    message,
    expiresAt: expiresAt.toISOString(),
    creatorWallet: pumpResult.coin.creatorWallet,
    token: mintMetadata(pumpResult.coin),
  });
}

async function attachWithChallenge(admin: AdminClient, userId: string, input: z.infer<typeof AttachSchema>) {
  const { data: challenge, error: challengeError } = await admin
    .from("external_mint_attachment_challenges")
    .select("id,user_id,target_type,target_id,mint_address,creator_wallet,message,token_name,token_ticker,token_image_url,expires_at,consumed_at")
    .eq("id", input.challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (challengeError) throw challengeError;
  if (!challenge) return json(404, { error: "verification challenge not found" });
  if (challenge.consumed_at) return json(409, { error: "verification challenge has already been used" });
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return json(410, { error: "verification challenge expired; request a new one" });
  }

  if (!isValidWalletSignature(challenge.message, input.signature, challenge.creator_wallet)) {
    return json(401, { error: "signature does not match the pump.fun creator wallet" });
  }

  const { data, error } = await admin.rpc("attach_verified_external_mint", {
    p_challenge_id: challenge.id,
  });
  if (error) {
    if (error.code === "22023") return json(409, { error: "verification challenge expired, changed, or already used" });
    if (error.code === "40001") return json(409, { error: "target token relationship changed; request a new challenge" });
    if (error.code === "42501") return json(403, { error: "target is no longer available to this account" });
    throw error;
  }

  return json(200, {
    attached: true,
    target: data?.[0] ?? null,
    token: {
      mint: challenge.mint_address,
      name: challenge.token_name,
      ticker: challenge.token_ticker,
      imageUrl: challenge.token_image_url,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "missing authorization" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "server configuration is incomplete" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = authorization.slice("Bearer ".length).trim();
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData.user) return json(401, { error: "invalid authorization" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid JSON body" });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "invalid request body", details: parsed.error.flatten() });

  try {
    return parsed.data.action === "challenge"
      ? await createChallenge(admin, authData.user.id, parsed.data)
      : await attachWithChallenge(admin, authData.user.id, parsed.data);
  } catch (error) {
    console.error("attach-external-pump-token failed", (error as Error)?.message ?? error);
    return json(500, { error: "external mint verification is unavailable right now" });
  }
});
