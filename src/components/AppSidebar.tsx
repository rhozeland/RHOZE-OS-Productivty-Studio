import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const mainItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
];

const AppSidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const { isAdmin } = useAdminCheck();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const { data: profile } = useQuery({
    queryKey: ["my-profile-sidebar", user?.id],
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

  const accountItems = [
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
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            <item.icon className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors duration-250",
              active ? "text-primary" : ""
            )} />
            {!collapsed && (
              <span className="flex-1">{item.label}</span>
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

  const profilePath = user?.id ? `/profiles/${user.id}` : "/settings";
  const profileActive = isActive(profilePath);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <Link to="/dashboard" className={cn(
        "flex h-16 items-center gap-3 px-4 border-b border-sidebar-border hover:opacity-80 transition-opacity",
        collapsed && "justify-center px-2"
      )}>
        <img
          src={rhozelandLogo}
          alt="Rhozeland"
          className="h-8 w-8 shrink-0 object-contain"
        />
        {!collapsed && (
          <span className="font-body text-lg font-bold tracking-tight text-foreground">
            Rhozeland
          </span>
        )}
      </Link>

      <SidebarContent className="px-2 pt-3">
        {renderGroup("Navigation", mainItems)}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4 mt-auto">
        <Link
          to={profilePath}
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 mb-3 transition-all duration-250",
            profileActive
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <Avatar className="h-7 w-7 border border-border shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[9px] font-semibold bg-muted text-muted-foreground font-body">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <span className="text-sm font-medium truncate">
              {profile?.display_name || user?.email?.split("@")[0] || "Profile"}
            </span>
          )}
        </Link>

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
