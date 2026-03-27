import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  Store,
  MessageSquare,
  Settings,
  LogOut,
  Briefcase,
  Coins,
  ShieldCheck,
  Workflow,
  User,
  LayoutGrid,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const getWorkspaceItems = (userId?: string) => [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: MessageSquare, label: "Messages", path: "/messages", hasBadge: true },
];

const marketplaceItems = [
  { icon: Building2, label: "Studios", path: "/studios" },
  { icon: Store, label: "Creators Hub", path: "/creators" },
  { icon: Coins, label: "Studio Pass", path: "/credits" },
];

const toolsItems = [
  { icon: LayoutGrid, label: "Boards", path: "/smartboards" },
  { icon: Workflow, label: "Automations", path: "/flow" },
  { icon: Users, label: "Collab Rooms", path: "/drop-rooms" },
];

const AppSidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const { isAdmin } = useAdminCheck();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-messages-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("read", false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: pendingInquiries } = useQuery({
    queryKey: ["pending-inquiries-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("listing_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const totalUnread = (unreadCount ?? 0) + (pendingInquiries ?? 0);

  const accountItems = [
    { icon: User, label: "Profile", path: user?.id ? `/profiles/${user.id}` : "/settings" },
    { icon: Settings, label: "Settings", path: "/settings" },
    ...(isAdmin ? [{ icon: ShieldCheck, label: "Admin", path: "/admin" }] : []),
  ];

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const renderNavItem = (item: any) => {
    const active = isActive(item.path);
    const showBadge = item.hasBadge && totalUnread > 0;

    return (
      <SidebarMenuItem key={item.path + item.label}>
        <SidebarMenuButton
          asChild
          tooltip={collapsed ? item.label : undefined}
          isActive={active}
        >
          <Link
            to={item.path}
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-250",
              active
                ? "sidebar-active-gradient text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <item.icon className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors duration-250",
              active ? "text-primary" : ""
            )} />
            {!collapsed && (
              <span className="flex-1">{item.label}</span>
            )}
            {!collapsed && showBadge && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
            {collapsed && showBadge && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-primary" />
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (label: string, items: any[]) => (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3 mb-1">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="space-y-0.5">
          {items.map(renderNavItem)}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className={cn(
        "flex h-16 items-center gap-3 px-4 border-b border-sidebar-border",
        collapsed && "justify-center px-2"
      )}>
        <img
          src={rhozelandLogo}
          alt="Rhozeland"
          className="h-8 w-8 shrink-0 object-contain"
        />
        {!collapsed && (
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Rhozeland
          </span>
        )}
      </div>

      <SidebarContent className="px-2 pt-3">
        {renderGroup("Workspace", getWorkspaceItems(user?.id))}
        {renderGroup("Marketplace", marketplaceItems)}
        {renderGroup("Tools", toolsItems)}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <div className="border-t border-sidebar-border pt-3">
          <SidebarMenu className="space-y-0.5">
            {accountItems.map(renderNavItem)}
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={collapsed ? "Sign Out" : undefined}
                onClick={signOut}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-250"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
