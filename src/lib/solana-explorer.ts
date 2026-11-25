import { getSolanaConnectionConfig } from "@/lib/solana-config";

const clusterQuery = (): string => {
  const { cluster } = getSolanaConnectionConfig();
  return cluster === "devnet" ? "?cluster=devnet" : "";
};

export const solscanTransactionUrl = (signature: string): string =>
  `https://solscan.io/tx/${encodeURIComponent(signature)}${clusterQuery()}`;

export const solscanAccountUrl = (address: string): string =>
  `https://solscan.io/account/${encodeURIComponent(address)}${clusterQuery()}`;

export const solscanTokenUrl = (address: string): string =>
  `https://solscan.io/token/${encodeURIComponent(address)}${clusterQuery()}`;

export const solanaExplorerTransactionUrl = (signature: string): string =>
  `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${clusterQuery()}`;

export const solanaExplorerAddressUrl = (address: string): string =>
  `https://explorer.solana.com/address/${encodeURIComponent(address)}${clusterQuery()}`;
