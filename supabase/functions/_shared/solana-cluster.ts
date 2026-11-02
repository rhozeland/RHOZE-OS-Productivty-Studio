import type { SolanaCluster } from "./solana-config.ts";

// Canonical Solana cluster genesis hashes, used to catch RPC URL misconfiguration.
export const CLUSTER_GENESIS_HASHES: Record<SolanaCluster, string> = {
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};

export const assertSolanaCluster = (
  actualGenesisHash: string,
  expectedCluster: SolanaCluster,
  expectedGenesisHash = CLUSTER_GENESIS_HASHES[expectedCluster],
): void => {
  if (actualGenesisHash !== expectedGenesisHash) {
    throw new Error(
      `Configured Solana RPC is not connected to ${expectedCluster} (genesis hash mismatch)`,
    );
  }
};

export const verifySolanaCluster = async (
  connection: { getGenesisHash: () => Promise<string> },
  expectedCluster: SolanaCluster,
): Promise<void> => {
  assertSolanaCluster(
    await connection.getGenesisHash(),
    expectedCluster,
    CLUSTER_GENESIS_HASHES[expectedCluster],
  );
};
