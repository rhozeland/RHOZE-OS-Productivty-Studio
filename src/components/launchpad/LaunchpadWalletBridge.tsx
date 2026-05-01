/**
 * LaunchpadWalletBridge — pushes the connected wallet adapter into the
 * Anchor on-chain client whenever it changes. Mount once near the root
 * (inside SolanaWalletProvider). Renders nothing.
 */
import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { setLaunchpadWallet, initLaunchpadIdl } from "@/lib/launchpad-onchain";

const LaunchpadWalletBridge = () => {
  const wallet = useWallet();

  useEffect(() => {
    // Kick off IDL load on first mount (idempotent).
    void initLaunchpadIdl();
  }, []);

  useEffect(() => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setLaunchpadWallet(null);
      return;
    }
    setLaunchpadWallet({
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
    });
    return () => setLaunchpadWallet(null);
  }, [wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

  return null;
};

export default LaunchpadWalletBridge;
