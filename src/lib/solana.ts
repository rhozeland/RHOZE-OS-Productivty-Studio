import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getSolanaConnectionConfig } from "./solana-config";

export const getConnection = () =>
  new Connection(getSolanaConnectionConfig().rpcUrl);

export const solToLamports = (sol: number) =>
  Math.round(sol * LAMPORTS_PER_SOL);

export const lamportsToSol = (lamports: number) =>
  lamports / LAMPORTS_PER_SOL;

export const createTransferTransaction = async (
  from: PublicKey,
  to: PublicKey,
  solAmount: number,
  connection: Connection = getConnection(),
): Promise<Transaction> => {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: solToLamports(solAmount),
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = from;

  return transaction;
};

export const confirmTransaction = async (
  signature: string,
  transaction: Pick<Transaction, "recentBlockhash" | "lastValidBlockHeight">,
  connection: Connection = getConnection(),
) => {
  const { recentBlockhash, lastValidBlockHeight } = transaction;
  if (!recentBlockhash || lastValidBlockHeight == null) {
    throw new Error("Cannot confirm transaction without its blockhash expiry.");
  }

  return connection.confirmTransaction(
    {
      signature,
      blockhash: recentBlockhash,
      lastValidBlockHeight,
    },
    "confirmed",
  );
};

export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};
