import { useCallback, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Sun, Users, Coins } from "lucide-react";
import { motion, useAnimationControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/components/ui/sidebar";
import { todayGradient } from "@/lib/rhoze-gradients";
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
    label: "Today",
    sub: "Discover",
    Icon: Sun,
    to: "/discover",
    matches: ["/scene", "/discover", "/stream", "/people", "/profiles", "/creators"],
  },
  {
    id: "market",
    label: "Connect",
    sub: "Creators · Spaces · Calls",
    Icon: Users,
    to: "/market",
    matches: ["/market", "/marketplace", "/spaces", "/studios", "/services"],
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

// v9.4: dock now only appears on Discover (and its legacy /scene alias).
// Everywhere else (Connect, Vault, Inbox, Flow, detail pages) the dock is
// hidden — users navigate back via the sidebar.
const VISIBLE_PREFIXES = ["/discover", "/scene"];

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

  // Only show on Discover.
  if (!VISIBLE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
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
        <div className="px-3 pb-4 pointer-events-auto">
          {(() => {
            const grad = todayGradient();
            return (
              <div className="relative" data-rhoze-gradient={grad.id}>
                {/* Outer glow halo — daily Rhozeland gradient */}
                <div
                  aria-hidden
                  className="absolute -inset-2 rounded-full blur-2xl opacity-70"
                  style={{ background: grad.halo }}
                />
                <div className="relative inline-flex items-stretch gap-1.5 rounded-full border-2 border-foreground/10 bg-card/95 backdrop-blur-xl shadow-2xl shadow-foreground/10 p-1.5 ring-1 ring-foreground/5">
                  <div className="flex items-center gap-1">
                    {ROOMS.map(({ id, label, sub, Icon, to, matches }) => {
                      const active = isMatch(pathname, matches);
                      return (
                        <Tooltip key={id}>
                          <TooltipTrigger asChild>
                            <NavLink to={to} aria-current={active ? "page" : undefined} aria-label={`${label} · ${sub}`}>
                              <motion.div
                                whileTap={{ scale: 0.92 }}
                                whileHover={{ y: -2 }}
                                className={cn(
                                  "h-11 px-4 flex items-center gap-2 rounded-full transition-all font-semibold text-sm",
                                  active
                                    ? "text-white shadow-lg"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                                )}
                                style={active ? { backgroundImage: grad.text } : undefined}
                              >
                                <Icon className={cn("h-5 w-5", active && "drop-shadow")} />
                                <span>{label}</span>
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
        </div>
      </motion.nav>
    </TooltipProvider>
  );
};

export default RoomsBottomNav;
