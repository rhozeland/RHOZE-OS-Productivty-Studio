import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, useAnimationControls } from "framer-motion";
import {
  Home,
  Building2,
  FolderKanban,
  Flame,
  MessageSquare,
  Palette,
  Radio,
  ShoppingBag,
  Calendar,
  CreditCard,
  User,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_DOCK_IDS } from "@/components/settings/DockCustomizer";

const ICON_MAP: Record<string, any> = {
  dashboard: Home,
  studios: Building2,
  projects: FolderKanban,
  hub: Flame,
  messages: MessageSquare,
  boards: Palette,
  droprooms: Radio,
  marketplace: ShoppingBag,
  calendar: Calendar,
  bookings: Calendar,
  credits: CreditCard,
  profile: User,
  settings: Settings,
  services: Store,
};

const LABEL_MAP: Record<string, string> = {
  dashboard: "Home",
  studios: "Studios",
  projects: "Projects",
  hub: "Hub",
  messages: "Inbox",
  boards: "Boards",
  droprooms: "Drops",
  marketplace: "Market",
  calendar: "Calendar",
  bookings: "Bookings",
  credits: "Credits",
  profile: "Profile",
  settings: "Settings",
  services: "Services",
};

const PATH_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  studios: "/studios",
  projects: "/projects",
  hub: "/creators",
  messages: "/messages",
  boards: "/smartboards",
  droprooms: "/droprooms",
  marketplace: "/marketplace",
  calendar: "/calendar",
  bookings: "/bookings",
  credits: "/credits",
  profile: "/profiles",
  settings: "/settings",
  services: "/services",
};

const SCROLL_THRESHOLD = 8; // minimum delta to trigger hide/show

const DockBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const controls = useAnimationControls();
  const lastScrollY = useRef(0);
  const isVisible = useRef(true);
  const ticking = useRef(false);

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

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

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
      className="fixed bottom-4 left-0 right-0 md:left-[var(--sidebar-width,0px)] z-50 flex justify-center pointer-events-none transition-[left] duration-200 ease-linear"
      onAnimationStart={() => {
        // Ensure pointer events work during animation
      }}
    >
      <div className="flex items-center gap-2 sm:gap-1 px-5 sm:px-4 py-3 sm:py-2.5 bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-lg shadow-foreground/5 pointer-events-auto">
        {dockIds.map((id) => {
          const Icon = ICON_MAP[id];
          const label = LABEL_MAP[id];
          const path = PATH_MAP[id];
          if (!Icon || !path) return null;
          const active = isActive(path);

          return (
            <Link key={id} to={path} className="relative group">
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
                  {label}
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
