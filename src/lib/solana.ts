import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";

const NETWORK = "devnet";

export const getConnection = () => new Connection(clusterApiUrl(NETWORK));

export const solToLamports = (sol: number) =>
  Math.round(sol * LAMPORTS_PER_SOL);

export const lamportsToSol = (lamports: number) =>
  lamports / LAMPORTS_PER_SOL;

export const createTransferTransaction = async (
  from: PublicKey,
  to: PublicKey,
  solAmount: number
): Promise<Transaction> => {
  const connection = getConnection();
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: solToLamports(solAmount),
    })
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = from;

  return transaction;
};

export const confirmTransaction = async (signature: string) => {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  return connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });
};

export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};
