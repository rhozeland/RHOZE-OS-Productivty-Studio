import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  MessageSquare,
  Palette,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const dockItems = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Building2, label: "Studios", path: "/studios" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Palette, label: "Hub", path: "/creators" },
  { icon: MessageSquare, label: "Inbox", path: "/messages", hasBadge: true },
  { icon: Calendar, label: "Schedule", path: "/calendar" },
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
      className="fixed bottom-4 inset-x-0 mx-auto w-fit z-50"
    >
      <div className="flex items-center gap-1 px-4 py-2.5 bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-lg shadow-foreground/5">
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
                <item.icon className="h-4 w-4" />
                <span className="text-[9px] font-body font-medium leading-none">
                  {item.label}
                </span>
                {showBadge && (
                  <span className="absolute top-0.5 right-1 h-2 w-2 rounded-full bg-accent" />
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