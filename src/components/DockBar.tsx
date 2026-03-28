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
  User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const dockItems = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Building2, label: "Studios", path: "/studios" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Palette, label: "Creators", path: "/creators" },
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

  const { data: profile } = useQuery({
    queryKey: ["my-profile-dock", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const profilePath = user?.id ? `/profiles/${user.id}` : "/settings";
  const profileActive = isActive(profilePath) || isActive("/settings");

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-0.5 px-3 py-2 bg-card/90 backdrop-blur-xl border border-border rounded-lg shadow-lg shadow-foreground/5">
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
                  "flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-md transition-colors duration-150 gap-0.5",
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

        {/* Profile avatar in dock */}
        <Link to={profilePath} className="relative group ml-0.5">
          <motion.div
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={cn(
              "flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-md transition-colors duration-150 gap-0.5",
              profileActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Avatar className="h-5 w-5 border border-border">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[7px] font-semibold bg-muted text-muted-foreground font-body">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-[9px] font-body font-medium leading-none">
              Profile
            </span>
          </motion.div>
        </Link>
      </div>
    </motion.div>
  );
};

export default DockBar;