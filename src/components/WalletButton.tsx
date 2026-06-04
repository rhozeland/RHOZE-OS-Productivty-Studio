import { useEffect, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet as WalletIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Copy, LogOut, ChevronDown } from "lucide-react";

const WalletButton = () => {
  const { publicKey, connected, disconnect } = useWallet();
  const { user } = useAuth();
  const [walletLocked, setWalletLocked] = useState(false);
  const [storedWallet, setStoredWallet] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .rpc("get_my_private_profile_fields")
      .then(({ data }: { data: any }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setWalletLocked(!!row.wallet_locked);
          setStoredWallet(row.wallet_address);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!connected || !publicKey || !user) return;
    const address = publicKey.toBase58();

    if (walletLocked && storedWallet && storedWallet !== address) {
      toast.error(
        `Your account is bound to wallet ${storedWallet.slice(0, 6)}...${storedWallet.slice(-4)}. Submit a change request in Settings to switch.`
      );
      return;
    }

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

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    const truncated = `${address.slice(0, 4)}...${address.slice(-4)}`;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-foreground/10 text-foreground/70 text-xs backdrop-blur-sm border border-border hover:bg-foreground/15 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
            <span className="font-mono">{truncated}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(address);
              toast.success("Address copied");
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-2" />
            Copy address
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              try {
                await disconnect();
                toast.success("Wallet disconnected");
              } catch {
                toast.error("Failed to disconnect");
              }
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Disconnect wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="wallet-adapter-button-wrapper [&_.wallet-adapter-button]:!bg-foreground/10 [&_.wallet-adapter-button]:!text-foreground/70 [&_.wallet-adapter-button]:!text-xs [&_.wallet-adapter-button]:!h-8 [&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!backdrop-blur-sm [&_.wallet-adapter-button]:!border [&_.wallet-adapter-button]:!border-border [&_.wallet-adapter-button]:hover:!bg-foreground/15 [&_.wallet-adapter-button]:!transition-colors">
      <WalletMultiButton />
    </div>
  );
};

export default WalletButton;
