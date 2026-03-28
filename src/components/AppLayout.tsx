import { Link, useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import DockBar from "@/components/DockBar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import WalletButton from "@/components/WalletButton";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AppLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
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

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/90 backdrop-blur-sm px-4 md:px-6 gap-4">
            <SidebarTrigger className="mr-1 shrink-0" />

            {/* Search bar — clicking opens Flow mode */}
            {/* Search input + Flow mode icon */}
            <div className="hidden md:flex flex-1 max-w-lg items-center gap-2 justify-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search Rhozeland..."
                  className="pl-9 h-9 rounded-full bg-card border-border text-sm font-body"
                />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate("/flow")}
                    className="shrink-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-opacity hover:opacity-80 active:opacity-70"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-body">
                  Discover in Flow Mode
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <WalletButton />
              <Link to={user?.id ? `/profiles/${user.id}` : "/settings"} className="ml-1">
                <Avatar className="h-7 w-7 border border-border hover:opacity-80 transition-opacity cursor-pointer">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground font-body">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 pb-24">
            <Outlet />
          </main>
          <DockBar />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;