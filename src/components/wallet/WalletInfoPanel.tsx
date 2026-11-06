import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import ClaimLimitsControl from "@/components/settings/ClaimLimitsControl";
import WalletButton from "@/components/WalletButton";

/**
 * Self-contained wallet info panel — reused inside the Vault "Wallet" lightbox.
 * Shows the connected Solana wallet (or empty state) and the claim safety
 * limits control. Wallet binding is intentionally 1:1 and locked once
 * verified; switching goes through an admin-approved change request.
 */
const WalletInfoPanel = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["wallet-panel-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_private_profile_fields");
      const row = data?.[0];
      return row ? { wallet_address: row.wallet_address || null } : null;
    },
  });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          One wallet per account, locked once verified. To switch, connect the new wallet and choose “Request wallet change” from the Wallet menu.
        </p>
        {profile?.wallet_address ? (
          <code className="block text-xs font-mono bg-muted px-3 py-2 rounded-lg truncate">
            {profile.wallet_address}
          </code>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3">
            <p className="text-sm text-foreground font-medium">No wallet connected</p>
            <p className="text-xs text-muted-foreground">
              Link Phantom, Solflare, or Backpack to claim $RHOZE and trade Artist Shares. Bound 1:1 to your account on first connect.
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
