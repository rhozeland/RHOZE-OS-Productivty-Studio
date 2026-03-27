import { Link } from "react-router-dom";
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

const AppLayout = () => {
  const { user } = useAuth();

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
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4 md:px-6 gap-4">
            <SidebarTrigger className="mr-1 shrink-0" />

            {/* Center search */}
            <div className="hidden md:flex flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-9 h-9 rounded-full bg-muted/50 border-border text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <WalletButton />
              <Link to={user?.id ? `/profiles/${user.id}` : "/settings"} className="ml-1">
                <Avatar className="h-8 w-8 border border-border hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
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
