import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import ClaimLimitsControl from "@/components/settings/ClaimLimitsControl";
import WalletButton from "@/components/WalletButton";

/**
 * Self-contained wallet info panel — reused inside the Vault "Wallet" lightbox.
 * Shows the connected Solana wallet (or empty state) and the claim safety
 * limits control. Wallet binding is intentionally 1:1 and locked on connect
 * — disconnect here only unlinks it from the profile.
 */
const WalletInfoPanel = () => {
  const { user } = useAuth();
  const { connected } = useWallet();

  const walletProfileQuery = useQuery({
    queryKey: ["wallet-binding", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_private_profile_fields");
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Could not load your linked wallet.");

      return { walletAddress: row.wallet_address || null };
    },
  });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          One verified wallet is linked per account. To change it, connect the replacement wallet and choose “Request wallet change” from the wallet menu; the request requires admin approval.
        </p>
        {walletProfileQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking linked wallet…</p>
        ) : walletProfileQuery.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">Could not load your linked wallet.</p>
            <button
              type="button"
              className="text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => void walletProfileQuery.refetch()}
            >
              Try again
            </button>
          </div>
        ) : walletProfileQuery.data?.walletAddress ? (
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-muted px-3 py-2 rounded-lg flex-1 truncate">
              {walletProfileQuery.data.walletAddress}
            </code>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3">
            <p className="text-sm text-foreground font-medium">No wallet connected</p>
            <p className="text-xs text-muted-foreground">
              {connected
                ? "Your wallet is connected in this browser but isn't linked to your Rhozeland account yet. Open the wallet menu and choose “Verify and link wallet.”"
                : "Link Phantom, Solflare, or Backpack to claim $RHOZE and trade Artist Shares. You'll sign a free off-chain message to verify ownership."}
            </p>
            <WalletButton />
          </div>
        )}
      </div>
      <Separator />
      <ClaimLimitsControl />
    </div>
  );
};

export default WalletInfoPanel;
