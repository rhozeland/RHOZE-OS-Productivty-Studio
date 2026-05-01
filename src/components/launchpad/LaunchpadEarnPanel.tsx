/**
 * LaunchpadEarnPanel — surfaces $RHOZE earning opportunities directly on
 * the Launchpad so traders/visitors immediately see how to accumulate
 * tokens (which then power trading + the gated Verified-IP launch flow).
 *
 * Mirrors RewardsDashboard's REWARD_ACTIONS catalog so amounts stay in
 * sync with the dashboard.
 *
 * Data:
 *   - Wallet $RHOZE balance via useRhozeBalance (if wallet connected)
 *   - Off-chain credits + reward streak from `user_credits`
 *
 * States handled:
 *   - Loading → skeleton placeholders for balance badges
 *   - Guest   → CTA prompting sign-in (no balance row)
 *   - Authed  → balance(s) + streak chip + grid of reward actions
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  type LucideIcon,
  Coins,
  Flame,
  Star,
  MessageSquare,
  Award,
  Zap,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { useRhozeBalance } from "@/hooks/useRhozeBalance";
import { useRewardStreak } from "@/hooks/useRewardStreak";
import { supabase } from "@/integrations/supabase/client";

interface RewardAction {
  label: string;
  reward: string;
  icon: LucideIcon;
  hint: string;
  featured?: boolean;
}

// Mirrors RewardsDashboard.REWARD_ACTIONS — keep amounts in sync.
const ACTIONS: RewardAction[] = [
  { label: "Post to Flow", reward: "+2", icon: Flame, hint: "Share work in your feed" },
  { label: "Get a Like / Save", reward: "+1", icon: Star, hint: "When others engage" },
  { label: "Leave a Review", reward: "+3", icon: MessageSquare, hint: "After a purchase" },
  {
    label: "Milestone Approved",
    reward: "+10",
    icon: Award,
    hint: "Project milestone shipped",
    featured: true,
  },
  { label: "Drop Room Post", reward: "+1", icon: Zap, hint: "Contribute in collabs" },
  { label: "7-Day Streak", reward: "+5", icon: TrendingUp, hint: "Daily login bonus" },
];

const formatBalance = (n: number, max = 0) =>
  n.toLocaleString(undefined, { maximumFractionDigits: max });

const creditsKey = (uid?: string) => ["launchpad-earn-credits", uid] as const;

const LaunchpadEarnPanel = () => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const { connected } = useWallet();
  const queryClient = useQueryClient();

  // Keep the daily login streak ticking while this panel is mounted.
  useRewardStreak();

  const { data: tokenInfo, isLoading: loadingToken, refetch: refetchToken } =
    useRhozeBalance();

  const {
    data: credits,
    isLoading: loadingCredits,
    refetch: refetchCredits,
  } = useQuery({
    queryKey: creditsKey(user?.id),
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_credits")
        .select("balance, reward_streak")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    // Re-pull when the tab regains focus so a reward earned elsewhere shows up.
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  // Realtime: any change to this user's credits row (balance/streak), a new
  // credit_transactions entry, or pending_rewards activity refreshes balances.
  useEffect(() => {
    if (!user) return;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: creditsKey(user.id) });
      refetchCredits();
      if (connected) refetchToken();
    };

    const channel = supabase
      .channel(`launchpad-earn:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${user.id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_rewards",
          filter: `user_id=eq.${user.id}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, connected, queryClient, refetchCredits, refetchToken]);

  const offChainBalance = Number(credits?.balance ?? 0);
  const onChainBalance = connected ? Number(tokenInfo?.balance ?? 0) : null;
  const streak = Number(credits?.reward_streak ?? 0);
  const showCreditsSkeleton = !!user && loadingCredits;
  const showWalletSkeleton = connected && loadingToken;

  return (
    <Card className="bg-gradient-to-br from-emerald-500/5 via-card/40 to-fuchsia-500/5 backdrop-blur border-border/60 overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* ── Header strip: title + (balances · streak) ───────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center shrink-0"
              aria-hidden
            >
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Earn $RHOZE
              </p>
              <p className="text-sm font-semibold leading-tight break-words">
                Trading fuel — earned by contributing.
              </p>
            </div>
          </div>

          {/* Balance row */}
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end shrink-0">
            {!user ? (
              <button
                type="button"
                onClick={() => requireAuth("Sign in to start earning $RHOZE.")}
                className="text-[11px] font-medium text-foreground hover:text-emerald-500 inline-flex items-center gap-1"
              >
                Sign in to start earning <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <>
                {showCreditsSkeleton ? (
                  <Skeleton className="h-5 w-16 rounded-full" />
                ) : (
                  <Badge
                    variant="outline"
                    className="font-mono gap-1 border-emerald-500/30 text-foreground"
                    title="Off-chain $RHOZE rewards (claimable to wallet)"
                  >
                    <Coins className="h-3 w-3 text-emerald-500" />
                    <span>{formatBalance(offChainBalance)}</span>
                    <span className="text-muted-foreground/80">credits</span>
                  </Badge>
                )}

                {connected &&
                  (showWalletSkeleton ? (
                    <Skeleton className="h-5 w-16 rounded-full" />
                  ) : (
                    <Badge
                      variant="outline"
                      className="font-mono gap-1 border-fuchsia-500/30 text-foreground"
                      title="On-chain $RHOZE in your wallet"
                    >
                      <Coins className="h-3 w-3 text-fuchsia-500" />
                      <span>{formatBalance(onChainBalance ?? 0, 2)}</span>
                      <span className="text-muted-foreground/80">wallet</span>
                    </Badge>
                  ))}

                {streak > 0 && (
                  <Badge
                    variant="outline"
                    className="font-mono gap-1 border-amber-500/40 text-amber-500"
                    title={`Current claim streak: ${streak} day${streak === 1 ? "" : "s"}`}
                  >
                    <Flame className="h-3 w-3" />
                    {streak}d
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Reward grid ─────────────────────────────────────────────── */}
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 list-none"
          aria-label="Ways to earn $RHOZE"
        >
          {ACTIONS.map(({ label, reward, icon: Icon, hint, featured }) => (
            <li
              key={label}
              className={`rounded-md border p-2.5 flex items-start gap-2 transition-colors ${
                featured
                  ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                  : "border-border/50 bg-card/40 hover:border-border"
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                  featured ? "text-emerald-500" : "text-muted-foreground"
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] font-medium truncate">{label}</p>
                  <span
                    className={`text-[10px] font-mono font-semibold shrink-0 tabular-nums ${
                      featured ? "text-emerald-500" : "text-foreground"
                    }`}
                  >
                    {reward}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* ── Footer link ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground">
            Every action contributes to your on-chain reputation.
          </p>
          <Link
            to="/dashboard?tab=rewards"
            className="text-[11px] font-medium text-foreground hover:text-emerald-500 inline-flex items-center gap-1 shrink-0"
          >
            See all rewards <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default LaunchpadEarnPanel;
