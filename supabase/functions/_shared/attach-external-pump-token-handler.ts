import {
  accountInfoValue,
  buildExternalMintChallengeMessage,
  isInitializedSplMintAccount,
  isSolanaPublicKey,
  parsePumpCoin,
} from "./external-mint-attachment.ts";

type SolanaCluster = "devnet" | "mainnet-beta";

interface DatabaseError {
  code?: string;
  message?: string;
}

interface DatabaseQueryResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

interface DatabaseQuery {
  select(columns: string): DatabaseQuery;
  eq(column: string, value: unknown): DatabaseQuery;
  maybeSingle(): Promise<DatabaseQueryResult<Record<string, unknown>>>;
  delete(): DatabaseQuery;
  or(filters: string): Promise<{ error: DatabaseError | null }>;
  insert(values: Record<string, unknown>): Promise<{ error: DatabaseError | null }>;
}

interface AdminClient {
  auth: {
    getUser(jwt: string): Promise<{
      data: { user: { id: string } | null };
      error: DatabaseError | null;
    }>;
  };
  from(table: string): DatabaseQuery;
  rpc(name: string, args: Record<string, unknown>): Promise<{
    data: Array<Record<string, unknown>> | null;
    error: DatabaseError | null;
  }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PUMP_COIN_API = "https://frontend-api-v3.pump.fun/coins/";
const TOKEN_ACCOUNT_MIN_SIZE = 82;

export type ExternalMintAttachmentRequest =
  | {
    action: "challenge";
    mintAddress: string;
    targetType: "project" | "work";
    targetId: string;
    signerWallet: string;
  }
  | { action: "attach"; challengeId: string; signature: string };

export interface ExternalMintHandlerDependencies {
  getEnv(name: string): string | undefined;
  createAdminClient(url: string, serviceKey: string): unknown;
  parseBody(body: unknown): { data?: ExternalMintAttachmentRequest; details?: unknown };
  isOwnablePublicKey(address: string): boolean;
  encodeBase58(bytes: Uint8Array): string;
  isValidWalletSignature(message: string, signature: string, walletAddress: string): boolean;
  getSolanaConfig(): { cluster: SolanaCluster; rpcUrl: string; tokenProgramId: string };
  clusterGenesisHashes: Record<SolanaCluster, string>;
  fetch?: typeof fetch;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const createAttachExternalPumpTokenHandler = (dependencies: ExternalMintHandlerDependencies) => {
  const fetcher = dependencies.fetch ?? globalThis.fetch.bind(globalThis);

  async function rpc<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
    const response = await fetcher(rpcUrl, {
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

    const config = dependencies.getSolanaConfig();
    const genesisHash = await rpc<string>(config.rpcUrl, "getGenesisHash");
    if (genesisHash !== dependencies.clusterGenesisHashes[config.cluster]) {
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
    const response = await fetcher(`${PUMP_COIN_API}${encodeURIComponent(mintAddress)}`, {
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
    if (!coin || !dependencies.isOwnablePublicKey(coin.creatorWallet)) {
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

  async function createChallenge(admin: AdminClient, userId: string, input: Extract<ExternalMintAttachmentRequest, { action: "challenge" }>) {
    if (!isSolanaPublicKey(input.mintAddress) || !dependencies.isOwnablePublicKey(input.signerWallet)) {
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
    const targetState = target as { linked_token_id: string | null; linked_token_mint: string | null };

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
    const nonce = dependencies.encodeBase58(crypto.getRandomValues(new Uint8Array(32)));
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
      previous_linked_token_id: targetState.linked_token_id,
      previous_linked_token_mint: targetState.linked_token_mint,
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

  async function attachWithChallenge(admin: AdminClient, userId: string, input: Extract<ExternalMintAttachmentRequest, { action: "attach" }>) {
    const { data: challenge, error: challengeError } = await admin
      .from("external_mint_attachment_challenges")
      .select("id,user_id,target_type,target_id,mint_address,creator_wallet,message,token_name,token_ticker,token_image_url,expires_at,consumed_at")
      .eq("id", input.challengeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (challengeError) throw challengeError;
    if (!challenge) return json(404, { error: "verification challenge not found" });
    const challengeRow = challenge as Record<string, string | null>;
    if (challengeRow.consumed_at) return json(409, { error: "verification challenge has already been used" });
    if (new Date(challengeRow.expires_at ?? "").getTime() <= Date.now()) {
      return json(410, { error: "verification challenge expired; request a new one" });
    }

    const message = challengeRow.message ?? "";
    const creatorWallet = challengeRow.creator_wallet ?? "";
    if (!dependencies.isValidWalletSignature(message, input.signature, creatorWallet)) {
      return json(401, { error: "signature does not match the pump.fun creator wallet" });
    }

    const { data, error } = await admin.rpc("attach_verified_external_mint", {
      p_challenge_id: challengeRow.id,
    });
    if (error) {
      if (error.code === "22023") return json(409, { error: "verification challenge expired, changed, or already used" });
      if (error.code === "PT409" || error.code === "40001") {
        return json(409, { error: "target token relationship changed; request a new challenge" });
      }
      if (error.code === "42501") return json(403, { error: "target is no longer available to this account" });
      throw error;
    }

    return json(200, {
      attached: true,
      target: data?.[0] ?? null,
      token: {
        mint: challengeRow.mint_address,
        name: challengeRow.token_name,
        ticker: challengeRow.token_ticker,
        imageUrl: challengeRow.token_image_url,
      },
    });
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "method not allowed" });

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json(401, { error: "missing authorization" });

    const supabaseUrl = dependencies.getEnv("SUPABASE_URL");
    const serviceKey = dependencies.getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json(500, { error: "server configuration is incomplete" });

    const admin = dependencies.createAdminClient(supabaseUrl, serviceKey) as AdminClient;
    const jwt = authorization.slice("Bearer ".length).trim();
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) return json(401, { error: "invalid authorization" });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid JSON body" });
    }
    const parsed = dependencies.parseBody(body);
    if (!parsed.data) return json(400, { error: "invalid request body", details: parsed.details });

    try {
      return parsed.data.action === "challenge"
        ? await createChallenge(admin, authData.user.id, parsed.data)
        : await attachWithChallenge(admin, authData.user.id, parsed.data);
    } catch (error) {
      console.error("attach-external-pump-token failed", (error as Error)?.message ?? error);
      return json(500, { error: "external mint verification is unavailable right now" });
    }
  };
};
