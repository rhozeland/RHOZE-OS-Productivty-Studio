import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Flame, Star, Zap, Trophy, Crown, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const LEVELS = [
  { level: 1, title: "Newcomer", xp: 0, perk: "Access the Hub", icon: Zap, color: "hsl(210 60% 55%)" },
  { level: 2, title: "Contributor", xp: 20, perk: "Post listings", icon: Star, color: "hsl(175 70% 50%)" },
  { level: 3, title: "Creator", xp: 50, perk: "Create Drop Rooms", icon: Flame, color: "hsl(40 80% 50%)" },
  { level: 4, title: "Builder", xp: 100, perk: "Revenue sharing", icon: Flame, color: "hsl(30 90% 60%)" },
  { level: 5, title: "Pro", xp: 200, perk: "Featured profile", icon: Trophy, color: "hsl(280 60% 60%)" },
  { level: 6, title: "Expert", xp: 350, perk: "Priority bookings", icon: Trophy, color: "hsl(320 80% 60%)" },
  { level: 7, title: "Master", xp: 500, perk: "Exclusive circles", icon: Crown, color: "hsl(350 60% 55%)" },
  { level: 8, title: "Legend", xp: 750, perk: "Custom badges", icon: Crown, color: "hsl(150 55% 45%)" },
  { level: 9, title: "Visionary", xp: 1000, perk: "Curator rewards", icon: Crown, color: "hsl(280 80% 65%)" },
  { level: 10, title: "Founder", xp: 1500, perk: "All perks unlocked", icon: Crown, color: "hsl(40 80% 50%)" },
];

const CreatorJourney = () => {
  const { user } = useAuth();

  // Compute XP from contribution proofs count + credit transactions
  const { data: xpData } = useQuery({
    queryKey: ["creator-xp", user?.id],
    queryFn: async () => {
      const [{ count: proofCount }, { count: txCount }, { data: streak }] = await Promise.all([
        supabase.from("contribution_proofs").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("credit_transactions").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("type", "reward"),
        supabase.from("user_credits").select("reward_streak").eq("user_id", user!.id).maybeSingle(),
      ]);
      // 1 XP per contribution proof, 2 XP per reward transaction
      const totalXP = (proofCount ?? 0) + (txCount ?? 0) * 2;
      return { totalXP, streak: (streak?.data as any)?.reward_streak ?? 0 };
    },
    enabled: !!user,
  });

  const totalXP = xpData?.totalXP ?? 0;
  const streak = xpData?.streak ?? 0;

  // Determine current level
  const currentLevel = LEVELS.reduce((acc, l) => (totalXP >= l.xp ? l : acc), LEVELS[0]);
  const nextLevel = LEVELS.find((l) => l.xp > totalXP) ?? LEVELS[LEVELS.length - 1];
  const progressToNext = nextLevel.xp > currentLevel.xp
    ? Math.min(100, ((totalXP - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100)
    : 100;

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
            style={{ borderColor: currentLevel.color, background: `${currentLevel.color}15` }}
          >
            <currentLevel.icon className="h-5 w-5" style={{ color: currentLevel.color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground font-body">
              Level {currentLevel.level} · {currentLevel.title}
            </p>
            <p className="text-[11px] text-muted-foreground font-body">
              {totalXP} XP · Next: {nextLevel.title} ({nextLevel.xp} XP)
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
          <span className="text-[10px] text-muted-foreground font-body">Lvl {currentLevel.level}</span>
          <span className="text-[10px] text-muted-foreground font-body">Lvl {nextLevel.level}</span>
        </div>
      </div>

      {/* Level roadmap */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {LEVELS.map((level) => {
          const unlocked = totalXP >= level.xp;
          const isCurrent = level.level === currentLevel.level;
          return (
            <div
              key={level.level}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[56px] p-2 rounded-lg transition-all",
                isCurrent && "bg-primary/10 border border-primary/20",
                !unlocked && "opacity-40"
              )}
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center"
                style={unlocked ? { background: `${level.color}20`, border: `1.5px solid ${level.color}` } : {}}
              >
                {unlocked ? (
                  <level.icon className="h-3.5 w-3.5" style={{ color: level.color }} />
                ) : (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <span className="text-[9px] font-bold text-foreground whitespace-nowrap">{level.level}</span>
              <span className="text-[8px] text-muted-foreground whitespace-nowrap">{level.title}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default CreatorJourney;
