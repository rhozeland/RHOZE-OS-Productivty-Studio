import { useState, useEffect, useCallback } from "react";
import { useNavigate, NavLink, Link } from "react-router-dom";
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

// Persistent top-nav links shown in header for both guests and signed-in users
const HEADER_NAV = [
  { name: "Studios", path: "/studios" },
  { name: "Hub", path: "/creators" },
  { name: "Boards", path: "/smartboards" },
  { name: "Drops", path: "/droprooms" },
];

const AppLayout = () => {
  const navigate = useNavigate();
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
              {/* Persistent top-nav links — visible on desktop for guests + signed-in */}
              <nav className="hidden lg:flex items-center gap-1">
                {HEADER_NAV.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        "px-3 py-1.5 rounded-lg text-sm font-body font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )
                    }
                  >
                    {item.name}
                  </NavLink>
                ))}
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
          {user && <DockBar />}
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
