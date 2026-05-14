import { useCallback, useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Sparkles, Store, Coins, Flame, Plus } from "lucide-react";
import PostMenuButton from "@/components/PostMenuButton";
import { motion, useAnimationControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorXP } from "@/hooks/useCreatorXP";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * RoomsBottomNav — merged player HUD + 3-room navigation.
 *
 * v8.10:
 *  • Only renders on Discover (/discover, /scene, /flow, /stream). Inbox,
 *    Creator Pass, and detail pages keep their own headers clean.
 *  • Hides on scroll-down, reveals on scroll-up.
 *  • Centered within the main content column (offset by half the
 *    sidebar width on desktop) instead of the full viewport.
 *  • Post button is now a single Plus icon (no label).
 */
const ROOMS = [
  {
    id: "scene",
    label: "Scene",
    sub: "Social",
    Icon: Sparkles,
    to: "/scene",
    matches: ["/scene", "/discover", "/flow", "/stream", "/people", "/profiles", "/creators"],
  },
  {
    id: "market",
    label: "Market",
    sub: "Work",
    Icon: Store,
    to: "/market",
    matches: ["/market", "/marketplace", "/spaces", "/studios", "/services", "/projects", "/bookings", "/calendar", "/messages"],
  },
  {
    id: "vault",
    label: "Vault",
    sub: "Growth",
    Icon: Coins,
    to: "/vault",
    matches: ["/vault", "/credits", "/purchases", "/swaps", "/seller"],
  },
];

const isMatch = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

// Routes where the dock should be hidden (auth/onboarding/landing/fullscreen).
// Everywhere else, the HUD dock is always visible.
const HIDDEN_PREFIXES = ["/auth", "/onboarding", "/", "/landing", "/flow"];
const HIDDEN_EXACT = new Set(["/", "/auth", "/onboarding", "/landing"]);

const SCROLL_HIDE_THRESHOLD = 12;

const RoomsBottomNav = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { data: xp } = useCreatorXP();
  const { state, isMobile } = useSidebar();
  const controls = useAnimationControls();
  const lastScrollY = useRef(0);
  const isHidden = useRef(false);
  const ticking = useRef(false);

  // Center the dock within the content column. Instead of doing math on
  // `50% + half-sidebar` (which drifted when the sidebar width changed),
  // we reserve the sidebar's full width as left padding on a full-width
  // wrapper and let flexbox center the pill in the remaining space.
  const sidebarFullWidth = isMobile
    ? "0px"
    : state === "expanded"
      ? "16rem" // full sidebar width
      : "3rem"; // icon-collapsed sidebar width

  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;

      if (delta > SCROLL_HIDE_THRESHOLD && !isHidden.current && y > 80) {
        isHidden.current = true;
        controls.start({
          y: 96,
          opacity: 0,
          transition: { duration: 0.22, ease: "easeOut" },
        });
      } else if (delta < -SCROLL_HIDE_THRESHOLD && isHidden.current) {
        isHidden.current = false;
        controls.start({
          y: 0,
          opacity: 1,
          transition: { type: "spring", stiffness: 320, damping: 28 },
        });
      }

      lastScrollY.current = y;
      ticking.current = false;
    });
  }, [controls]);

  // Reset on route change so it never lands stuck-hidden.
  useEffect(() => {
    lastScrollY.current = window.scrollY;
    isHidden.current = false;
    controls.start({ y: 0, opacity: 1, transition: { duration: 0.2 } });
  }, [pathname, controls]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Hide on auth/onboarding/landing/flow; show everywhere else.
  if (HIDDEN_EXACT.has(pathname) || pathname.startsWith("/flow")) {
    return null;
  }

  const tierColor = xp?.titleColor ?? "210 60% 55%";
  const level = xp?.level ?? 1;
  const title = xp?.title ?? "Newcomer";
  const progressPct = xp?.progressPct ?? 0;
  const totalXP = xp?.totalXP ?? 0;
  const nextLevelXP = xp?.nextLevelXP ?? 20;
  const streak = xp?.streak ?? 0;

  return (
    <TooltipProvider delayDuration={150}>
      <motion.nav
        aria-label="Player HUD and rooms"
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none flex justify-center"
        style={{
          paddingLeft: sidebarFullWidth,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        initial={{ y: 0, opacity: 1 }}
        animate={controls}
      >
        <div className="px-3 pb-3 pointer-events-auto">
          <div className="inline-flex items-stretch gap-1 rounded-full border border-border bg-card/95 backdrop-blur-xl shadow-lg shadow-foreground/10 p-1">
            {/* ── Player HUD (left) ── */}
            {user && (
              <div className="flex items-center gap-2 pl-1.5 pr-2 min-w-0 shrink">
                {/* Gem orb */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/credits"
                      aria-label={`Level ${level}, ${title}. ${totalXP} of ${nextLevelXP} XP.`}
                      className="relative shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                    >
                      <div
                        className="relative h-10 w-10 rounded-full overflow-hidden"
                        style={{
                          background: `radial-gradient(circle at 35% 30%, hsl(${tierColor} / 0.95), hsl(${tierColor} / 0.5) 55%, hsl(${tierColor} / 0.15) 90%)`,
                          boxShadow: `0 0 14px hsl(${tierColor} / 0.5), inset 0 -2px 6px hsl(${tierColor} / 0.4), inset 0 2px 4px rgba(255,255,255,0.4)`,
                        }}
                      >
                        <motion.div
                          aria-hidden="true"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 opacity-50"
                          style={{
                            background:
                              "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.4), transparent 40%)",
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className="text-[11px] font-bold text-white"
                            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                          >
                            {level}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-bold">Level {level} · {title}</p>
                    <p className="text-muted-foreground">{totalXP}/{nextLevelXP} XP</p>
                  </TooltipContent>
                </Tooltip>

                {/* Title + XP bar */}
                <Link
                  to="/credits"
                  className="hidden sm:flex flex-col gap-0.5 min-w-[110px] max-w-[140px] hover:opacity-90 transition-opacity"
                  aria-label="Open Creator Pass"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80 truncate">
                      {title}
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground tabular-nums">
                      {totalXP}/{nextLevelXP}
                    </span>
                  </div>
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
                </Link>

                {/* Streak chip */}
                {streak > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--orange)/0.12)] border border-[hsl(var(--orange)/0.3)]">
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

                {/* Post — icon-only round button. Opens the unified "What are you posting?" sheet. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <PostMenuButton
                        trigger={
                          <button
                            type="button"
                            className="flex items-center justify-center h-9 w-9 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
                            aria-label="Post work"
                          >
                            <Plus className="h-4 w-4" strokeWidth={2.5} />
                          </button>
                        }
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Post — drop a work, offering, or update
                  </TooltipContent>
                </Tooltip>

                <div aria-hidden="true" className="h-9 w-px bg-border ml-1" />
              </div>
            )}

            {/* ── Rooms (right) — compact icon-only pills with tooltips. ── */}
            <div className="flex items-center gap-1">
              {ROOMS.map(({ id, label, sub, Icon, to, matches }) => {
                const active = isMatch(pathname, matches);
                return (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <NavLink to={to} aria-current={active ? "page" : undefined} aria-label={`${label} · ${sub}`}>
                        <motion.div
                          whileTap={{ scale: 0.92 }}
                          className={cn(
                            "h-9 w-9 flex items-center justify-center rounded-full transition-colors",
                            active
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </motion.div>
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p className="font-bold">{label}</p>
                      <p className="text-muted-foreground">{sub}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      </motion.nav>
    </TooltipProvider>
  );
};

export default RoomsBottomNav;
