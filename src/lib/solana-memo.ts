import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getConnection } from "./solana";
import { getSolanaConfig } from "./solana-config";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * Creates a Solana memo transaction that anchors data on-chain.
 * This is used to create verifiable audit trails for escrow events.
 */
export const createMemoTransaction = async (
  payer: PublicKey,
  memo: string
): Promise<Transaction> => {
  if (!getSolanaConfig().anchoringEnabled) {
    throw new Error("On-chain anchoring is disabled for this environment.");
  }
  const connection = getConnection();

  const memoInstruction = new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  });

  const transaction = new Transaction().add(memoInstruction);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payer;

  return transaction;
};

/**
 * Builds a structured memo string for escrow events.
 */
export const buildEscrowMemo = (params: {
  action: "lock" | "release" | "refund";
  contractId: string;
  amount: number;
  milestoneTitle?: string;
}) => {
  const parts = [
    `rhoze:escrow:${params.action}`,
    `contract:${params.contractId.slice(0, 8)}`,
    `credits:${params.amount}`,
  ];
  if (params.milestoneTitle) {
    parts.push(`milestone:${params.milestoneTitle.slice(0, 30)}`);
  }
  parts.push(`ts:${Math.floor(Date.now() / 1000)}`);
  return parts.join("|");
};

/**
 * Builds a structured memo string for Creator Pass mint events.
 */
export const buildCreatorPassMemo = (params: {
  tier: string;
  userId: string;
}) => {
  return [
    `rhoze:pass:mint`,
    `tier:${params.tier}`,
    `user:${params.userId.slice(0, 8)}`,
    `ts:${Math.floor(Date.now() / 1000)}`,
  ].join("|");
};
