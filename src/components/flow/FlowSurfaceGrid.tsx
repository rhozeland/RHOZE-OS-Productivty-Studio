/**
 * FlowSurfaceGrid — renders the non-creator-works surfaces (Creators,
 * Listings, Events, Spaces) inline inside Flow Mode when a surface chip
 * other than "All" is selected. Keeps users on /flow without navigating
 * away. Uses the same data hooks as the Connect room so we stay in sync.
 */
import { Link } from "react-router-dom";
import { Loader2, Users, ListPlus, CalendarDays, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useHireRows,
  useCallRows,
  useEventRows,
  useSpaceRows,
  type ConnectRow,
} from "@/components/connect/useConnectRows";

export type FlowSurface = "creators" | "listings" | "events" | "spaces";

const META: Record<FlowSurface, { label: string; Icon: any; empty: string }> = {
  creators: { label: "Creators", Icon: Users, empty: "No creators to surface yet." },
  listings: { label: "Listings", Icon: ListPlus, empty: "No active listings right now." },
  events: { label: "Events", Icon: CalendarDays, empty: "No upcoming events scheduled." },
  spaces: { label: "Spaces", Icon: Building2, empty: "No spaces available right now." },
};

interface Props {
  surface: FlowSurface;
}

export default function FlowSurfaceGrid({ surface }: Props) {
  const creators = useHireRows(surface === "creators");
  const listings = useCallRows(surface === "listings");
  const events = useEventRows(surface === "events");
  const spaces = useSpaceRows(surface === "spaces");

  const active =
    surface === "creators"
      ? creators
      : surface === "listings"
        ? listings
        : surface === "events"
          ? events
          : spaces;

  const rows: ConnectRow[] = (active.data ?? []) as ConnectRow[];
  const meta = META[surface];

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 md:px-6">
      {active.isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border/60 bg-card/40 backdrop-blur-sm px-6 py-12 text-center">
          <meta.Icon className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 font-display text-sm font-semibold text-foreground">
            {meta.empty}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try another filter — Flow is always fresh.
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-3 sm:gap-4",
            "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
          )}
        >
          {rows.map((r) => (
            <Link
              key={`${r.kind}-${r.id}`}
              to={r.detailHref}
              className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm hover:border-foreground/30 transition-colors"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                {r.coverUrl ? (
                  <img
                    src={r.coverUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                    <meta.Icon className="h-8 w-8" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 space-y-0.5">
                  <p className="font-display text-sm font-semibold text-foreground line-clamp-1">
                    {r.title}
                  </p>
                  {r.subtitle && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {r.subtitle}
                    </p>
                  )}
                  {(r.priceLabel || r.metaLabel) && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 line-clamp-1">
                      {r.priceLabel || r.metaLabel}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
