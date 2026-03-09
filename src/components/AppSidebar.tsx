import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  CalendarCheck,
  Compass,
  LayoutGrid,
  Store,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Briefcase,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import logoColor from "@/assets/toybox-logo-color.webp";
import logoWhite from "@/assets/toybox-logo-white.png";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Briefcase, label: "Services", path: "/services" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: CalendarCheck, label: "Bookings", path: "/bookings" },
  { icon: Coins, label: "Credit Shop", path: "/credits" },
  { icon: Compass, label: "Flow", path: "/flow" },
  { icon: LayoutGrid, label: "Smartboards", path: "/smartboards" },
  { icon: Store, label: "Marketplace", path: "/marketplace" },
  { icon: Users, label: "Profiles", path: "/profiles" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const AppSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const currentLogo = theme === "dark" ? logoWhite : logoColor;

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className={cn(
        "flex h-16 items-center gap-3 px-4 border-b border-sidebar-border",
        collapsed && "justify-center px-2"
      )}>
        <img
          src={currentLogo}
          alt="Toybox"
          className="h-8 w-8 shrink-0 object-contain"
        />
        {!collapsed && (
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Rhozeland
          </span>
        )}
      </div>

      <SidebarContent className="px-2 pt-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      tooltip={collapsed ? item.label : undefined}
                      isActive={isActive}
                    >
                      <Link
                        to={item.path}
                        onClick={handleNavClick}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-250",
                          isActive
                            ? "sidebar-active-gradient text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors duration-250",
                          isActive ? "text-primary" : ""
                        )} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <div className="border-t border-sidebar-border pt-3">
          <SidebarMenu>
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
