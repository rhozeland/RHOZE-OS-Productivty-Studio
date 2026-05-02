/**
 * TrendingArtistsLane — Discover lane that surfaces Verified Artists with
 * active coins. Each card has a quick-swap CTA that links straight to the
 * coin's launch page (canonical TradePanel lives there).
 *
 * v7 fan→artist swap funnel: Discover is the discovery surface; profile
 * Coin tab + LaunchDetailPage remain the canonical trade venues.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import { ArrowRight, Coins, TrendingUp } from "lucide-react";

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

const TrendingArtistsLane = () => {
  const { data: items = [] } = useQuery({
    queryKey: ["discover-trending-artists"],
    queryFn: async () => {
      const { data: coins } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, image_url, creator_id, virtual_sol_reserves, virtual_token_reserves, updated_at")
        .in("status", ["live", "active", "graduated"])
        .order("updated_at", { ascending: false })
        .limit(20);

      if (!coins?.length) return [];

      const creatorIds = [...new Set(coins.map((c) => c.creator_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, headline, verification_status")
        .in("user_id", creatorIds);

      const verified = new Map(
        (profiles ?? [])
          .filter((p: any) => p.verification_status === "verified")
          .map((p: any) => [p.user_id, p]),
      );

      return coins
        .filter((c) => verified.has(c.creator_id))
        .slice(0, 6)
        .map((c) => {
          const p: any = verified.get(c.creator_id);
          const price =
            c.virtual_token_reserves > 0
              ? c.virtual_sol_reserves / c.virtual_token_reserves
              : 0;
          return { coin: c, profile: p, price };
        });
    },
  });

  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Trending artists
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Verified artists with live coins. Swap $RHOZE to back the ones you believe in.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(({ coin, profile, price }) => (
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
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile.display_name ?? profile.username ?? "Artist"}
                  </p>
                  <VerifiedArtistBadge status="verified" size="xs" showLabel={false} />
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
