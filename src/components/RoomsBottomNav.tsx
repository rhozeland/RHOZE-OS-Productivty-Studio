import { useCallback, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Sparkles, Store, Coins } from "lucide-react";
import { motion, useAnimationControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
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

  return (
    <TooltipProvider delayDuration={150}>
      <motion.nav
        aria-label="Room navigation"
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
            {/* ── Rooms — compact icon-only pills with tooltips. ── */}
            <div className="flex items-center gap-1 px-1">
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
