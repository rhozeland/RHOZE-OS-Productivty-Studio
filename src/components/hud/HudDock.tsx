import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, MessageSquare, User, Flame, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorXP, getTitleForLevel } from "@/hooks/useCreatorXP";
import { useCelebration } from "@/components/hud/CelebrationProvider";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/messages", label: "Conversations", icon: MessageSquare },
  { to: "/credits", label: "Pass", icon: User },
];

/**
 * HUD Dock — persistent gaming-style player bar inspired by the Roborock
 * reference: dark glass pill + glowing iridescent gem orb on the left.
 * Shows level, XP progress, streak, $RHOZE, and pill nav.
 */
const HudDock = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { data: xp } = useCreatorXP();
  const { celebrate, effectsEnabled } = useCelebration();

  // Detect level-up by tracking last-seen level.
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!xp) return;
    if (lastLevel.current !== null && xp.level > lastLevel.current) {
      const t = getTitleForLevel(xp.level);
      celebrate({
        kind: "level",
        title: `Level ${xp.level} — ${t.title}`,
        subtitle: "New tier unlocked",
      });
    }
    lastLevel.current = xp.level;
  }, [xp, celebrate]);

  if (!user) return null;

  // Hide on routes where the HUD would clash (auth, onboarding, immersive flow).
  const hiddenRoutes = ["/auth", "/onboarding", "/flow"];
  if (hiddenRoutes.some((p) => pathname.startsWith(p))) return null;
  if (!effectsEnabled) {
    // Even with effects off, keep a quiet compact HUD so users can still
    // see level + streak; just skip the glow/animation flair below.
  }

  const tierColor = xp?.titleColor ?? "210 60% 55%";
  const level = xp?.level ?? 1;
  const title = xp?.title ?? "Newcomer";
  const progressPct = xp?.progressPct ?? 0;
  const totalXP = xp?.totalXP ?? 0;
  const nextLevelXP = xp?.nextLevelXP ?? 20;
  const streak = xp?.streak ?? 0;
  const balance = xp?.rhozeBalance ?? 0;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.3 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 sm:gap-3 pl-2 pr-3 py-2 rounded-full",
          "bg-card/95 backdrop-blur-2xl border border-border shadow-2xl",
        )}
        style={{
          boxShadow:
            "0 12px 36px -12px hsl(var(--foreground) / 0.25), inset 0 1px 0 hsl(var(--background) / 0.4)",
        }}
      >
        {/* Gem orb — tier color radial gradient with iridescent shimmer */}
        <Link
          to="/credits"
          aria-label={`Level ${level} ${title} — open Creator Pass`}
          className="relative shrink-0 group"
        >
          <div
            className="relative h-11 w-11 rounded-full overflow-hidden"
            style={{
              background: `radial-gradient(circle at 35% 30%, hsl(${tierColor} / 0.95), hsl(${tierColor} / 0.5) 55%, hsl(${tierColor} / 0.15) 90%)`,
              boxShadow: `0 0 20px hsl(${tierColor} / 0.55), inset 0 -3px 8px hsl(${tierColor} / 0.4), inset 0 3px 6px rgba(255,255,255,0.4)`,
            }}
          >
            {/* Iridescent shimmer sweep */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.45), transparent 40%)",
              }}
            />
            {/* Inner highlight */}
            <div
              className="absolute top-1 left-1.5 h-3 w-3 rounded-full"
              style={{ background: "rgba(255,255,255,0.7)", filter: "blur(1px)" }}
            />
            {/* Level number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[11px] font-bold font-body text-white drop-shadow-md"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
              >
                {level}
              </span>
            </div>
          </div>
        </Link>

        {/* XP block — title + progress bar */}
        <div className="hidden sm:flex flex-col gap-0.5 min-w-[110px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-body font-bold uppercase tracking-wider text-foreground/80">
              {title}
            </span>
            <span className="text-[9px] font-body font-medium text-muted-foreground tabular-nums">
              {totalXP}/{nextLevelXP}
            </span>
          </div>
          <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              key={progressPct}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full relative"
              style={{
                background: `linear-gradient(90deg, hsl(${tierColor}), hsl(${tierColor} / 0.6))`,
                boxShadow: `0 0 8px hsl(${tierColor} / 0.5)`,
              }}
            >
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, hsl(var(--background) / 0.6), transparent)",
                  animation: "gradient-shift 2s linear infinite",
                  backgroundSize: "200% 100%",
                }}
              />
            </motion.div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-7 w-px bg-border" />

        {/* Streak chip */}
        <AnimatePresence>
          {streak > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--orange)/0.12)] border border-[hsl(var(--orange)/0.3)]"
            >
              <Flame className="h-3 w-3" style={{ color: "hsl(var(--orange))" }} />
              <span className="text-[10px] font-bold font-body tabular-nums" style={{ color: "hsl(var(--orange))" }}>
                {streak}d
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* $RHOZE balance chip */}
        <Link
          to="/credits"
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--pink)/0.15)] border border-[hsl(var(--pink)/0.35)] hover:bg-[hsl(var(--pink)/0.25)] transition-colors"
        >
          <Coins className="h-3 w-3" style={{ color: "hsl(var(--pink))" }} />
          <span className="text-[10px] font-bold font-body tabular-nums text-foreground">
            {balance.toLocaleString()}
          </span>
        </Link>

        {/* Divider */}
        <div className="hidden md:block h-7 w-px bg-border" />

        {/* Nav pills */}
        <div className="flex items-center gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.to ||
              (item.to !== "/discover" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="group relative"
              >
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default HudDock;
