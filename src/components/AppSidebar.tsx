import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LogIn,
  LogOut,
  CreditCard,
  MessageSquare,
  UserPlus,
  Compass,
  User as UserIcon,
  ShieldCheck,
  Flame,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useCreatorXP } from "@/hooks/useCreatorXP";
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
import rhozelandLogo from "@/assets/rhozeland-logo.png";

// v8: primary pillars in the side nav. Hub + My Studio retired —
// Discover is the unified front door, Conversations holds every back-
// and-forth (DMs + Projects + Inquiries + Listings).
const pillarItems = [
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: MessageSquare, label: "Inbox", path: "/messages" },
  { icon: CreditCard, label: "Creator Pass", path: "/credits" },
];

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { data: xp } = useCreatorXP();

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

  const tierColor = xp?.titleColor ?? "210 60% 55%";
  const level = xp?.level ?? 1;
  const title = xp?.title ?? "Newcomer";
  const progressPct = xp?.progressPct ?? 0;
  const totalXP = xp?.totalXP ?? 0;
  const nextLevelXP = xp?.nextLevelXP ?? 20;
  const streak = xp?.streak ?? 0;

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
        {/* ── Player HUD (bottom of sidebar) ── */}
        {user && (
          <div className="px-2 border-t border-sidebar-border pt-3">
            <Link
              to="/credits"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/40 transition-colors",
                collapsed && "justify-center px-1"
              )}
            >
              {/* Gem orb */}
              <div
                className="relative h-8 w-8 rounded-full overflow-hidden shrink-0"
                style={{
                  background: `radial-gradient(circle at 35% 30%, hsl(${tierColor} / 0.95), hsl(${tierColor} / 0.5) 55%, hsl(${tierColor} / 0.15) 90%)`,
                  boxShadow: `0 0 10px hsl(${tierColor} / 0.5), inset 0 -2px 4px hsl(${tierColor} / 0.4), inset 0 2px 3px rgba(255,255,255,0.4)`,
                }}
              >
                <motion.div
                  aria-hidden="true"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 opacity-50"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.4), transparent 40%)",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-[10px] font-bold text-white"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                  >
                    {level}
                  </span>
                </div>
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80 truncate">
                      {title}
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground tabular-nums">
                      {totalXP}/{nextLevelXP}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={nextLevelXP}
                    aria-valuenow={totalXP}
                    className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1"
                  >
                    <motion.div
                      key={progressPct}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, hsl(${tierColor}), hsl(${tierColor} / 0.6))`,
                        boxShadow: `0 0 6px hsl(${tierColor} / 0.5)`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Streak chip — only in expanded mode */}
              {!collapsed && streak > 0 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--orange)/0.12)] border border-[hsl(var(--orange)/0.3)] shrink-0">
                  <Flame className="h-3 w-3" style={{ color: "hsl(var(--orange))" }} />
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: "hsl(var(--orange))" }}>
                    {streak}d
                  </span>
                </div>
              )}
            </Link>
          </div>
        )}

        {/* Guest auth links */}
        {!user && (
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
