/**
 * TicketsTab — surfaced in /credits?tab=tickets.
 * Lists upcoming + past tickets with cover art and links to /tickets/:id.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarDays, MapPin, Globe2, Ticket, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const TicketsTab = ({ userId }: { userId: string }) => {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-tickets", userId],
    queryFn: async () => {
      const { data: tix } = await supabase
        .from("event_tickets")
        .select("id, event_id, tier_id, status, issued_at")
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

  const now = Date.now();
  const upcoming = rows.filter((r: any) => r.event && new Date(r.event.starts_at).getTime() >= now);
  const past = rows.filter((r: any) => r.event && new Date(r.event.starts_at).getTime() < now);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted/40" />;
  }
  if (!rows.length) {
    return (
      <EmptyState
        icon={Ticket}
        title="No tickets yet"
        description="RSVP or grab a ticket to an event and it'll appear here with your QR + receipt."
        cta={{ label: "Browse events", to: "/discover?view=events" }}
      />
    );
  }

  const Card = ({ row }: { row: any }) => {
    const e = row.event;
    const pending = row.status === "pending_approval";
    const declined = row.status === "declined";
    return (
      <Link
        to={`/tickets/${row.id}`}
        state={{ from: "/credits?tab=tickets" }}
        className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-foreground/30 transition-colors flex"
      >
        <div className="w-28 sm:w-36 aspect-square bg-muted shrink-0 overflow-hidden">
          {e?.cover_url ? (
            <img src={e.cover_url} alt={e.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
              <CalendarDays className="h-8 w-8 text-foreground/20" />
            </div>
          )}
        </div>
        <div className="p-4 flex-1 min-w-0 flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {e?.starts_at && format(new Date(e.starts_at), "EEE, MMM d · h:mm a")}
          </p>
          <h4 className="font-display text-base font-semibold leading-tight line-clamp-2">{e?.title}</h4>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-auto">
            {e?.is_online ? <><Globe2 className="h-3.5 w-3.5" /> Online</> :
              e?.venue_name ? <><MapPin className="h-3.5 w-3.5" /><span className="truncate">{e.venue_name}</span></> : null}
          </div>
          {pending && (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600">
              <Clock className="h-3 w-3" /> Awaiting host approval
            </span>
          )}
          {declined && (
            <span className="inline-flex self-start rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              Request declined
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Upcoming</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {upcoming.map((r: any) => <Card key={r.id} row={r} />)}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-muted-foreground">Past</h2>
          <div className="grid md:grid-cols-2 gap-3 opacity-80">
            {past.map((r: any) => <Card key={r.id} row={r} />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default TicketsTab;
