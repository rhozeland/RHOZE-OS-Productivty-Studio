import { Link } from "react-router-dom";
import { Building2, Briefcase, Users, ArrowRight } from "lucide-react";
import MarketplacePage from "@/pages/MarketplacePage";

/**
 * THE MARKET — Room 2 (Work / Utility).
 *
 * Three clear categories: Studio Booking · Gigs/Jobs · Services.
 */
const CATEGORIES = [
  {
    to: "/marketplace?kind=space",
    label: "Studio Booking",
    desc: "Book studios, venues & spaces",
    Icon: Building2,
    accent: "from-sky-500/20 to-sky-500/5",
  },
  {
    to: "/marketplace?kind=opportunity",
    label: "Gigs & Jobs",
    desc: "Open calls, briefs & opportunities",
    Icon: Briefcase,
    accent: "from-amber-500/20 to-amber-500/5",
  },
  {
    to: "/services",
    label: "Services",
    desc: "Hire creators · book talent",
    Icon: Users,
    accent: "from-fuchsia-500/20 to-fuchsia-500/5",
  },
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

      {/* Category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CATEGORIES.map(({ to, label, desc, Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${accent} hover:border-foreground/40 transition-colors p-5`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="h-10 w-10 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center">
                <Icon className="h-5 w-5 text-foreground" />
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="font-display text-lg font-semibold leading-tight">{label}</div>
            <div className="text-xs text-muted-foreground mt-1">{desc}</div>
          </Link>
        ))}
      </div>

      <MarketplacePage />
    </div>
  );
};

export default MarketRoomPage;
