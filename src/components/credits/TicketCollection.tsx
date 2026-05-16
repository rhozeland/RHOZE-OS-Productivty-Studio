/**
 * TicketCollection — collectible-card grid of event tickets the user holds.
 * Lives inside the Passport tab (/credits?tab=passport). Replaces the old
 * Upcoming/Past list view with a single smooth collectible row.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Ticket, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/ui/empty-state";

const TicketCollection = ({ userId }: { userId: string }) => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["passport-tickets", userId],
    queryFn: async () => {
      const { data: tix } = await supabase
        .from("event_tickets")
        .select("id, event_id, status, issued_at")
        .eq("holder_id", userId)
        .order("issued_at", { ascending: false });
      const ids = Array.from(new Set((tix ?? []).map((t: any) => t.event_id)));
      if (!ids.length) return [];
      const { data: events } = await supabase
        .from("events")
        .select("id, title, cover_url, starts_at, venue_name, is_online")
        .in("id", ids);
      const evMap = new Map((events ?? []).map((e: any) => [e.id, e]));
      return (tix ?? []).map((t: any) => ({ ...t, event: evMap.get(t.event_id) }));
    },
  });

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-muted/40" />;
  }

  if (!rows.length) {
    return (
      <section className="space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <Ticket className="h-4 w-4 text-muted-foreground" /> Ticket Collection
        </h3>
        <EmptyState
          icon={Ticket}
          title="No tickets yet"
          description="RSVP or grab a ticket to an event and it'll appear here as a collectible stub."
          cta={{ label: "Browse events", to: "/discover?view=events" }}
        />
      </section>
    );
  }

  const now = Date.now();
  // Sort: upcoming first (soonest first), then past (most recent first)
  const sorted = [...rows].sort((a: any, b: any) => {
    const aTime = a.event ? new Date(a.event.starts_at).getTime() : 0;
    const bTime = b.event ? new Date(b.event.starts_at).getTime() : 0;
    const aFuture = aTime >= now;
    const bFuture = bTime >= now;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return aFuture ? aTime - bTime : bTime - aTime;
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-display text-sm font-semibold text-foreground">Ticket Collection</h3>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {rows.length} {rows.length === 1 ? "stub" : "stubs"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sorted.map((t: any) => {
          const ev = t.event;
          const isFuture = ev && new Date(ev.starts_at).getTime() >= now;
          const checked = t.status === "checked_in";
          const pending = t.status === "pending_approval";
          const declined = t.status === "declined";
          const chipLabel = checked ? "Attended" : pending ? "Pending" : declined ? "Declined" : isFuture ? "Upcoming" : "Past";
          const chipClass = checked
            ? "bg-emerald-500/90 text-white"
            : pending
            ? "bg-amber-500/90 text-white"
            : declined
            ? "bg-muted text-muted-foreground"
            : isFuture
            ? "bg-white/90 text-foreground"
            : "bg-foreground/80 text-background";

          return (
            <Link
              key={t.id}
              to={`/tickets/${t.id}`}
              state={{ from: "/credits?tab=passport" }}
              className={`group block ${!isFuture && !pending ? "opacity-95" : ""}`}
            >
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-muted border border-border group-hover:border-foreground/30 transition-all duration-300 group-hover:shadow-lg">
                {ev?.cover_url ? (
                  <img
                    src={ev.cover_url}
                    alt={ev.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center">
                    <CalendarDays className="h-8 w-8 text-foreground/25" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                <span className={`absolute top-2 left-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-medium ${chipClass}`}>
                  {chipLabel}
                </span>

                <div className="absolute inset-x-2.5 bottom-2.5 text-white">
                  <p className="text-[11px] font-semibold leading-tight line-clamp-2">
                    {ev?.title ?? "Event"}
                  </p>
                  {ev?.starts_at && (
                    <p className="text-[9px] opacity-80 mt-0.5">
                      {format(new Date(ev.starts_at), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default TicketCollection;
