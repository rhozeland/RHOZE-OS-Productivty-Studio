import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WalletButton = () => {
  const { publicKey, connected } = useWallet();
  const { user } = useAuth();
  const [walletLocked, setWalletLocked] = useState(false);
  const [storedWallet, setStoredWallet] = useState<string | null>(null);

  // Fetch wallet lock status on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("wallet_address, wallet_locked")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setWalletLocked(!!(data as any).wallet_locked);
          setStoredWallet(data.wallet_address);
        }
      });
  }, [user]);

  // Save wallet address to profile when connected (only if not locked to a different wallet)
  useEffect(() => {
    if (!connected || !publicKey || !user) return;
    const address = publicKey.toBase58();

    // If wallet is locked and this is a different wallet, warn user
    if (walletLocked && storedWallet && storedWallet !== address) {
      toast.error(
        `Your account is bound to wallet ${storedWallet.slice(0, 6)}...${storedWallet.slice(-4)}. Submit a change request in Settings to switch.`
      );
      return;
    }

    // If no wallet stored yet, save and lock it
    if (!storedWallet) {
      supabase
        .from("profiles")
        .update({ wallet_address: address, wallet_locked: true } as any)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (!error) {
            setStoredWallet(address);
            setWalletLocked(true);
            toast.success("Wallet bound to your account");
          }
        });
    }
  }, [connected, publicKey, user, walletLocked, storedWallet]);

  return (
    <div className="wallet-adapter-button-wrapper [&_.wallet-adapter-button]:!bg-foreground/10 [&_.wallet-adapter-button]:!text-foreground/70 [&_.wallet-adapter-button]:!text-xs [&_.wallet-adapter-button]:!h-8 [&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!backdrop-blur-sm [&_.wallet-adapter-button]:!border [&_.wallet-adapter-button]:!border-border [&_.wallet-adapter-button]:hover:!bg-foreground/15 [&_.wallet-adapter-button]:!transition-colors">
      <WalletMultiButton />
    </div>
  );
};

export default WalletButton;
