import { useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, useAnimationControls } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DOCK_IDS,
  NAV_ITEMS_BY_ID,
  partitionDockIds,
} from "@/config/navigation";
import { resolveNavLink } from "@/hooks/useNavLink";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SCROLL_THRESHOLD = 8; // minimum delta to trigger hide/show

const DockBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const controls = useAnimationControls();
  const lastScrollY = useRef(0);
  const isVisible = useRef(true);
  const ticking = useRef(false);

  // Offset to keep dock centered over the main content area (not viewport)
  const sidebarOffset = isMobile ? 0 : state === "expanded" ? 256 : 48;

  const { data: profile } = useQuery({
    queryKey: ["my-profile-dock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("dock_config")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const rawDockIds = (profile?.dock_config as string[] | null) || DEFAULT_DOCK_IDS;

  // Validate every saved id against the live nav config. Stale ids (e.g.
  // a renamed/removed nav item from a previous deploy) are surfaced as a
  // visible "unknown" placeholder so users notice and can re-customize,
  // rather than silently disappearing from the dock.
  const { validIds, unknownIds } = useMemo(() => {
    const { valid, unknown } = partitionDockIds(rawDockIds);
    // Guarantee a non-empty dock — fall back to defaults if the saved
    // config has zero recognizable ids (e.g. corrupted row).
    return {
      validIds: valid.length > 0 ? valid : DEFAULT_DOCK_IDS,
      unknownIds: unknown,
    };
  }, [rawDockIds]);

  // Dev-only warning so we catch drift between config and saved data early.
  useEffect(() => {
    if (import.meta.env.DEV && unknownIds.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[DockBar] Saved dock_config contains unknown nav ids:",
        unknownIds,
        "\nUpdate src/config/navigation.ts or remove these from the user's saved config.",
      );
    }
  }, [unknownIds]);

  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;

    requestAnimationFrame(() => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      if (delta > SCROLL_THRESHOLD && isVisible.current && currentY > 60) {
        // Scrolling down — hide
        isVisible.current = false;
        controls.start({ y: 100, opacity: 0, transition: { duration: 0.25, ease: "easeIn" } });
      } else if (delta < -SCROLL_THRESHOLD && !isVisible.current) {
        // Scrolling up — show
        isVisible.current = true;
        controls.start({ y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 28 } });
      }

      lastScrollY.current = currentY;
      ticking.current = false;
    });
  }, [controls]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Reset visibility on route change
  useEffect(() => {
    isVisible.current = true;
    controls.start({ y: 0, opacity: 1, transition: { duration: 0.2 } });
  }, [location.pathname, controls]);

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={controls}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
      className="fixed bottom-4 right-0 z-50 flex justify-center pointer-events-none transition-[left] duration-200 ease-linear"
      style={{ left: sidebarOffset }}
    >
      <div className="flex items-center gap-2 sm:gap-1 px-5 sm:px-4 py-3 sm:py-2.5 bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-lg shadow-foreground/5 pointer-events-auto">
        {validIds.map((id) => {
          const item = NAV_ITEMS_BY_ID[id];
          if (!item) return null;
          const Icon = item.icon;
          // Use the shared resolver so DockBar, the header nav, and the
          // sidebar all compute `isActive` and `to` identically.
          const { to, isActive: active, ariaCurrent } = resolveNavLink(
            item,
            location.pathname,
          );

          return (
            <Link key={id} to={to} aria-current={ariaCurrent} className="relative group">
              <motion.div
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={cn(
                  "flex flex-col items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-lg transition-colors duration-150 gap-0.5",
                  active
                    ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-body font-medium leading-none">
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}

        {/* Visible fallback for unknown saved ids — keeps the dock layout
            stable and signals to the user that something needs attention.
            Clicking opens Settings so they can re-pick valid items. */}
        {unknownIds.map((id) => (
          <Tooltip key={`unknown-${id}`}>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                aria-label={`Unknown dock item "${id}". Open settings to fix.`}
                className="relative group"
              >
                <div className="flex flex-col items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-lg gap-0.5 border border-dashed border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-[10px] font-body font-medium leading-none">
                    Missing
                  </span>
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-body">
              Unknown dock item: <span className="font-mono">{id}</span>
              <br />
              Click to update your dock in Settings.
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </motion.div>
  );
};

export default DockBar;
