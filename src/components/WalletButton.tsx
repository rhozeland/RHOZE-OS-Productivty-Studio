import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet as WalletIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  WalletVerificationError,
  runWalletVerificationOnce,
  verifyWalletOwnership,
} from "@/lib/wallet-verification";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Copy, LogOut, ChevronDown, ShieldCheck } from "lucide-react";

type WalletBinding = { walletAddress: string | null; walletLocked: boolean };

// Query keys of other views that show the linked wallet; refreshed once a
// wallet is verified so they pick it up without a reload.
const LINKED_WALLET_QUERY_KEYS = [
  "wallet-panel-profile",
  "vault-wallet",
  "rewards-profile-verify",
  "firstrun-profile",
  "my-profile",
];

// user:wallet pairs already auto-prompted for while the wallet stays
// connected, so the signature request doesn't re-fire on every render or
// remount. Reconnecting the wallet or the "Verify wallet" menu item retries.
const autoVerifyAttempted = new Set<string>();

const VERIFY_TOAST_ID = "wallet-verification";

const WalletButton = () => {
  const { publicKey, connected, disconnect, signMessage } = useWallet();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(false);

  // Shared by every mounted WalletButton so they agree on the linked wallet.
  const { data: binding, isSuccess: bindingLoaded } = useQuery({
    queryKey: ["wallet-button-binding", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<WalletBinding> => {
      const { data, error } = await supabase.rpc("get_my_private_profile_fields");
      if (error) throw error;
      const row = data?.[0];
      return { walletAddress: row?.wallet_address || null, walletLocked: !!row?.wallet_locked };
    },
  });
  const storedWallet = binding?.walletAddress ?? null;
  const walletLocked = binding?.walletLocked ?? false;
  const connectedAddress = connected && publicKey ? publicKey.toBase58() : null;

  // Links the wallet only after the backend has verified a fresh signed
  // challenge — this component never writes profiles.wallet_address itself.
  const verifyWallet = useCallback(
    async (walletAddress: string) => {
      if (!user) return;
      const markLinked = () =>
        queryClient.setQueryData<WalletBinding>(["wallet-button-binding", user.id], {
          walletAddress,
          walletLocked: true,
        });
      setVerifying(true);
      try {
        await runWalletVerificationOnce(`${user.id}:${walletAddress}`, () =>
          verifyWalletOwnership({ walletAddress, signMessage }),
        );
        markLinked();
        for (const key of LINKED_WALLET_QUERY_KEYS) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
        toast.success("Wallet verified and linked to your account", { id: VERIFY_TOAST_ID });
      } catch (e) {
        // Linked meanwhile (e.g. from another tab) — the backend says so.
        if (e instanceof WalletVerificationError && e.code === "already_linked") {
          markLinked();
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["wallet-button-binding", user.id] });
        toast.error((e as Error)?.message || "Wallet verification failed. Please try again.", {
          id: VERIFY_TOAST_ID,
        });
      } finally {
        setVerifying(false);
      }
    },
    [user, signMessage, queryClient],
  );

  // When the wallet disconnects or switches, allow a fresh auto-prompt for
  // the old one next time, and re-read the linked wallet so a wallet
  // unlinked elsewhere (e.g. Settings) is noticed without a reload.
  const previousAddress = useRef(connectedAddress);
  useEffect(() => {
    const previous = previousAddress.current;
    previousAddress.current = connectedAddress;
    if (!user || previous === connectedAddress) return;
    if (previous) autoVerifyAttempted.delete(`${user.id}:${previous}`);
    if (connectedAddress) {
      queryClient.invalidateQueries(
        { queryKey: ["wallet-button-binding", user.id] },
        { cancelRefetch: false },
      );
    }
  }, [user, connectedAddress, queryClient]);

  useEffect(() => {
    // Wait for the linked-wallet state: acting on a profile read that hasn't
    // finished (or failed) would look like "no wallet linked yet".
    if (!user || !connectedAddress || !bindingLoaded) return;

    if (storedWallet) {
      if (walletLocked && storedWallet !== connectedAddress) {
        toast.error(
          `Your account is bound to wallet ${storedWallet.slice(0, 6)}...${storedWallet.slice(-4)}. Disconnect it in Settings → Wallet before linking a different one.`,
          { id: "wallet-bound-mismatch" },
        );
      }
      return;
    }

    const key = `${user.id}:${connectedAddress}`;
    if (autoVerifyAttempted.has(key)) return;
    autoVerifyAttempted.add(key);
    void verifyWallet(connectedAddress);
  }, [user, connectedAddress, bindingLoaded, storedWallet, walletLocked, verifyWallet]);

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    const truncated = `${address.slice(0, 4)}...${address.slice(-4)}`;
    const linked = storedWallet === address;
    const canVerify = !!user && bindingLoaded && !storedWallet && !!signMessage && !verifying;
    const statusLabel = linked
      ? "Wallet linked to your account"
      : verifying
        ? "Verifying wallet…"
        : "Wallet not verified";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={statusLabel}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-foreground/10 text-foreground/70 text-xs backdrop-blur-sm border border-border hover:bg-foreground/15 transition-colors"
          >
            <span
              className={
                linked
                  ? "h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                  : `h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)]${verifying ? " animate-pulse" : ""}`
              }
            />
            <span className="font-mono">{truncated}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canVerify && (
            <DropdownMenuItem onClick={() => void verifyWallet(address)}>
              <ShieldCheck className="h-3.5 w-3.5 mr-2" />
              Verify wallet
            </DropdownMenuItem>
          )}
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

  return <WalletConnectTrigger />;
};

const WalletConnectTrigger = () => {
  const { setVisible } = useWalletModal();
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-foreground/10 text-foreground/70 text-xs backdrop-blur-sm border border-border hover:bg-foreground/15 transition-colors"
    >
      <WalletIcon className="h-3 w-3" />
      <span>Wallet</span>
    </button>
  );
};

export default WalletButton;
