/**
 * CreatorDropsCatalog — replaces the old single "artist token" card on the
 * profile Support tab. Lists every coin (drop) the creator has launched,
 * each card linking to the dedicated `/coin/:ticker` page.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins } from "lucide-react";
import DropCoinCard, { DropCoin } from "@/components/launchpad/DropCoinCard";

interface Props {
  creatorId: string;
  isOwnProfile: boolean;
}

const CreatorDropsCatalog = ({ creatorId, isOwnProfile }: Props) => {
  const { data: drops, isLoading } = useQuery({
    queryKey: ["creator-drops", creatorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select(
          "id, ticker, name, image_url, status, virtual_sol_reserves, virtual_token_reserves, total_supply, event_id, space_id, events(title), studios(name)"
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

  if (!drops || drops.length === 0) {
    return (
      <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-6 text-center space-y-2">
        <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Coins className="h-5 w-5 text-emerald-500" />
        </div>
        <h3 className="font-display text-base font-semibold text-foreground">No drops yet</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {isOwnProfile
            ? "Launch a coin from one of your events or spaces to start raising support."
            : "This creator hasn't dropped any coins yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {drops.map((c) => (
        <DropCoinCard key={c.id} coin={c as DropCoin} />
      ))}
    </div>
  );
};

export default CreatorDropsCatalog;
