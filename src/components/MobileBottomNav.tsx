import { Link, useLocation } from "react-router-dom";
import { Home, Compass, TrendingUp, Users, Gem, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveRole } from "@/hooks/useActiveRole";

const FAN_TABS = [
  { label: "Home", icon: Home, path: "/flow" },
  { label: "Discover", icon: Compass, path: "/discover" },
  { label: "Charts", icon: TrendingUp, path: "/charts" },
  { label: "Network", icon: Users, path: "/market" },
  { label: "Pass", icon: Gem, path: "/credits" },
];

const MUSICIAN_TABS = [
  { label: "Home", icon: Home, path: "/flow" },
  { label: "Studio", icon: Layers, path: "/my-projects" },
  { label: "Discover", icon: Compass, path: "/discover" },
  { label: "Network", icon: Users, path: "/market" },
  { label: "Pass", icon: Gem, path: "/credits" },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const [role] = useActiveRole();
  const tabs = role === "creator" ? MUSICIAN_TABS : FAN_TABS;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      {tabs.map((t) => {
        const active = pathname === t.path || pathname.startsWith(t.path + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.path}
            to={t.path}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={cn("h-5 w-5", active && "fill-primary/10")} strokeWidth={active ? 2.4 : 2} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
