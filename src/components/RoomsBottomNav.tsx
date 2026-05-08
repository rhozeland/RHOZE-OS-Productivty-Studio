import { NavLink, useLocation } from "react-router-dom";
import { Sparkles, Store, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * RoomsBottomNav — permanent 3-room bottom navigation.
 *
 *   Scene  (Social/Discovery) → /scene
 *   Market (Work/Utility)     → /market
 *   Vault  (Finance/Growth)   → /vault
 *
 * Active state matches the room prefix AND the legacy/inner routes that each
 * room contains, so deep links inside a room keep the correct tab highlighted.
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

  return (
    <nav
      aria-label="Rooms"
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto max-w-md px-3 pb-3 pointer-events-auto">
        <div className="flex items-stretch gap-1 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-lg shadow-foreground/10 p-1.5">
          {ROOMS.map(({ id, label, sub, Icon, to, matches }) => {
            const active = isMatch(pathname, matches);
            return (
              <NavLink
                key={id}
                to={to}
                aria-current={active ? "page" : undefined}
                className="flex-1"
              >
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 px-2 transition-colors",
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
                      "text-[9px] leading-none tracking-[0.18em] uppercase",
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
    </nav>
  );
};

export default RoomsBottomNav;
