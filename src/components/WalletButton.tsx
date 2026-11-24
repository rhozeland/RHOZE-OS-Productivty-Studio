import { useState } from "react";
import type { MouseEvent } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet as WalletIcon, Copy, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  verifyWalletOwnership,
  type WalletVerificationIntent,
} from "@/lib/verifyWalletOwnership";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const WalletButton = () => {
  const { publicKey, connected, disconnect, signMessage } = useWallet();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [verificationIntent, setVerificationIntent] =
    useState<WalletVerificationIntent>("link");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const walletProfileQuery = useQuery({
    queryKey: ["wallet-binding", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_private_profile_fields");
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Could not load your linked wallet.");

      return {
        walletAddress: row.wallet_address || null,
      };
    },
  });

  const connectedAddress = publicKey?.toBase58() ?? null;
  const linkedAddress = walletProfileQuery.data?.walletAddress ?? null;
  const isDifferentLinkedWallet = !!linkedAddress &&
    !!connectedAddress &&
    linkedAddress !== connectedAddress;
  const intent: WalletVerificationIntent = isDifferentLinkedWallet
    ? "change"
    : "link";

  const beginVerification = (requestedIntent: WalletVerificationIntent) => {
    setVerificationIntent(requestedIntent);
    setVerificationOpen(true);
  };

  const confirmVerification = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!connectedAddress || !signMessage || !user) {
      toast.error("Connect a wallet that supports message signing.");
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyWalletOwnership({
        walletAddress: connectedAddress,
        signMessage,
        intent: verificationIntent,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wallet-binding", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
      ]);

      setVerificationOpen(false);
      if (result.changeRequested) {
        toast.success("Wallet change request submitted", {
          description: "Your current wallet remains linked until an admin approves the change.",
        });
      } else {
        toast.success("Wallet verified and linked to your account.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Wallet verification failed. Please try again.",
      );
    } finally {
      setVerifying(false);
    }
  };

  if (connected && publicKey) {
    const address = connectedAddress!;
    const truncated = `${address.slice(0, 4)}...${address.slice(-4)}`;

    return (
      <>
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
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(address);
                toast.success("Address copied");
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-2" />
              Copy address
            </DropdownMenuItem>
            {walletProfileQuery.isLoading ? (
              <DropdownMenuItem disabled>Checking linked wallet…</DropdownMenuItem>
            ) : walletProfileQuery.isError ? (
              <DropdownMenuItem onClick={() => void walletProfileQuery.refetch()}>
                Retry loading wallet status
              </DropdownMenuItem>
            ) : linkedAddress === address ? (
              <DropdownMenuItem disabled>Wallet linked to account</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => beginVerification(intent)}>
                {intent === "change" ? "Request wallet change" : "Verify and link wallet"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await disconnect();
                  toast.success("Wallet disconnected from this browser");
                } catch {
                  toast.error("Failed to disconnect wallet");
                }
              }}
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Disconnect from browser
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog
          open={verificationOpen}
          onOpenChange={(open) => {
            if (!verifying) setVerificationOpen(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {verificationIntent === "change"
                  ? "Request a wallet change?"
                  : "Verify and link this wallet?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {verificationIntent === "change"
                  ? "Your wallet will sign a free off-chain message proving ownership. This does not send a transaction or spend SOL. The new wallet will be submitted for review; your current wallet stays linked until approval."
                  : "Your wallet will sign a free off-chain message proving ownership. This does not send a transaction or spend SOL."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={verifying}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={verifying} onClick={confirmVerification}>
                {verifying ? "Verifying…" : "Sign and verify"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
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
