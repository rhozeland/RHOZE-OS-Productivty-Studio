// Test-only Deno fixture. Keep outside supabase/functions: deploy commands may include function subdirectories.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { ed25519 } from "https://esm.sh/@noble/curves@1.4.0/ed25519";
import { createAttachExternalPumpTokenHandler, type ExternalMintAttachmentRequest } from "../../../functions/_shared/attach-external-pump-token-handler.ts";
import { CLUSTER_GENESIS_HASHES } from "../../../functions/_shared/solana-cluster.ts";
import { isOwnableWalletKey, isValidWalletSignature } from "../../../functions/_shared/wallet-signature.ts";

const MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TEST_RPC_URL = "http://task151-local-fixture.invalid";
const TEST_NAME = "Deno Runtime Fixture Coin";
const TEST_TICKER = "DENO";
const TEST_IMAGE = "https://images.example.test/deno.png";
const seed = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const signerWallet = bs58.encode(ed25519.getPublicKey(seed));

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("challenge"),
    mintAddress: z.string().min(32).max(44),
    targetType: z.enum(["project", "work"]),
    targetId: z.string().uuid(),
    signerWallet: z.string().min(32).max(44),
  }),
  z.object({
    action: z.literal("attach"),
    challengeId: z.string().uuid(),
    signature: z.string().min(64).max(128),
  }),
]);
const parseBody = (body: unknown) => {
  const parsed = BodySchema.safeParse(body);
  return parsed.success ? { data: parsed.data as ExternalMintAttachmentRequest } : { details: parsed.error.flatten() };
};

const mintData = new Uint8Array(82);
mintData[44] = 9;
mintData[45] = 1;
const encodedMintData = btoa(Array.from(mintData, (byte) => String.fromCharCode(byte)).join(""));
const TEST_GENESIS_HASH = CLUSTER_GENESIS_HASHES.devnet;

Deno.serve(createAttachExternalPumpTokenHandler({
  getEnv: (name) => Deno.env.get(name),
  createAdminClient: (url, serviceKey) => createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  parseBody,
  isOwnablePublicKey: (address) => {
    try {
      return bs58.decode(address).length === 32 && isOwnableWalletKey(bs58.decode(address));
    } catch {
      return false;
    }
  },
  encodeBase58: bs58.encode,
  isValidWalletSignature,
  getSolanaConfig: () => ({ cluster: "devnet", rpcUrl: TEST_RPC_URL, tokenProgramId: TOKEN_PROGRAM }),
  clusterGenesisHashes: CLUSTER_GENESIS_HASHES,
  fetch: async (input, init) => {
    const requestUrl = String(input);
    if (requestUrl === TEST_RPC_URL) {
      const request = JSON.parse(String(init?.body)) as { method: string };
      const result = request.method === "getGenesisHash"
        ? TEST_GENESIS_HASH
        : { context: { slot: 151 }, value: { owner: TOKEN_PROGRAM, executable: false, data: [encodedMintData, "base64"] } };
      return new Response(JSON.stringify({ jsonrpc: "2.0", result }), { status: 200 });
    }
    if (requestUrl === "https://frontend-api-v3.pump.fun/coins/" + MINT) {
      return new Response(JSON.stringify({
        mint: MINT,
        creator: signerWallet,
        name: TEST_NAME,
        symbol: TEST_TICKER,
        image_uri: TEST_IMAGE,
      }), { status: 200 });
    }
    throw new Error("Unexpected outbound URL in local Edge Runtime fixture");
  },
}));
