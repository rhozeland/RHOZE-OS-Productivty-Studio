import { assertSolanaCluster, CLUSTER_GENESIS_HASHES } from "./solana-cluster.ts";

Deno.test("accepts the configured Devnet genesis hash", () => {
  assertSolanaCluster(CLUSTER_GENESIS_HASHES.devnet, "devnet");
});

Deno.test("rejects Mainnet when Devnet is configured", () => {
  let rejected = false;
  try {
    assertSolanaCluster(CLUSTER_GENESIS_HASHES["mainnet-beta"], "devnet");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("genesis hash mismatch");
  }
  if (!rejected) throw new Error("Expected a mismatched cluster to be rejected");
});
