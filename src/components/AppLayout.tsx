import { useNavigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import DockBar from "@/components/DockBar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import WalletButton from "@/components/WalletButton";
import NotificationBell from "@/components/NotificationBell";
import { Input } from "@/components/ui/input";
import { Workflow } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AppLayout = () => {
  const navigate = useNavigate();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/90 backdrop-blur-sm px-4 md:px-6 gap-4">
            <SidebarTrigger className="mr-1 shrink-0" />

            {/* Search input with Flow mode button inside */}
            <div className="hidden md:flex flex-1 max-w-lg justify-center">
              <div className="relative w-full max-w-md">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate("/flow")}
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-opacity hover:opacity-80 active:opacity-70"
                    >
                      <Workflow className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs font-body">
                    Discover in Flow Mode
                  </TooltipContent>
                </Tooltip>
                <Input
                  placeholder="Search Rhozeland..."
                  className="pl-11 h-9 rounded-full bg-card border-border text-sm font-body"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <WalletButton />
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