/**
 * CreatorDropsCatalog — replaces the old single "artist token" card on the
 * profile Support tab. Lists every coin (drop) the creator has launched,
 * each card linking to the dedicated `/coin/:ticker` page.
 *
 * For the profile owner (when verified) we also surface a "Launch a drop"
 * CTA — both as a primary button on the empty state and as a secondary
 * action above the grid when drops already exist. Standalone drops are
 * supported (no event/space binding required).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Sparkles, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import DropCoinCard, { DropCoin } from "@/components/launchpad/DropCoinCard";
import LaunchCoinDialog from "@/components/launchpad/LaunchCoinDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useArtistVerification } from "@/hooks/useArtistVerification";

interface Props {
  creatorId: string;
  isOwnProfile: boolean;
}

const CreatorDropsCatalog = ({ creatorId, isOwnProfile }: Props) => {
  const { user } = useAuth();
  const { data: verif } = useArtistVerification(isOwnProfile ? user?.id : null);
  const isVerified = verif?.verified ?? false;
  const [open, setOpen] = useState(false);

  const { data: drops, isLoading, refetch } = useQuery({
    queryKey: ["creator-drops", creatorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select(
          "id, ticker, name, image_url, status, virtual_sol_reserves, virtual_token_reserves, mint_address, total_supply, event_id, space_id, events(title), studios(name)"
        )
        .eq("creator_id", creatorId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  if (isLoading) {
    return <div className="rounded-2xl bg-card/60 border border-border/50 p-6 animate-pulse h-32" />;
  }

  const launchDialog = (
    <LaunchCoinDialog
      open={open}
      onOpenChange={setOpen}
      onLaunched={() => refetch()}
    />
  );

  if (!drops || drops.length === 0) {
    return (
      <>
        <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-6 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Coins className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">No drops yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {isOwnProfile
                ? "Launch a coin so fans can back you and share in the upside."
                : "This creator hasn't dropped any coins yet."}
            </p>
          </div>
          {isOwnProfile && (
            isVerified ? (
              <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
                <Sparkles className="h-4 w-4" /> Launch a drop
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link to="/settings/verification">
                  <BadgeCheck className="h-4 w-4" /> Verify to launch a drop
                </Link>
              </Button>
            )
          )}
        </div>
        {isOwnProfile && isVerified && launchDialog}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {drops.map((c) => (
          <DropCoinCard key={c.id} coin={c as DropCoin} />
        ))}
      </div>
    </div>
  );
};

export default CreatorDropsCatalog;
