/**
 * TierProgressCard — replaces static tier range labels with a live progress
 * card: current tier badge + progress bar to next tier + 3 quick earn actions.
 *
 * Reads the user's in-app $RHOZE balance from `user_credits.balance` (the
 * canonical tier source per v8.1).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Calendar, Users, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIERS, getHoldTier, type TierId } from "@/lib/tier-matrix";
import { cn } from "@/lib/utils";
import PostMenuButton from "@/components/PostMenuButton";

interface EarnAction {
  label: string;
  reward: string;
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: "post";
}

const EARN_ACTIONS: EarnAction[] = [
  { label: "Post Work", reward: "+10 $RHOZE", action: "post", icon: Sparkles },
  { label: "Attend Event", reward: "+25 $RHOZE", to: "/events", icon: Calendar },
  { label: "Complete Collab", reward: "+50 $RHOZE", to: "/messages?tab=projects", icon: Users },
];

const formatRhoze = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
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

  const currentTierId: TierId = getHoldTier(balance);
  const currentIdx = TIERS.findIndex((t) => t.id === currentTierId);
  const current = TIERS[currentIdx];
  const next = TIERS[currentIdx + 1] ?? null;

  const progressPct = next
    ? Math.min(100, Math.max(0, ((balance - current.hold) / (next.hold - current.hold)) * 100))
    : 100;
  const remaining = next ? Math.max(0, next.hold - balance) : 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-5 sm:p-6 space-y-5",
        className,
      )}
    >
      {/* Current tier + progress */}
      <div className="flex items-start gap-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="h-14 w-14 rounded-2xl shrink-0 ring-1 ring-white/20 shadow-md flex items-center justify-center"
          style={{ background: current.gradient }}
          aria-hidden
        >
          <Trophy className="h-6 w-6 text-white drop-shadow" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Current Tier
            </p>
            <h3 className="font-display text-2xl font-bold text-foreground leading-none">
              {current.label}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            Holding {formatRhoze(balance)} $RHOZE
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {next ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {formatRhoze(remaining)} $RHOZE
              </span>{" "}
              to reach{" "}
              <span className="font-semibold text-foreground">{next.label}</span>
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
            <span>{current.label}</span>
            <span>{next.label}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Top tier reached — you're at <span className="font-semibold text-foreground">{current.label}</span>.
          Keep stacking $RHOZE to unlock more drops.
        </div>
      )}

      {/* Earn actions */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-2">
          Earn more, faster
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {EARN_ACTIONS.map((action) => {
            const inner = (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <action.icon className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {action.label}
                    </p>
                    <p className="text-[10px] text-primary tabular-nums">
                      {action.reward}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
              </>
            );
            const className =
              "group flex items-center justify-between gap-2 rounded-xl border border-border bg-card hover:border-foreground/30 hover:bg-muted/40 transition-all px-3 py-2.5 cursor-pointer w-full text-left";
            if (action.action === "post") {
              return (
                <PostMenuButton
                  key={action.label}
                  trigger={<div className={className}>{inner}</div>}
                />
              );
            }
            return (
              <Link key={action.label} to={action.to!} className={className}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TierProgressCard;
