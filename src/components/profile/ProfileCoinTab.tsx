/**
 * ProfileCoinTab — embedded inside ProfileDetailPage's "Coin" tab.
 *
 * Behaviour:
 *  - If the creator has an active profile coin, render the bonding-curve
 *    chart + trade panel inline so investors can speculate without leaving
 *    the profile.
 *  - If not, and the visitor is the profile owner, surface a Launch CTA.
 *  - If not, and the visitor is anyone else, render an editorial empty
 *    state ("This creator hasn't launched a coin yet").
 *
 * Coins are profile-bound (one active per creator). The chart and trade
 * panel are the same components used by the legacy LaunchDetailPage.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import PriceChartCard from "@/components/launchpad/PriceChartCard";
import TradePanel from "@/components/launchpad/TradePanel";
import LaunchCoinDialog from "@/components/launchpad/LaunchCoinDialog";
import CreatorReadinessCard from "@/components/profile/CreatorReadinessCard";

interface Props {
  creatorId: string;
  isOwnProfile: boolean;
  defaultName?: string | null;
  defaultImage?: string | null;
  memberSince?: string | null;
}

const ProfileCoinTab = ({ creatorId, isOwnProfile, defaultName, defaultImage, memberSince }: Props) => {
  const [launchOpen, setLaunchOpen] = useState(false);

  const { data: coin, isLoading, refetch } = useQuery({
    queryKey: ["profile-coin", creatorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_launches")
        .select("*")
        .eq("creator_id", creatorId)
        .neq("status", "cancelled")
        // Profile coins (work_id IS NULL) take precedence; otherwise fall back
        // to the most recent legacy work-bound coin so they still surface.
        .order("work_id", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && (error as any).code !== "PGRST116") throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── No coin yet ──────────────────────────────────────────────
  if (!coin) {
    return (
      <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Coins className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {isOwnProfile ? "Launch your profile coin" : "No coin yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {isOwnProfile
              ? "Mint a coin tied to your profile so collectors can back your career. The bonding curve and trade panel will live right here."
              : "This creator hasn't launched a coin yet. Their work, events, and contributions are still your best signal."}
          </p>
        </div>
        {isOwnProfile && (
          <Button onClick={() => setLaunchOpen(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Launch coin
          </Button>
        )}
        <LaunchCoinDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          defaultName={defaultName ?? undefined}
          defaultImage={defaultImage ?? undefined}
          onLaunched={() => refetch()}
        />
      </div>
    );
  }

  // ── Coin exists — chart + trade panel ────────────────────────
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4 flex items-center gap-3">
        {coin.image_url ? (
          <img src={coin.image_url} alt="" className="h-12 w-12 rounded-md object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-md bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center">
            <Coins className="h-5 w-5 text-emerald-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-base">${coin.ticker}</span>
            {coin.status === "graduated" && (
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500">
                Graduated
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{coin.name}</p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          <span className="font-mono">
            {Number(coin.real_sol_reserves).toFixed(2)} / {coin.graduation_sol_target} SOL
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PriceChartCard
            launchId={coin.id}
            ticker={coin.ticker}
            realSolReserves={Number(coin.real_sol_reserves)}
            graduationTarget={Number(coin.graduation_sol_target)}
          />
        </div>
        <div>
          <TradePanel
            launchId={coin.id}
            ticker={coin.ticker}
            status={coin.status}
            virtualSol={Number(coin.virtual_sol_reserves)}
            virtualToken={Number(coin.virtual_token_reserves)}
            onTraded={() => refetch()}
          />
        </div>
      </div>

      {coin.description && (
        <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{coin.description}</p>
        </div>
      )}
    </div>
  );
};

export default ProfileCoinTab;
