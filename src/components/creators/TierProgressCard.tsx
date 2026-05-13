/**
 * TierProgressCard — compact, single-row progress strip.
 *
 * v9.5: Collapsed the previous two-card grid (tier progress + streak) into
 * one less-tall surface. Tier identity already lives on the holographic
 * CreatorPassCard above, so this row leads with the progress bar and tucks
 * the daily streak inline on the right. The "Earn more, faster" trio was
 * removed — NextStepCard above and the activity timeline below cover those
 * CTAs more contextually.
 *
 * Reads in-app $RHOZE balance from `user_credits.balance` (canonical tier
 * source per v8.1) and the streak from `user_streaks`.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIERS, getHoldTier, type TierId } from "@/lib/tier-matrix";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const formatRhoze = (n: number) => {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 || n % 1_000_000 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    // Avoid "1000k" — escalate to M when rounding crosses the threshold.
    if (k >= 999.5) return "1M";
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return Math.round(n).toLocaleString();
};

export const TierProgressCard = ({ className }: { className?: string }) => {
  const { user } = useAuth();

  const { data: balance = 0 } = useQuery({
    queryKey: ["tier-progress-balance", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
    enabled: !!user,
  });

  // Streak (kept inline so we don't need a second card).
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_streaks")
        .select("current_streak, longest_streak")
        .eq("user_id", user.id)
        .maybeSingle();
      setStreak({
        current: data?.current_streak ?? 0,
        longest: data?.longest_streak ?? 0,
      });
    })();
  }, [user]);

  const currentTierId: TierId = getHoldTier(balance);
  const currentIdx = TIERS.findIndex((t) => t.id === currentTierId);
  const current = TIERS[currentIdx];
  const next = TIERS[currentIdx + 1] ?? null;

  const progressPct = next
    ? Math.min(100, Math.max(0, ((balance - current.hold) / (next.hold - current.hold)) * 100))
    : 100;
  const remaining = next ? Math.max(0, next.hold - balance) : 0;

  const currentStreak = streak?.current ?? 0;
  const longestStreak = streak?.longest ?? 0;
  const toNext = currentStreak === 0 ? 7 : 7 - (currentStreak % 7 || 7);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-5 py-4 sm:px-6 sm:py-5",
        "flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8",
        className,
      )}
    >
      {/* ── Progress to next tier ── */}
      <div className="flex-1 min-w-0 space-y-2">
        {next ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">
                  {formatRhoze(remaining)} $RHOZE
                </span>{" "}
                to <span className="font-semibold text-foreground">{next.label}</span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {Math.round(progressPct)}%
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: next.gradient }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground/80 tabular-nums">
              <span>{current.label} · holding {formatRhoze(balance)}</span>
              <span>{next.label}</span>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            Top tier reached — you're at <span className="font-semibold text-foreground">{current.label}</span>.
          </div>
        )}
      </div>

      {/* ── Streak (inline, no second card) ── */}
      <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-6 shrink-0">
        <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
          <Flame className="h-4 w-4 text-amber-500" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">
            {currentStreak === 0 ? (
              "No streak yet"
            ) : (
              <>
                {currentStreak}-day streak
                <span className="text-muted-foreground font-normal"> · longest {longestStreak}</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            {currentStreak === 0 ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="underline decoration-dotted underline-offset-2 cursor-help">
                      Sign in + interact
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs font-body">
                    Drop a note, message a creator, or attend an event
                  </TooltipContent>
                </Tooltip>{" "}
                — every 7d = 5 $RHOZE
              </>
            ) : (
              `${toNext} day${toNext === 1 ? "" : "s"} until next 5 $RHOZE drop`
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TierProgressCard;
