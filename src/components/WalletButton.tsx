import { useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const WalletButton = () => {
  const { publicKey, connected } = useWallet();
  const { user } = useAuth();

  // Save wallet address to profile when connected
  useEffect(() => {
    if (connected && publicKey && user) {
      const address = publicKey.toBase58();
      supabase
        .from("profiles")
        .update({ wallet_address: address } as any)
        .eq("user_id", user.id)
        .then(() => {});
    }
  }, [connected, publicKey, user]);

  return (
    <div className="wallet-adapter-button-wrapper [&_.wallet-adapter-button]:!bg-foreground/10 [&_.wallet-adapter-button]:!text-foreground/70 [&_.wallet-adapter-button]:!text-xs [&_.wallet-adapter-button]:!h-8 [&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!backdrop-blur-sm [&_.wallet-adapter-button]:!border [&_.wallet-adapter-button]:!border-border [&_.wallet-adapter-button]:hover:!bg-foreground/15 [&_.wallet-adapter-button]:!transition-colors">
      <WalletMultiButton />
    </div>
  );
};

export default WalletButton;
