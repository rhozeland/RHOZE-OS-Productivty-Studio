import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Flame, Trophy, Sparkles } from "lucide-react";

export interface StreakInfo {
  current: number;
  longest: number;
  nextMilestone: number;
  lastMilestoneHit: number; // 0 if none yet
}

const MILESTONES = [3, 7, 14, 30, 60, 100];

const TIER = (n: number) => {
  if (n >= 100) return { label: "Legend", color: "from-purple-500 via-pink-500 to-amber-400" };
  if (n >= 60) return { label: "Mythic", color: "from-pink-500 via-rose-500 to-amber-400" };
  if (n >= 30) return { label: "Blazing", color: "from-amber-500 via-orange-500 to-red-500" };
  if (n >= 14) return { label: "On Fire", color: "from-amber-400 via-orange-400 to-rose-400" };
  if (n >= 7) return { label: "Hot", color: "from-amber-400 to-orange-500" };
  if (n >= 3) return { label: "Warming Up", color: "from-amber-300 to-amber-500" };
  return { label: "Spark", color: "from-amber-300 to-amber-400" };
};

export const computeClaimStreak = (
  claims: { created_at: string }[],
): StreakInfo => {
  if (!claims || claims.length === 0) {
    return { current: 0, longest: 0, nextMilestone: MILESTONES[0], lastMilestoneHit: 0 };
  }

  // Bucket claims into unique UTC day strings (YYYY-MM-DD)
  const days = new Set(
    claims.map((c) => new Date(c.created_at).toISOString().slice(0, 10)),
  );
  const sortedDays = Array.from(days).sort().reverse();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

  // Current streak: must include today OR yesterday to be active
  let current = 0;
  if (sortedDays[0] === today || sortedDays[0] === yesterday) {
    current = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diffDays = Math.round(
        (prev.getTime() - curr.getTime()) / 86400_000,
      );
      if (diffDays === 1) current++;
      else break;
    }
  }

  // Longest streak across history
  const ascDays = Array.from(days).sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < ascDays.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      const diff = Math.round(
        (new Date(ascDays[i]).getTime() -
          new Date(ascDays[i - 1]).getTime()) /
          86400_000,
      );
      run = diff === 1 ? run + 1 : 1;
    }
    if (run > longest) longest = run;
  }

  const nextMilestone =
    MILESTONES.find((m) => m > current) ?? MILESTONES[MILESTONES.length - 1];
  const lastMilestoneHit =
    [...MILESTONES].reverse().find((m) => current >= m) ?? 0;

  return { current, longest, nextMilestone, lastMilestoneHit };
};

const fireMilestoneConfetti = () => {
  const colors = ["#f59e0b", "#fbbf24", "#fde68a", "#ec4899", "#a855f7"];
  confetti({
    particleCount: 160,
    spread: 100,
    origin: { y: 0.5 },
    colors,
    scalar: 1.2,
    ticks: 220,
  });
  setTimeout(() => {
    confetti({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors });
    confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors });
  }, 250);
};

interface MilestoneOverlayProps {
  milestone: number;
  onClose: () => void;
}

const MilestoneOverlay = ({ milestone, onClose }: MilestoneOverlayProps) => {
  useEffect(() => {
    fireMilestoneConfetti();
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const tier = TIER(milestone);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-8 text-center overflow-hidden shadow-2xl"
      >
        <div className={`absolute -top-20 left-1/2 -translate-x-1/2 h-60 w-60 rounded-full bg-gradient-to-br ${tier.color} opacity-30 blur-3xl pointer-events-none`} />

        <motion.div
          initial={{ scale: 0.5, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
          className={`relative h-24 w-24 mx-auto mb-5 rounded-full bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-[0_0_50px_hsl(38_90%_55%/0.55)]`}
        >
          <Flame className="h-12 w-12 text-white drop-shadow" strokeWidth={2.4} />
        </motion.div>

        <p className="text-xs font-body uppercase tracking-[0.25em] text-muted-foreground mb-1">
          Streak Milestone
        </p>
        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="font-display text-5xl text-foreground mb-2 tabular-nums"
        >
          {milestone}-Day
        </motion.h2>
        <p
          className={`font-display text-lg bg-gradient-to-r ${tier.color} bg-clip-text text-transparent mb-3`}
        >
          {tier.label} Streak Unlocked
        </p>
        <p className="text-sm text-muted-foreground font-body leading-relaxed">
          You've claimed $RHOZE {milestone} days in a row. Keep the flame alive.
        </p>

        {/* Sparkle drift */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 0], y: [-5, -50, -90], x: (i - 2) * 18 }}
            transition={{ duration: 2, delay: 0.3 + i * 0.12, repeat: Infinity, repeatDelay: 0.8 }}
            className="absolute top-24 left-1/2 pointer-events-none"
          >
            <Sparkles className="h-3 w-3 text-amber-400" />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

interface RhozeStreakBadgeProps {
  streak: StreakInfo;
  className?: string;
}

const STORAGE_KEY = "rhoze_last_celebrated_milestone";

const RhozeStreakBadge = ({ streak, className }: RhozeStreakBadgeProps) => {
  const [overlayMilestone, setOverlayMilestone] = useState<number | null>(null);

  // Trigger overlay when a new milestone is reached (and hasn't been celebrated yet)
  useEffect(() => {
    if (streak.lastMilestoneHit <= 0) return;
    const lastCelebrated = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    if (streak.lastMilestoneHit > lastCelebrated) {
      setOverlayMilestone(streak.lastMilestoneHit);
      localStorage.setItem(STORAGE_KEY, String(streak.lastMilestoneHit));
    }
  }, [streak.lastMilestoneHit]);

  const tier = TIER(streak.current);
  const progress =
    streak.nextMilestone > 0
      ? Math.min(100, (streak.current / streak.nextMilestone) * 100)
      : 0;
  const isActive = streak.current > 0;

  return (
    <>
      <div
        className={`rounded-xl border border-border bg-card/60 p-4 ${className ?? ""}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`relative h-12 w-12 shrink-0 rounded-full flex items-center justify-center ${
              isActive ? `bg-gradient-to-br ${tier.color}` : "bg-muted"
            }`}
          >
            <Flame
              className={`h-6 w-6 ${isActive ? "text-white" : "text-muted-foreground"}`}
              strokeWidth={2.4}
            />
            {isActive && (
              <motion.span
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${tier.color} blur-md -z-10`}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-body">
                  Claim Streak
                </p>
                <p className="font-display text-2xl text-foreground leading-none mt-0.5 tabular-nums">
                  {streak.current}{" "}
                  <span className="text-xs font-body text-muted-foreground">
                    day{streak.current === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
              {isActive && (
                <span
                  className={`text-[10px] font-body font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${tier.color} text-white shrink-0`}
                >
                  {tier.label}
                </span>
              )}
            </div>

            {/* Progress to next milestone */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-body text-muted-foreground">
                <span>Next milestone</span>
                <span className="tabular-nums">
                  {streak.current}/{streak.nextMilestone}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`h-full rounded-full bg-gradient-to-r ${tier.color}`}
                />
              </div>
            </div>

            {streak.longest > 0 && (
              <p className="mt-2 text-[10px] text-muted-foreground font-body flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Longest streak:{" "}
                <span className="text-foreground font-semibold">
                  {streak.longest} day{streak.longest === 1 ? "" : "s"}
                </span>
              </p>
            )}

            {!isActive && (
              <p className="mt-2 text-[11px] text-muted-foreground font-body">
                Claim today to start a streak.
              </p>
            )}
          </div>
        </div>

        {/* Milestone tickers */}
        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          {MILESTONES.map((m) => {
            const reached = streak.current >= m;
            return (
              <span
                key={m}
                className={`text-[10px] font-body font-semibold px-2 py-0.5 rounded-full border ${
                  reached
                    ? `bg-gradient-to-r ${TIER(m).color} text-white border-transparent`
                    : "bg-card border-border text-muted-foreground"
                }`}
                title={`${m}-day milestone${reached ? " — unlocked" : ""}`}
              >
                {m}d
              </span>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {overlayMilestone !== null && (
          <MilestoneOverlay
            milestone={overlayMilestone}
            onClose={() => setOverlayMilestone(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default RhozeStreakBadge;
