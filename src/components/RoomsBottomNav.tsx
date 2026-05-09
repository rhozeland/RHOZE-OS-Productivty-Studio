import { Link, NavLink, useLocation } from "react-router-dom";
import { Sparkles, Store, Coins, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorXP } from "@/hooks/useCreatorXP";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * RoomsBottomNav — merged player HUD + 3-room navigation.
 *
 * Left half: tier gem · title + XP bar · streak chip · $RHOZE chip
 * Right half: Scene (Social) · Market (Work) · Vault (Growth)
 *
 * Stats collapse progressively on smaller widths so the room icons
 * are always reachable on mobile.
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

const RoomsBottomNav = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { data: xp } = useCreatorXP();

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
      <nav
        aria-label="Player HUD and rooms"
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto max-w-3xl px-3 pb-3 pointer-events-auto">
          <div className="flex items-stretch gap-2 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-lg shadow-foreground/10 p-1.5">
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

                {/* $RHOZE chip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/credits"
                      className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(var(--pink)/0.15)] border border-[hsl(var(--pink)/0.35)] hover:bg-[hsl(var(--pink)/0.25)] transition-colors"
                      aria-label={`${balance.toLocaleString()} $RHOZE`}
                    >
                      <Coins className="h-3 w-3" style={{ color: "hsl(var(--pink))" }} />
                      <span className="text-[10px] font-bold tabular-nums">{balance.toLocaleString()}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {balance.toLocaleString()} $RHOZE
                  </TooltipContent>
                </Tooltip>

                <div aria-hidden="true" className="h-9 w-px bg-border ml-1" />
              </div>
            )}

            {/* ── Rooms (right) ── */}
            <div className="flex items-stretch gap-1 flex-1 min-w-0">
              {ROOMS.map(({ id, label, sub, Icon, to, matches }) => {
                const active = isMatch(pathname, matches);
                return (
                  <NavLink
                    key={id}
                    to={to}
                    aria-current={active ? "page" : undefined}
                    className="flex-1 min-w-0"
                  >
                    <motion.div
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 px-2 transition-colors h-full",
                        active
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[11px] font-display font-semibold leading-none tracking-wide uppercase">
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] leading-none tracking-[0.18em] uppercase hidden sm:block",
                          active ? "opacity-70" : "opacity-50",
                        )}
                      >
                        {sub}
                      </span>
                    </motion.div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
};

export default RoomsBottomNav;
