import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, NavLink, useLocation } from "react-router-dom";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import RhozeBalanceChip from "@/components/RhozeBalanceChip";
import NotificationBell from "@/components/NotificationBell";
import UsernamePrompt from "@/components/UsernamePrompt";
// FlowLauncher (floating FAB) retired — Flow is now reachable via the Hub view toggle + HubFlowWidget.
// DockBar retired in v7 (post phase-2) — navigation happens via the left side nav + global ⌘K search.
import { Workflow, Search, Building2, ShoppingBag, User, Palette, Radio, FolderKanban, Calendar, Settings as SettingsIcon, LogOut, Coins } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  type NavItem,
} from "@/config/navigation";
import { resolveNavLink } from "@/hooks/useNavLink";
import { useNavShortcuts } from "@/hooks/useNavShortcuts";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { NAV_SHORTCUTS, formatChord, formatLeader } from "@/lib/nav-shortcuts";
import { REGISTERED_ROUTE_PATHS } from "@/App";
import HudDock from "@/components/hud/HudDock";
import { CelebrationProvider } from "@/components/hud/CelebrationProvider";

const PAGES = [
  { name: "Home", path: "/discover", icon: FolderKanban },
  { name: "Projects", path: "/projects", icon: FolderKanban },
  { name: "Messages", path: "/messages", icon: User },
  { name: "Credits", path: "/credits", icon: ShoppingBag },
  { name: "Settings", path: "/settings", icon: SettingsIcon },
];

// Persistent top-nav links shown in header for both guests and signed-in users.
// Sourced from the central NAV_ITEMS config — the matchPaths there (e.g. Drops →
// `/droprooms` legacy alias) and the shared `isNavItemActive` helper guarantee
// consistent active styling across header, dock, and any future nav surfaces.
// Header chips removed — these surfaces are reachable via the sidebar / dock.
// Keeping the structure in place so re-enabling specific links is a one-line change.
const HEADER_NAV_IDS = [] as const;
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
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Reset query when the palette closes so the next open starts clean.
  useEffect(() => {
    if (!searchOpen) setSearchQuery("");
  }, [searchOpen]);

  // Only run remote search after the user actually types something — avoids
  // dumping every studio/creator/listing into the palette by default.
  const trimmedQuery = searchQuery.trim();
  const queryEnabled = searchOpen && trimmedQuery.length >= 2;

  // Only run reward streak for authenticated users
  useRewardStreak();

  // Global navigation shortcuts (Alt+1..4 and "g d / p / c / f").
  // Active state in the dock / header / sidebar already syncs via
  // `useLocation` + `isNavItemActive`, so navigating is enough.
  useNavShortcuts();

  // Per-route scroll restoration: top on fresh PUSH, restore on POP
  // (back/forward), no-op on REPLACE so hash-only updates (Settings
  // sub-nav) don't jump the page.
  useScrollRestoration();

  // Keyboard shortcut — Cmd/Ctrl+K opens the search palette.
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

  // Query-driven search — only fires once the user has typed ≥2 characters.
  // Keeps the palette quiet by default (Pages only) and prevents an
  // ever-growing dump of every studio/creator/listing in the system.
  const { data: studios } = useQuery({
    queryKey: ["search-studios", trimmedQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("id, name, city, category")
        .eq("is_active", true)
        .eq("status", "approved")
        .ilike("name", `%${trimmedQuery}%`)
        .limit(5);
      return data ?? [];
    },
    enabled: queryEnabled,
  });

  const { data: listings } = useQuery({
    queryKey: ["search-listings", trimmedQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("id, title, category")
        .eq("is_active", true)
        .ilike("title", `%${trimmedQuery}%`)
        .limit(5);
      return data ?? [];
    },
    enabled: queryEnabled,
  });

  const { data: profiles } = useQuery({
    queryKey: ["search-profiles", trimmedQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("is_public", true)
        .not("display_name", "is", null)
        .ilike("display_name", `%${trimmedQuery}%`)
        .limit(5);
      return data ?? [];
    },
    enabled: queryEnabled,
  });

  const { data: coins } = useQuery({
    queryKey: ["search-coins", trimmedQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, mint_address")
        .neq("status", "cancelled")
        .or(`ticker.ilike.%${trimmedQuery}%,name.ilike.%${trimmedQuery}%,mint_address.ilike.%${trimmedQuery}%`)
        .limit(5);
      return data ?? [];
    },
    enabled: queryEnabled,
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
      <CelebrationProvider>
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
                  // Use NavLink so React Router manages aria-current="page",
                  // but combine with our shared resolver so legacy matchPaths
                  // (e.g. /droprooms → Drops) also activate.
                  const shared = resolveNavLink(item, location.pathname);
                  return (
                    <NavLink
                      key={item.id}
                      to={shared.to}
                      end={shared.to === "/"}
                      className={({ isActive }) => {
                        const active = isActive || shared.isActive;
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

            {/* Search trigger — flame/Flow launcher retired (Flow now lives via Hub view toggle + HubFlowWidget). */}
            <div className="hidden md:flex flex-1 max-w-lg justify-center">
              <div className="relative w-full max-w-md">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-full h-9 rounded-full bg-card border border-border text-sm font-body text-muted-foreground text-left hover:bg-muted/50 transition-colors flex items-center pr-3 pl-4"
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

              {/* Theme toggle moved to Settings → Account (per v8.7 cleanup). */}

              {user && <NotificationBell />}
              {user && <RhozeBalanceChip />}

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
                  onClick={() => navigate("/landing")}
                  className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
                >
                  Sign in
                </button>
              )}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 pb-8">
            <Outlet />
          </main>
          {/* HUD Dock — gamified player bar (level / XP / streak / $RHOZE / nav) */}
          <HudDock />

        </div>
      </div>


      {/* Command palette search */}
      {/* Command palette search — Pages always visible; studios/listings/creators
          only surface once the user has typed (>=2 chars). */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput
          placeholder="Search pages, studios, listings, creators..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {queryEnabled ? "No results found." : "Type to search the network."}
          </CommandEmpty>
          <CommandGroup heading="Pages">
            {PAGES.map((page) => {
              const shortcut = NAV_SHORTCUTS.find((s) => s.path === page.path);
              return (
                <CommandItem key={page.path} onSelect={() => goTo(page.path)}>
                  <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {page.name}
                  {shortcut && (
                    <span className="ml-auto flex items-center gap-1">
                      <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                        {formatChord(shortcut.chord)}
                      </kbd>
                      <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                        {formatLeader(shortcut.leaderKey)}
                      </kbd>
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
          {queryEnabled && studios && studios.length > 0 && (
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
          {queryEnabled && listings && listings.length > 0 && (
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
          {queryEnabled && profiles && profiles.length > 0 && (
            <CommandGroup heading="Creators">
              {profiles.map((p) => (
                <CommandItem key={p.user_id} onSelect={() => goTo(`/profiles/${p.user_id}`)}>
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  {p.display_name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {queryEnabled && coins && coins.length > 0 && (
            <CommandGroup heading="Coins">
              {coins.map((c) => (
                <CommandItem key={c.id} onSelect={() => goTo(`/coin/${c.mint_address || c.ticker}`)}>
                  <Coins className="mr-2 h-4 w-4 text-emerald-500" />
                  <span className="font-mono">${c.ticker}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
      {user && <UsernamePrompt />}
      </CelebrationProvider>
    </SidebarProvider>
  );
};

export default AppLayout;
