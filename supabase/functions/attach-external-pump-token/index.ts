import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { getSolanaConfig } from "../_shared/solana-config.ts";
import { CLUSTER_GENESIS_HASHES } from "../_shared/solana-cluster.ts";
import { createAttachExternalPumpTokenHandler } from "../_shared/attach-external-pump-token-handler.ts";
import { isOwnableWalletKey, isValidWalletSignature } from "../_shared/wallet-signature.ts";

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

const parseBody = (body: unknown) => {
  const parsed = BodySchema.safeParse(body);
  return parsed.success
    ? { data: parsed.data }
    : { details: parsed.error.flatten() };
};

const isOwnablePublicKey = (address: string) => {
  try {
    const bytes = bs58.decode(address);
    return bytes.length === 32 && isOwnableWalletKey(bytes);
  } catch {
    return false;
  }
};

Deno.serve(createAttachExternalPumpTokenHandler({
  getEnv: (name) => Deno.env.get(name),
  createAdminClient: (url, serviceKey) => createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  parseBody,
  isOwnablePublicKey,
  encodeBase58: bs58.encode,
  isValidWalletSignature,
  getSolanaConfig,
  clusterGenesisHashes: CLUSTER_GENESIS_HASHES,
}));
