/**
 * TrendingArtistsLane — Discover lane that surfaces Verified Artists with
 * active coins, ranked by a real trending score.
 *
 * Trending score (per coin) =
 *   (24h $RHOZE swap volume)            // commerce signal
 *   + (24h unique buyers × 5)           // holder growth signal
 *   + (24h net buys × 2)                // momentum signal
 *
 * Data sources: coin_swap_ledger (24h window) + coin_holdings (current
 * holder count for tie-break). Falls back to recency when no swaps in 24h.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import RegionChip from "@/components/profile/RegionChip";
import { getRegion, type RegionMarket } from "@/lib/regions";
import { ArrowRight, Coins, TrendingUp, Users } from "lucide-react";

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

interface TrendingArtistsLaneProps {
  marketFilter?: RegionMarket | "All";
}

const TrendingArtistsLane = ({ marketFilter = "All" }: TrendingArtistsLaneProps) => {
  const { data: items = [] } = useQuery({
    queryKey: ["discover-trending-artists-v2"],
    queryFn: async () => {
      // Pull live coins
      const { data: coins } = await supabase
        .from("coin_launches")
        .select(
          "id, ticker, name, image_url, creator_id, virtual_sol_reserves, virtual_token_reserves, updated_at",
        )
        .in("status", ["live", "active", "graduated"])
        .order("updated_at", { ascending: false })
        .limit(50);

      if (!coins?.length) return [];

      const launchIds = coins.map((c) => c.id);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 24h swap activity
      const { data: swaps } = await supabase
        .from("coin_swap_ledger")
        .select("launch_id, side, rhoze_amount, user_id, created_at")
        .in("launch_id", launchIds)
        .gte("created_at", since);

      // Current holder counts
      const { data: holdings } = await supabase
        .from("coin_holdings")
        .select("launch_id, trader_id, balance")
        .in("launch_id", launchIds)
        .gt("balance", 0);

      // Aggregate per-launch metrics
      const stats = new Map<
        string,
        { volume: number; buyers: Set<string>; netBuys: number; holders: number }
      >();
      launchIds.forEach((id) =>
        stats.set(id, { volume: 0, buyers: new Set(), netBuys: 0, holders: 0 }),
      );

      (swaps ?? []).forEach((s: any) => {
        const row = stats.get(s.launch_id);
        if (!row) return;
        row.volume += Number(s.rhoze_amount ?? 0);
        if (s.side === "buy") {
          row.buyers.add(s.user_id);
          row.netBuys += 1;
        } else {
          row.netBuys -= 1;
        }
      });
      (holdings ?? []).forEach((h: any) => {
        const row = stats.get(h.launch_id);
        if (row) row.holders += 1;
      });

      // Verified artists only
      const creatorIds = [...new Set(coins.map((c) => c.creator_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, headline, verification_status, region_code")
        .in("user_id", creatorIds);
      const verified = new Map(
        (profiles ?? [])
          .filter((p: any) => p.verification_status === "verified")
          .map((p: any) => [p.user_id, p]),
      );

      const scored = coins
        .filter((c) => verified.has(c.creator_id))
        .map((c) => {
          const s = stats.get(c.id)!;
          const score =
            s.volume + s.buyers.size * 5 + Math.max(0, s.netBuys) * 2;
          const price =
            c.virtual_token_reserves > 0
              ? c.virtual_sol_reserves / c.virtual_token_reserves
              : 0;
          return {
            coin: c,
            profile: verified.get(c.creator_id) as any,
            price,
            score,
            volume: s.volume,
            buyers24h: s.buyers.size,
            holders: s.holders,
          };
        });

      // Sort by score; break ties with recency
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (
          new Date(b.coin.updated_at).getTime() -
          new Date(a.coin.updated_at).getTime()
        );
      });

      return scored;
    },
    staleTime: 60_000,
  });

  // Apply market filter client-side so the lane re-filters instantly
  // without re-querying when the user clicks a region chip.
  const filtered = items
    .filter(({ profile }: any) => {
      if (marketFilter === "All") return true;
      const region = getRegion(profile?.region_code);
      return region?.market === marketFilter;
    })
    .slice(0, 6);

  if (!filtered.length) {
    if (marketFilter !== "All") {
      return (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Trending artists
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              No verified artists in <span className="font-medium">{marketFilter}</span> are trending right now. Try another region.
            </p>
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Trending artists
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Ranked by 24h $RHOZE volume + new holders. Swap to back the ones rising fastest.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(({ coin, profile, price, volume, buyers24h, holders }) => (
          <div
            key={coin.id}
            className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback>{initials(profile.display_name ?? profile.username)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile.display_name ?? profile.username ?? "Artist"}
                  </p>
                  <VerifiedArtistBadge status="verified" size="xs" showLabel={false} />
                  <RegionChip code={profile.region_code} />
                </div>
                {profile.headline && (
                  <p className="text-xs text-muted-foreground truncate">{profile.headline}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold">${coin.ticker}</span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {price > 0 ? price.toFixed(6) : "—"} $RHOZE
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {volume > 0 ? `${volume.toFixed(0)} vol/24h` : "no 24h vol"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {buyers24h > 0 ? `+${buyers24h} new` : `${holders} holders`}
              </span>
            </div>

            <Button asChild size="sm" className="w-full">
              <Link to={`/launchpad/${coin.id}`}>
                Swap $RHOZE → ${coin.ticker} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrendingArtistsLane;
