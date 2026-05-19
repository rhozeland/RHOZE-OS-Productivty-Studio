/**
 * ProfileCoinTab — v9.8 (A4): speculation chrome stripped.
 *
 * Default view = `<ProfileBackersPanel />` style:
 *   - Backer count + momentum %
 *   - "Back {Name}" primary CTA (opens BackCreatorSheet)
 *   - Quiet "View market →" link toggles the legacy chart + trade panel
 *     for power users who actually want to trade.
 *
 * No price chart, no mint address, no bonding-curve language by default.
 * Owner empty-state keeps the Launch Shares CTA.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Coins,
  Loader2,
  Sparkles,
  TrendingUp,
  Users,
  ArrowRight,
  LineChart,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PriceChartCard from "@/components/launchpad/PriceChartCard";
import TradePanel from "@/components/launchpad/TradePanel";
import LaunchCoinDialog from "@/components/launchpad/LaunchCoinDialog";
import CreatorReadinessCard from "@/components/profile/CreatorReadinessCard";
import BackCreatorSheet from "@/components/profile/BackCreatorSheet";

interface Props {
  creatorId: string;
  isOwnProfile: boolean;
  defaultName?: string | null;
  defaultImage?: string | null;
  memberSince?: string | null;
  /** Hide the embedded readiness card (it now lives in Overview). */
  showReadiness?: boolean;
}

const ProfileCoinTab = ({
  creatorId,
  isOwnProfile,
  defaultName,
  defaultImage,
  memberSince,
  showReadiness = true,
}: Props) => {
  const [launchOpen, setLaunchOpen] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);

  const { data: coin, isLoading, refetch } = useQuery({
    queryKey: ["profile-coin", creatorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_launches")
        .select("*")
        .eq("creator_id", creatorId)
        .neq("status", "cancelled")
        .order("work_id", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && (error as any).code !== "PGRST116") throw error;
      return data;
    },
  });

  const { data: backerCount } = useQuery({
    queryKey: ["profile-coin-backers", coin?.id],
    enabled: !!coin?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("coin_holdings")
        .select("trader_id", { count: "exact", head: true })
        .eq("launch_id", coin!.id)
        .gt("balance", 0);
      return count ?? 0;
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
      <div className="space-y-4">
        {showReadiness && (
          <CreatorReadinessCard creatorId={creatorId} memberSince={memberSince} />
        )}
        <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-6 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Coins className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {isOwnProfile ? "Open backing for your profile" : "Not open for backing yet"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {isOwnProfile
                ? "Let fans back you with a few dollars each — they unlock your private feed, you get the upside."
                : "This creator hasn't opened backing yet."}
            </p>
          </div>
          {isOwnProfile && (
            <Button onClick={() => setLaunchOpen(true)} size="sm" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Open backing
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
      </div>
    );
  }

  // ── Coin exists — backer-first summary ───────────────────────
  const momentumPct =
    (Number(coin.real_sol_reserves) /
      Math.max(Number(coin.graduation_sol_target), 1e-9)) *
    100;
  const displayName = defaultName ?? "this creator";

  return (
    <div className="space-y-4">
      {showReadiness && (
        <CreatorReadinessCard creatorId={creatorId} memberSince={memberSince} />
      )}

      {/* Backers summary card */}
      <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-fuchsia-500/20 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Backers
            </p>
            <p className="font-display text-2xl font-bold leading-tight">
              {(backerCount ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              People backing {displayName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 justify-end">
              <TrendingUp className="h-3 w-3" /> Momentum
            </p>
            <p className="font-display text-2xl font-bold leading-tight text-emerald-500">
              {momentumPct.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Momentum bar */}
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500 transition-all"
              style={{ width: `${Math.min(100, momentumPct)}%` }}
            />
          </div>
        </div>

        {!isOwnProfile && (
          <Button
            className="w-full gap-1.5"
            size="lg"
            onClick={() => setBackOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Back {displayName}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}

        {/* Quiet escape hatch for power users / the creator themselves */}
        <button
          type="button"
          onClick={() => setMarketOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          <LineChart className="h-3 w-3" />
          {marketOpen ? (
            <>
              Hide market view <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>View market →</>
          )}
        </button>
      </div>

      {coin.description && (
        <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {coin.description}
          </p>
        </div>
      )}

      {/* Power-user market view — folded by default */}
      {marketOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="lg:col-span-2">
            <PriceChartCard launchId={coin.id} ticker={coin.ticker} />
          </div>
          <div>
            <TradePanel
              launchId={coin.id}
              ticker={coin.ticker}
              status={coin.status}
              virtualSol={Number(coin.virtual_sol_reserves)}
              virtualToken={Number(coin.virtual_token_reserves)}
              creatorFeeBps={Number(coin.creator_fee_bps ?? 200)}
              platformFeeBps={Number(coin.platform_fee_bps ?? 100)}
              onTraded={() => refetch()}
            />
          </div>
        </div>
      )}

      <BackCreatorSheet
        open={backOpen}
        onOpenChange={setBackOpen}
        artistId={creatorId}
        artistName={defaultName}
      />
    </div>
  );
};

export default ProfileCoinTab;
