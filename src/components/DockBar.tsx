import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
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
  network: Users,
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
  network: "Network",
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
  network: "/network",
};

const DockBar = () => {
  const location = useLocation();
  const { user } = useAuth();

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

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
      className="fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none"
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
