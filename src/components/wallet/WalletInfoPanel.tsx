import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ClaimLimitsControl from "@/components/settings/ClaimLimitsControl";
import WalletButton from "@/components/WalletButton";
import { toast } from "sonner";

/**
 * Self-contained wallet info panel — reused inside the Vault "Wallet" lightbox.
 * Shows the connected Solana wallet (or empty state) and the claim safety
 * limits control. Wallet binding is intentionally 1:1 and locked on connect
 * — disconnect here only unlinks it from the profile.
 */
const WalletInfoPanel = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["wallet-panel-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as { wallet_address: string | null } | null;
    },
  });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          One wallet per account, bound on first connect. Disconnect here to re-link a different one.
        </p>
        {profile?.wallet_address ? (
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-muted px-3 py-2 rounded-lg flex-1 truncate">
              {profile.wallet_address}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase
                  .from("profiles")
                  .update({ wallet_address: null } as any)
                  .eq("user_id", user!.id);
                qc.invalidateQueries({ queryKey: ["wallet-panel-profile"] });
                qc.invalidateQueries({ queryKey: ["my-profile"] });
                toast.success("Wallet disconnected");
              }}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3">
            <p className="text-sm text-foreground font-medium">No wallet connected</p>
            <p className="text-xs text-muted-foreground">
              Connect a Solana wallet (Phantom, Solflare, Backpack…) to enable cash outs,
              on-chain claims, and Artist Share trades. Your wallet is bound 1:1 to your account
              the first time you connect.
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
