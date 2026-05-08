import { Link } from "react-router-dom";
import { Building2, Briefcase, FolderKanban, Calendar, Store, ArrowRight } from "lucide-react";
import MarketplacePage from "@/pages/MarketplacePage";

/**
 * THE MARKET — Room 2 (Work / Utility).
 *
 * Front door for studio booking, listings, services, and projects. Renders
 * the existing Marketplace mosaic with quick links to the work-oriented
 * routes that live inside this room.
 */
const QUICK_LINKS = [
  { to: "/spaces", label: "Spaces", desc: "Book studios & venues", Icon: Building2 },
  { to: "/services", label: "Services", desc: "Hire creators", Icon: Briefcase },
  { to: "/projects", label: "Projects", desc: "Active collabs", Icon: FolderKanban },
  { to: "/calendar", label: "Calendar", desc: "Bookings & events", Icon: Calendar },
];

const MarketRoomPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <span className="text-[10px] uppercase tracking-[0.28em] text-primary font-semibold">
          Room 2 · The Market
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Work · Utility
        </span>
      </div>

      {/* Quick-link grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {QUICK_LINKS.map(({ to, label, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="group relative rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors p-3.5"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className="h-4 w-4 text-foreground" />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="font-display text-sm font-semibold leading-tight">{label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
          </Link>
        ))}
      </div>

      <MarketplacePage />
    </div>
  );
};

export default MarketRoomPage;
