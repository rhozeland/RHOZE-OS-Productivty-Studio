import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Flame, Star, Zap, Trophy, Crown, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ── 5 titles stretched across 10 levels ── */
const TITLES = [
  { title: "Newcomer",    levels: [1],       icon: Zap,    color: "hsl(210 60% 55%)" },
  { title: "Contributor", levels: [2, 3],     icon: Star,   color: "hsl(175 70% 50%)" },
  { title: "Creator",     levels: [4, 5, 6],  icon: Flame,  color: "hsl(40 80% 50%)" },
  { title: "Builder",     levels: [7, 8],     icon: Trophy, color: "hsl(280 60% 60%)" },
  { title: "Pro",         levels: [9, 10],    icon: Crown,  color: "hsl(350 60% 55%)" },
];

const LEVEL_XP = [0, 20, 50, 100, 200, 350, 500, 750, 1000, 1500];

function getLevelFromXP(xp: number) {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
  }
  return level;
}

function getTitleForLevel(level: number) {
  return TITLES.find((t) => t.levels.includes(level)) ?? TITLES[0];
}

const CreatorJourney = () => {
  const { user } = useAuth();

  const { data: xpData } = useQuery({
    queryKey: ["creator-xp", user?.id],
    queryFn: async () => {
      const [{ count: proofCount }, { count: txCount }, streakRes] = await Promise.all([
        supabase.from("contribution_proofs").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("credit_transactions").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("type", "reward"),
        supabase.from("user_credits" as any).select("reward_streak").eq("user_id", user!.id).maybeSingle(),
      ]);
      const totalXP = (proofCount ?? 0) + (txCount ?? 0) * 2;
      return { totalXP, streak: (streakRes?.data as any)?.reward_streak ?? 0 };
    },
    enabled: !!user,
  });

  const totalXP = xpData?.totalXP ?? 0;
  const streak = xpData?.streak ?? 0;
  const currentLevel = getLevelFromXP(totalXP);
  const currentTitle = getTitleForLevel(currentLevel);
  const nextLevelXP = currentLevel < 10 ? LEVEL_XP[currentLevel] : LEVEL_XP[9];
  const prevLevelXP = LEVEL_XP[currentLevel - 1];
  const progressToNext = currentLevel >= 10
    ? 100
    : Math.min(100, ((totalXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center border-2"
            style={{ borderColor: currentTitle.color, background: `${currentTitle.color}15` }}
          >
            <currentTitle.icon className="h-5 w-5" style={{ color: currentTitle.color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground font-body">
              Level {currentLevel} · {currentTitle.title}
            </p>
            <p className="text-[11px] text-muted-foreground font-body">
              {totalXP} XP · {currentLevel < 10 ? `Next level: ${nextLevelXP} XP` : "Max level reached!"}
            </p>
          </div>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Flame className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">{streak}d streak</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <Progress value={progressToNext} className="h-2" />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground font-body">Lvl {currentLevel}</span>
          <span className="text-[10px] text-muted-foreground font-body">Lvl {Math.min(currentLevel + 1, 10)}</span>
        </div>
      </div>

      {/* Title roadmap — 5 titles stretched evenly */}
      <div className="grid grid-cols-5 gap-2">
        {TITLES.map((t) => {
          const highestLevel = t.levels[t.levels.length - 1];
          const lowestLevel = t.levels[0];
          const unlocked = currentLevel >= lowestLevel;
          const isCurrent = t.levels.includes(currentLevel);
          const rangeLabel = t.levels.length === 1 ? `Lvl ${t.levels[0]}` : `Lvl ${lowestLevel}–${highestLevel}`;

          return (
            <div
              key={t.title}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all text-center",
                isCurrent && "bg-primary/10 border border-primary/20",
                !unlocked && "opacity-40"
              )}
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={unlocked ? { background: `${t.color}20`, border: `1.5px solid ${t.color}` } : {}}
              >
                {unlocked ? (
                  <t.icon className="h-4 w-4" style={{ color: t.color }} />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <span className="text-[10px] font-bold text-foreground">{t.title}</span>
              <span className="text-[8px] text-muted-foreground">{rangeLabel}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default CreatorJourney;
