import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, NavLink, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import DockBar from "@/components/DockBar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import WalletButton from "@/components/WalletButton";
import NotificationBell from "@/components/NotificationBell";
import UsernamePrompt from "@/components/UsernamePrompt";
import { Workflow, Search, Building2, ShoppingBag, User, Palette, Radio, FolderKanban, Calendar, Sun, Moon, Settings as SettingsIcon, LogOut, Flame } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRewardStreak } from "@/hooks/useRewardStreak";
import {
  NAV_ITEMS_BY_ID,
  isNavItemActive,
  type NavItem,
} from "@/config/navigation";
import { REGISTERED_ROUTE_PATHS } from "@/App";

const PAGES = [
  { name: "Home", path: "/dashboard", icon: FolderKanban },
  { name: "Studios", path: "/studios", icon: Building2 },
  { name: "Creators Hub", path: "/creators", icon: Flame },
  { name: "Smartboards", path: "/smartboards", icon: Palette },
  { name: "Drop Rooms", path: "/droprooms", icon: Radio },
  { name: "Messages", path: "/messages", icon: User },
  { name: "Projects", path: "/projects", icon: FolderKanban },
  { name: "Credits", path: "/credits", icon: ShoppingBag },
  { name: "Settings", path: "/settings", icon: SettingsIcon },
];

// Persistent top-nav links shown in header for both guests and signed-in users.
// Sourced from the central NAV_ITEMS config — the matchPaths there (e.g. Drops →
// `/droprooms` legacy alias) and the shared `isNavItemActive` helper guarantee
// consistent active styling across header, dock, and any future nav surfaces.
const HEADER_NAV_IDS = ["studios", "hub", "boards", "droprooms"] as const;
const HEADER_NAV: NavItem[] = HEADER_NAV_IDS
  .map((id) => NAV_ITEMS_BY_ID[id])
  .filter(Boolean);

// Header label overrides (kept short for the top bar even if the dock uses
// a different label). Maps NavItem.id → header label.
const HEADER_LABELS: Record<string, string> = {
  hub: "Hub",
  boards: "Boards",
  droprooms: "Drops",
};

/**
 * Returns true if `navPath` matches one of the registered <Route> path
 * patterns. Handles dynamic segments (`:id`) and wildcards (`*`).
 */
const matchesRegisteredRoute = (navPath: string, routes: string[]): boolean => {
  return routes.some((route) => {
    // Strip wildcard suffix — `/droprooms/*` should match `/droprooms`.
    const base = route.replace(/\/\*$/, "");
    if (base === navPath) return true;
    // Compare segment-by-segment so `:id` matches anything non-empty.
    const navSegs = navPath.split("/").filter(Boolean);
    const routeSegs = base.split("/").filter(Boolean);
    if (navSegs.length !== routeSegs.length) return false;
    return routeSegs.every(
      (seg, i) => seg.startsWith(":") || seg === navSegs[i],
    );
  });
};

// Dev-only sanity check: warn once if any header nav item points to a path
// that has no matching <Route> in App.tsx. Catches future broken links when
// routes are renamed or removed without updating navigation config.
if (import.meta.env.DEV) {
  const broken = HEADER_NAV.filter(
    (item) => !matchesRegisteredRoute(item.path, REGISTERED_ROUTE_PATHS),
  );
  if (broken.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[AppLayout] Header nav items reference paths with no matching route:",
      broken.map((b) => ({ id: b.id, path: b.path })),
      "\nUpdate REGISTERED_ROUTE_PATHS in src/App.tsx or the nav config in src/config/navigation.ts.",
    );
  }
}

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  // Only run reward streak for authenticated users
  useRewardStreak();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search studios
  const { data: studios } = useQuery({
    queryKey: ["search-studios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("id, name, city, category")
        .eq("is_active", true)
        .eq("status", "approved")
        .limit(50);
      return data ?? [];
    },
    enabled: searchOpen,
  });

  // Search listings
  const { data: listings } = useQuery({
    queryKey: ["search-listings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("id, title, category")
        .eq("is_active", true)
        .limit(50);
      return data ?? [];
    },
    enabled: searchOpen,
  });

  // Search profiles
  const { data: profiles } = useQuery({
    queryKey: ["search-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("is_public", true)
        .not("display_name", "is", null)
        .limit(50);
      return data ?? [];
    },
    enabled: searchOpen,
  });

  // Header avatar
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-header", user?.id],
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

  const initials = myProfile?.display_name
    ? myProfile.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  const goTo = useCallback((path: string) => {
    setSearchOpen(false);
    navigate(path);
  }, [navigate]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 backdrop-blur-sm px-4 md:px-6 gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <SidebarTrigger className="shrink-0" />
              {/* Persistent top-nav links — visible on desktop for guests + signed-in.
                  Uses shared `isNavItemActive` helper so deep links like
                  /drop-rooms/:id stay highlighted (and any new matchPaths in
                  navigation.ts are picked up automatically). */}
              <nav className="hidden lg:flex items-center gap-1">
                {HEADER_NAV.map((item) => {
                  const label = HEADER_LABELS[item.id] ?? item.label;
                  // Use NavLink so React Router manages aria-current="page".
                  // We also call our shared `isNavItemActive` to cover legacy
                  // matchPaths (e.g. /droprooms → Drops) that NavLink's own
                  // matcher won't know about.
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      end={item.path === "/"}
                      className={({ isActive }) => {
                        const active =
                          isActive || isNavItemActive(item, location.pathname);
                        return cn(
                          "px-3 py-1.5 rounded-lg text-sm font-body font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          active
                            ? // Active styles win over hover/focus by repeating
                              // bg + text in hover/focus variants.
                              "bg-muted text-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:text-foreground focus-visible:bg-muted/60",
                        );
                      }}
                    >
                      {label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Search trigger with Flow mode button */}
            <div className="hidden md:flex flex-1 max-w-lg justify-center">
              <div className="relative w-full max-w-md">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate("/flow")}
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-opacity hover:opacity-80 active:opacity-70 z-10"
                    >
                      <Workflow className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs font-body">
                    Discover in Flow Mode
                  </TooltipContent>
                </Tooltip>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-full pl-11 h-9 rounded-full bg-card border border-border text-sm font-body text-muted-foreground text-left px-11 hover:bg-muted/50 transition-colors flex items-center"
                >
                  Search Rhozeland...
                  <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">⌘K</kbd>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile search trigger — desktop has the inline search bar */}
              <button
                onClick={() => setSearchOpen(true)}
                className="md:hidden h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted/50 transition-colors"
                aria-label="Search"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Theme toggle — visible to everyone */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted/50 transition-colors"
                    aria-label="Toggle theme"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Moon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-body">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </TooltipContent>
              </Tooltip>

              {user && <NotificationBell />}
              {user && <WalletButton />}

              {/* Profile dropdown — top-right */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 rounded-full overflow-hidden border border-border hover:opacity-80 transition-opacity" aria-label="Account menu">
                      <Avatar className="h-full w-full">
                        <AvatarImage src={myProfile?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground font-body">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium truncate">{myProfile?.display_name || user.email?.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={`/profiles/${user.id}`} className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="cursor-pointer">
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {!user && (
                <button
                  onClick={() => navigate("/auth")}
                  className="text-xs font-body font-medium text-primary-foreground bg-primary px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                >
                  Sign Up
                </button>
              )}
            </div>
          </header>
          <main className={`flex-1 p-4 md:p-8 ${user ? "pb-32" : "pb-8"}`}>
            <Outlet />
          </main>
          {user && !location.pathname.startsWith("/flow") && <DockBar />}
        </div>
      </div>

      {/* Command palette search */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search pages, studios, listings, creators..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {PAGES.map((page) => (
              <CommandItem key={page.path} onSelect={() => goTo(page.path)}>
                <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {page.name}
              </CommandItem>
            ))}
          </CommandGroup>
          {studios && studios.length > 0 && (
            <CommandGroup heading="Studios">
              {studios.map((s) => (
                <CommandItem key={s.id} onSelect={() => goTo(`/studios/${s.id}`)}>
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  {s.name}
                  {s.city && <span className="ml-auto text-xs text-muted-foreground">{s.city}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {listings && listings.length > 0 && (
            <CommandGroup heading="Marketplace">
              {listings.map((l) => (
                <CommandItem key={l.id} onSelect={() => goTo(`/creators/${l.id}`)}>
                  <ShoppingBag className="mr-2 h-4 w-4 text-muted-foreground" />
                  {l.title}
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{l.category}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {profiles && profiles.length > 0 && (
            <CommandGroup heading="Creators">
              {profiles.map((p) => (
                <CommandItem key={p.user_id} onSelect={() => goTo(`/profiles/${p.user_id}`)}>
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  {p.display_name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
      {user && <UsernamePrompt />}
    </SidebarProvider>
  );
};

export default AppLayout;
