import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, MessageSquare, User, Flame, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorXP, getTitleForLevel } from "@/hooks/useCreatorXP";
import { useCelebration } from "@/components/hud/CelebrationProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/messages", label: "Conversations", icon: MessageSquare },
  { to: "/credits", label: "Pass", icon: User },
];

/**
 * HUD Dock — persistent gaming-style player bar.
 * Accessibility:
 *  - Whole dock is a `nav` landmark with an aria-label.
 *  - Each stat (XP, streak, $RHOZE) is wrapped in a Tooltip and exposes a
 *    descriptive `aria-label` so screen readers announce the value.
 *  - Decorative SVG icons are `aria-hidden`.
 *  - The XP bar has `role="progressbar"` with aria-value attributes.
 *  - High-contrast: a `forced-colors` media query swaps decorative gradients
 *    for system colors (CanvasText / Highlight) so Windows High Contrast
 *    mode keeps the dock fully visible.
 */
const HudDock = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { data: xp } = useCreatorXP();
  const { celebrate } = useCelebration();
  const { state, isMobile } = useSidebar();
  // Offset half the sidebar width so the dock visually centers within the
  // main content column (not the full viewport). On mobile the sidebar is
  // an overlay, so no offset is needed.
  const sidebarOffset = isMobile
    ? "0px"
    : state === "expanded"
      ? "8rem" // half of 16rem sidebar width
      : "1.5rem"; // half of 3rem icon-collapsed width

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

  const tierColor = xp?.titleColor ?? "210 60% 55%";
  const level = xp?.level ?? 1;
  const title = xp?.title ?? "Newcomer";
  const progressPct = xp?.progressPct ?? 0;
  const totalXP = xp?.totalXP ?? 0;
  const nextLevelXP = xp?.nextLevelXP ?? 20;
  const streak = xp?.streak ?? 0;
  const balance = xp?.rhozeBalance ?? 0;

  return (
    <TooltipProvider delayDuration={150}>
      <motion.nav
        aria-label="Player HUD"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 28, delay: 0.3 }}
        className="hud-dock fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      >
        <div
          className={cn(
            "hud-dock__pill pointer-events-auto flex items-center gap-2 sm:gap-3 pl-2 pr-3 py-2 rounded-full",
            "bg-card/95 backdrop-blur-2xl border border-border shadow-2xl",
          )}
          style={{
            boxShadow:
              "0 12px 36px -12px hsl(var(--foreground) / 0.25), inset 0 1px 0 hsl(var(--background) / 0.4)",
          }}
        >
          {/* Gem orb — tier color radial gradient with iridescent shimmer */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/credits"
                aria-label={`Level ${level}, ${title}. ${totalXP} of ${nextLevelXP} XP. Open Creator Pass.`}
                className="relative shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-full"
              >
                <div
                  className="hud-dock__gem relative h-11 w-11 rounded-full overflow-hidden"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, hsl(${tierColor} / 0.95), hsl(${tierColor} / 0.5) 55%, hsl(${tierColor} / 0.15) 90%)`,
                    boxShadow: `0 0 20px hsl(${tierColor} / 0.55), inset 0 -3px 8px hsl(${tierColor} / 0.4), inset 0 3px 6px rgba(255,255,255,0.4)`,
                  }}
                >
                  <motion.div
                    aria-hidden="true"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    className="hud-dock__shimmer absolute inset-0 opacity-60"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.45), transparent 40%)",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute top-1 left-1.5 h-3 w-3 rounded-full"
                    style={{ background: "rgba(255,255,255,0.7)", filter: "blur(1px)" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      aria-hidden="true"
                      className="text-[11px] font-bold font-body text-white drop-shadow-md"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                    >
                      {level}
                    </span>
                  </div>
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-body">
              <p className="font-bold">Level {level} · {title}</p>
              <p className="text-muted-foreground">{totalXP} / {nextLevelXP} XP — open Creator Pass</p>
            </TooltipContent>
          </Tooltip>

          {/* XP block — title + progress bar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="hidden sm:flex flex-col gap-0.5 min-w-[110px] cursor-help"
                role="group"
                aria-label={`Experience points: ${totalXP} of ${nextLevelXP} toward level ${level + 1}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-body font-bold uppercase tracking-wider text-foreground/80">
                    {title}
                  </span>
                  <span className="text-[9px] font-body font-medium text-muted-foreground tabular-nums">
                    {totalXP}/{nextLevelXP}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={nextLevelXP}
                  aria-valuenow={totalXP}
                  aria-label={`${Math.round(progressPct)}% to next level`}
                  className="hud-dock__bar relative h-1.5 w-full rounded-full bg-muted overflow-hidden"
                >
                  <motion.div
                    key={progressPct}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="hud-dock__bar-fill h-full rounded-full relative"
                    style={{
                      background: `linear-gradient(90deg, hsl(${tierColor}), hsl(${tierColor} / 0.6))`,
                      boxShadow: `0 0 8px hsl(${tierColor} / 0.5)`,
                    }}
                  >
                    <div
                      aria-hidden="true"
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
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-body">
              <p className="font-bold">{totalXP} XP earned</p>
              <p className="text-muted-foreground">{nextLevelXP - totalXP} XP to Level {level + 1}</p>
            </TooltipContent>
          </Tooltip>

          <div aria-hidden="true" className="hidden sm:block h-7 w-px bg-border" />

          {/* Streak chip */}
          <AnimatePresence>
            {streak > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    role="status"
                    aria-label={`Current activity streak: ${streak} day${streak === 1 ? "" : "s"}`}
                    className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--orange)/0.12)] border border-[hsl(var(--orange)/0.3)] cursor-help"
                  >
                    <Flame aria-hidden="true" className="h-3 w-3" style={{ color: "hsl(var(--orange))" }} />
                    <span className="text-[10px] font-bold font-body tabular-nums" style={{ color: "hsl(var(--orange))" }}>
                      {streak}d
                    </span>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-body">
                  <p className="font-bold">{streak}-day streak</p>
                  <p className="text-muted-foreground">Keep showing up to earn $RHOZE every 7 days</p>
                </TooltipContent>
              </Tooltip>
            )}
          </AnimatePresence>

          {/* $RHOZE balance chip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/credits"
                aria-label={`$RHOZE balance: ${balance.toLocaleString()}. Open Creator Pass.`}
                className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--pink)/0.15)] border border-[hsl(var(--pink)/0.35)] hover:bg-[hsl(var(--pink)/0.25)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <Coins aria-hidden="true" className="h-3 w-3" style={{ color: "hsl(var(--pink))" }} />
                <span className="text-[10px] font-bold font-body tabular-nums text-foreground">
                  {balance.toLocaleString()}
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-body">
              <p className="font-bold">{balance.toLocaleString()} $RHOZE</p>
              <p className="text-muted-foreground">Earn more by showing up — view Creator Pass</p>
            </TooltipContent>
          </Tooltip>

          <div aria-hidden="true" className="hidden md:block h-7 w-px bg-border" />

          {/* Nav pills */}
          <div className="flex items-center gap-1" role="group" aria-label="Quick navigation">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.to ||
                (item.to !== "/discover" && pathname.startsWith(item.to));
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.to}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className="group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-full"
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
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </motion.div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-body">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </motion.nav>
    </TooltipProvider>
  );
};

export default HudDock;
