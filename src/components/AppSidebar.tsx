import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Settings,
  LogIn,
  CreditCard,
  MessageSquare,
  UserPlus,
  Compass,
  User as UserIcon,
  Calendar,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { resolveNavLink } from "@/hooks/useNavLink";
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
import SidebarHud from "@/components/hud/SidebarHud";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

// v8: primary pillars in the side nav. Hub + My Studio retired —
// Discover is the unified front door, Conversations holds every back-
// and-forth (DMs + Projects + Inquiries + Listings).
const pillarItems = [
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: MessageSquare, label: "Inbox", path: "/messages" },
  { icon: Calendar, label: "Events", path: "/events" },
  { icon: ShoppingBag, label: "Marketplace", path: "/marketplace" },
  { icon: CreditCard, label: "Creator Pass", path: "/credits" },
];

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const personalItems = user && isAdmin
    ? [{ icon: ShieldCheck, label: "Admin", path: "/admin" }]
    : [];

  const renderNavItem = (item: any) => {
    const { to, isActive: active, ariaCurrent } = resolveNavLink(
      { path: item.path },
      location.pathname,
    );

    return (
      <SidebarMenuItem key={item.path + item.label} className={cn(collapsed && "flex justify-center")}>
        <SidebarMenuButton
          asChild
          tooltip={collapsed ? item.label : undefined}
          isActive={active}
          className={cn(collapsed && "mx-auto")}
        >
          <Link
            to={to}
            aria-current={ariaCurrent}
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
            {!collapsed && <span className="flex-1">{item.label}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (items: any[], opts?: { label?: string }) => (
    <SidebarGroup>
      {!collapsed && opts?.label && (
        <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3 mb-1">
          {opts.label}
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
      <Link to="/discover" className={cn(
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

      <SidebarContent className="px-2 pt-3 space-y-2">
        {renderGroup(pillarItems, { label: "Explore" })}
        {personalItems.length > 0 && renderGroup(personalItems)}
      </SidebarContent>

      <SidebarFooter className="px-0 pb-3 mt-auto">
        {user ? (
          <SidebarHud />
        ) : (
          <div className="px-2 border-t border-sidebar-border pt-3 space-y-1">
            <SidebarMenu className="space-y-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={collapsed ? "Sign In" : undefined}
                  onClick={() => navigate("/auth")}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-250"
                >
                  <LogIn className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Sign In</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={collapsed ? "Sign Up" : undefined}
                  onClick={() => navigate("/auth")}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 transition-all duration-250"
                >
                  <UserPlus className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Sign Up Free</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
