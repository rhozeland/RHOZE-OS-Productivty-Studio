import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";
import { LAUNCHPAD_NETWORK } from "../lib/launchpad-onchain";
import "@solana/wallet-adapter-react-ui/styles.css";

export const SolanaWalletProvider = ({ children }: { children: ReactNode }) => {
  const endpoint = useMemo(() => {
    if (LAUNCHPAD_NETWORK === "mainnet-beta" && import.meta.env.VITE_SOLANA_RPC_URL) {
      return import.meta.env.VITE_SOLANA_RPC_URL;
    }
    return clusterApiUrl(LAUNCHPAD_NETWORK as Cluster);
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: LAUNCHPAD_NETWORK }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
