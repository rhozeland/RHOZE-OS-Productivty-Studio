/**
 * CreatorDropsCatalog — lists every coin (launch) the creator has dropped,
 * each card linking to the dedicated `/coin/:ticker` page.
 *
 * Note (v9.5): the in-card "Launch a drop / Launch another drop" CTAs were
 * removed. Launching a coin now lives in the global post composer ("New
 * post" → Coin), so this component only renders the catalog + an empty
 * state message.
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

  if (!drops || drops.length === 0) {
    return (
      <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-6 text-center space-y-3">
        <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Coins className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">No launches yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            {isOwnProfile
              ? "Use the post button to start a new launch — fans can then back you and share in the upside."
              : "This creator hasn't launched any coins yet."}
          </p>
        </div>
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
