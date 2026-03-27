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
  { icon: Search, label: "Explore", path: "/creators" },
  { icon: MessageSquare, label: "Messages", path: "/messages", hasBadge: true },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: LayoutGrid, label: "Boards", path: "/smartboards" },
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
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl glass shadow-2xl shadow-black/20 dark:shadow-black/50 border border-border/60">
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
                whileHover={{ scale: 1.2, y: -4 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={cn(
                  "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors duration-200",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                {active && (
                  <motion.div
                    layoutId="dock-indicator"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                {showBadge && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </motion.div>

              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-foreground text-background text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DockBar;
