import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorXP } from "@/hooks/useCreatorXP";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Compact HUD rendered inside the left sidebar footer — replaces the
 * floating bottom dock. Shows level orb, XP progress, streak, and
 * $RHOZE balance. Adapts to collapsed (icon-only) sidebar.
 */
const SidebarHud = () => {
  const { user } = useAuth();
  const { data: xp } = useCreatorXP();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  if (!user) return null;

  const tierColor = xp?.titleColor ?? "210 60% 55%";
  const level = xp?.level ?? 1;
  const title = xp?.title ?? "Newcomer";
  const progressPct = xp?.progressPct ?? 0;
  const totalXP = xp?.totalXP ?? 0;
  const nextLevelXP = xp?.nextLevelXP ?? 20;
  const streak = xp?.streak ?? 0;
  const balance = xp?.rhozeBalance ?? 0;

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col items-center gap-2 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/credits" aria-label={`Level ${level} · ${title}`}>
                <div
                  className="relative h-9 w-9 rounded-full overflow-hidden"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, hsl(${tierColor} / 0.95), hsl(${tierColor} / 0.5) 55%, hsl(${tierColor} / 0.15) 90%)`,
                    boxShadow: `0 0 12px hsl(${tierColor} / 0.5), inset 0 -2px 6px hsl(${tierColor} / 0.4), inset 0 2px 4px rgba(255,255,255,0.4)`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white drop-shadow-md" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                      {level}
                    </span>
                  </div>
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <p className="font-bold">Level {level} · {title}</p>
              <p className="text-muted-foreground">{totalXP}/{nextLevelXP} XP</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-2 mb-2 rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 space-y-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/credits"
              aria-label={`Level ${level}, ${title}. Open Creator Pass.`}
              className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity"
            >
              <div
                className="relative h-10 w-10 rounded-full overflow-hidden shrink-0"
                style={{
                  background: `radial-gradient(circle at 35% 30%, hsl(${tierColor} / 0.95), hsl(${tierColor} / 0.5) 55%, hsl(${tierColor} / 0.15) 90%)`,
                  boxShadow: `0 0 14px hsl(${tierColor} / 0.5), inset 0 -2px 6px hsl(${tierColor} / 0.4), inset 0 2px 5px rgba(255,255,255,0.4)`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-white drop-shadow-md" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                    {level}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground truncate">{title}</p>
                <p className="text-[9px] text-muted-foreground tabular-nums">{totalXP}/{nextLevelXP} XP</p>
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[220px] text-xs leading-relaxed">
            Complete actions to earn XP and level up your status on Rhozeland. XP unlocks new features and boosts your visibility.
          </TooltipContent>
        </Tooltip>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={nextLevelXP}
          aria-valuenow={totalXP}
          className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden"
        >
          <motion.div
            key={progressPct}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, hsl(${tierColor}), hsl(${tierColor} / 0.6))`,
              boxShadow: `0 0 6px hsl(${tierColor} / 0.5)`,
            }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          {streak > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--orange)/0.12)] border border-[hsl(var(--orange)/0.3)]">
                  <Flame className="h-3 w-3" style={{ color: "hsl(var(--orange))" }} />
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: "hsl(var(--orange))" }}>
                    {streak}d
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {streak}-day streak
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/credits"
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--pink)/0.15)] border border-[hsl(var(--pink)/0.35)] hover:bg-[hsl(var(--pink)/0.25)] transition-colors ml-auto",
                )}
              >
                <Coins className="h-3 w-3" style={{ color: "hsl(var(--pink))" }} />
                <span className="text-[10px] font-bold tabular-nums">{balance.toLocaleString()}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {balance.toLocaleString()} $RHOZE
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-[9px] text-muted-foreground/80 leading-tight pt-0.5">
          $RHOZE — earned by creators and fans alike.
        </p>
      </div>
    </TooltipProvider>
  );
};

export default SidebarHud;
