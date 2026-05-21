/**
 * FanRewardsPage — `/fan/rewards` (Fan mode, Prompt 3)
 *
 * Fan-facing rewards view. Reuses the same `<CreatorPassCard />` +
 * `<TierProgressCard />` blocks that already power the Creator Pass page
 * (single source of truth for balance / tier / progress), then layers a
 * fan-flavored "Ways to earn" list and a recent-activity feed using the
 * same `surface-card` + divide rows pattern as the existing activity preview.
 */
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Gift,
  Sparkles,
  Calendar as CalendarIcon,
  Mic,
  UserPlus,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import CreatorPassCard from "@/components/creators/CreatorPassCard";
import TierProgressCard from "@/components/creators/TierProgressCard";

const EARN_WAYS = [
  {
    icon: Sparkles,
    title: "Back a creator early",
    desc: "Subscribe before they blow up and earn for being on the list first.",
  },
  {
    icon: CalendarIcon,
    title: "Attend events",
    desc: "Show up to live shows, drops, and listening parties to stack $RHOZE.",
  },
  {
    icon: Mic,
    title: "Be active in Spaces",
    desc: "Join rooms, react, and contribute — the more you show up, the more you earn.",
  },
  {
    icon: UserPlus,
    title: "Refer new fans",
    desc: "Share your link — every fan you bring in pays you back in $RHOZE.",
  },
];

const FanRewardsPage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Rewards</h1>
          <p className="text-muted-foreground">Earn $RHOZE for showing up.</p>
        </div>
        <div className="surface-card text-center py-12 space-y-3">
          <p className="text-sm text-muted-foreground">
            Sign in to track your rewards.
          </p>
          <Link to="/auth" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Rewards</h1>
        <p className="text-muted-foreground">Your $RHOZE balance, tier, and recent activity.</p>
      </div>

      {/* Balance + tier — exactly the components used on Creator Pass */}
      <div className="space-y-4">
        <CreatorPassCard />
        <TierProgressCard />
      </div>

      {/* Ways to earn */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold text-foreground">How fans earn $RHOZE</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EARN_WAYS.map((w) => (
            <div key={w.title} className="surface-card p-4 flex items-start gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <w.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-foreground">{w.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{w.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <FanActivity userId={user.id} />
    </div>
  );
};

const FanActivity = ({ userId }: { userId: string }) => {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["fan-rewards-activity", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, amount, description, type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  return (
    <section className="surface-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRight className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-semibold text-foreground">Recent activity</h2>
        <Link
          to="/credits?tab=activity"
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (rows?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No activity yet — your earned and spent $RHOZE will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows!.map((tx: any) => {
            const amount = Number(tx.amount || 0);
            const isCredit = amount >= 0;
            return (
              <li key={tx.id} className="flex items-center gap-3 py-2.5">
                <div
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                    isCredit ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCredit ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tx.description || (isCredit ? "Earned $RHOZE" : "Spent $RHOZE")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    isCredit ? "text-green-600 dark:text-green-400" : "text-foreground"
                  }`}
                >
                  {isCredit ? "+" : ""}
                  {amount.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default FanRewardsPage;
