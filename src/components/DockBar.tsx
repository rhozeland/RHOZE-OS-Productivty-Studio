import { useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, useAnimationControls } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DOCK_IDS,
  NAV_ITEMS_BY_ID,
  isNavItemActive,
} from "@/config/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

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

  const dockIds = (profile?.dock_config as string[] | null) || DEFAULT_DOCK_IDS;

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
        {dockIds.map((id) => {
          const item = NAV_ITEMS_BY_ID[id];
          if (!item) return null;
          const Icon = item.icon;
          const active = isNavItemActive(item, location.pathname);

          return (
            <Link key={id} to={item.path} className="relative group">
              <motion.div
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={cn(
                  "flex flex-col items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-lg transition-colors duration-150 gap-0.5",
                  active
                    ? "bg-primary text-primary-foreground"
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
      </div>
    </motion.div>
  );
};

export default DockBar;
