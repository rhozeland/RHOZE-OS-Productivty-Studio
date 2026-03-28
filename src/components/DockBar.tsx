import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  MessageSquare,
  Search,
  Workflow,
  LayoutGrid,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const dockItems = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Building2, label: "Studios", path: "/studios" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Search, label: "Discover", path: "/creators" },
  { icon: MessageSquare, label: "Inbox", path: "/messages", hasBadge: true },
  { icon: Calendar, label: "Schedule", path: "/calendar" },
  { icon: Workflow, label: "Flow", path: "/flow" },
];

const DockBar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-dock-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-2xl glass shadow-2xl shadow-black/20 dark:shadow-black/50 border border-border/60">
        {dockItems.map((item) => {
          const active = isActive(item.path);
          const showBadge = item.hasBadge && (unreadCount ?? 0) > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative group"
            >
              <motion.div
                whileHover={{ scale: 1.12, y: -3 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={cn(
                  "flex flex-col items-center justify-center w-11 h-12 sm:w-14 sm:h-14 rounded-xl transition-colors duration-200 gap-0.5",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <item.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", active && "text-primary")} />
                <span className={cn(
                  "text-[9px] sm:text-[10px] font-medium leading-none",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="dock-indicator"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                {showBadge && (
                  <span className="absolute top-0.5 right-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DockBar;
