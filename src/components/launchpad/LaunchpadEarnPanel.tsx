/**
 * LaunchpadEarnPanel — surfaces $RHOZE earning opportunities directly on
 * the Launchpad so traders/visitors immediately see how to accumulate
 * tokens (which then power trading + the gated Verified-IP launch flow).
 *
 * Uses the same REWARD_ACTIONS catalog rendered in the Dashboard's
 * RewardsDashboard so the source of truth stays consistent.
 *
 * Data:
 *   - Wallet $RHOZE balance via useRhozeBalance (if connected)
 *   - Off-chain credits + reward streak from `user_credits`
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import {
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
import { useAuth } from "@/contexts/AuthContext";
import { useRhozeBalance } from "@/hooks/useRhozeBalance";
import { supabase } from "@/integrations/supabase/client";

// Mirrors RewardsDashboard.REWARD_ACTIONS — keep amounts in sync.
const ACTIONS = [
  { label: "Post to Flow", reward: "+2", icon: Flame, hint: "Share work in your feed" },
  { label: "Get a Like / Save", reward: "+1", icon: Star, hint: "When others engage" },
  { label: "Leave a Review", reward: "+3", icon: MessageSquare, hint: "After a purchase" },
  { label: "Milestone Approved", reward: "+10", icon: Award, hint: "Project milestone shipped", featured: true },
  { label: "Drop Room Post", reward: "+1", icon: Zap, hint: "Contribute in collabs" },
  { label: "7-Day Streak", reward: "+5", icon: TrendingUp, hint: "Daily login bonus" },
];

const LaunchpadEarnPanel = () => {
  const { user } = useAuth();
  const { connected } = useWallet();
  const { data: tokenInfo } = useRhozeBalance();

  const { data: credits } = useQuery({
    queryKey: ["launchpad-earn-credits", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_credits")
        .select("balance, reward_streak")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const onChainBalance = connected ? Number(tokenInfo?.balance ?? 0) : null;
  const offChainBalance = Number(credits?.balance ?? 0);
  const streak = Number(credits?.reward_streak ?? 0);

  return (
    <Card className="bg-gradient-to-br from-emerald-500/5 via-card/40 to-fuchsia-500/5 backdrop-blur border-border/60 overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Header strip with balance + streak */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Earn $RHOZE
              </p>
              <p className="text-sm font-semibold leading-tight">
                Trading fuel — earned by contributing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <Badge
                variant="outline"
                className="font-mono gap-1 border-emerald-500/30 text-foreground"
                title="Off-chain reward balance (claimable to wallet)"
              >
                <Coins className="h-3 w-3 text-emerald-500" />
                {offChainBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Badge>
            )}
            {onChainBalance !== null && (
              <Badge
                variant="outline"
                className="font-mono gap-1 border-fuchsia-500/30 text-foreground"
                title="On-chain $RHOZE in your wallet"
              >
                <Coins className="h-3 w-3 text-fuchsia-500" />
                {onChainBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Badge>
            )}
            {streak > 0 && (
              <Badge
                variant="outline"
                className="font-mono gap-1 border-amber-500/40 text-amber-500"
                title="Current reward streak"
              >
                <Flame className="h-3 w-3" />
                {streak}d
              </Badge>
            )}
          </div>
        </div>

        {/* Reward grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ACTIONS.map(({ label, reward, icon: Icon, hint, featured }) => (
            <div
              key={label}
              className={`rounded-md border p-2.5 flex items-start gap-2 ${
                featured
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-border/50 bg-card/40"
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                  featured ? "text-emerald-500" : "text-muted-foreground"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <p className="text-[11px] font-medium truncate">{label}</p>
                  <span
                    className={`text-[10px] font-mono font-semibold shrink-0 ${
                      featured ? "text-emerald-500" : "text-foreground"
                    }`}
                  >
                    {reward}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer link */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
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
