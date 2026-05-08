/**
 * EventsListPanel — events grid embedded in the /spaces?tab=events view.
 *
 * Lists upcoming + past events that are published. Each card links to
 * /spaces/events/:id. Hosts get a quick "Manage" link on their own events.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, MapPin, Plus, Sparkles, Ticket, Globe2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useEventsCta } from "@/hooks/useEventsCta";

const EventsListPanel = () => {
  const { user } = useAuth();

  const { data: events, isLoading } = useQuery({
    queryKey: ["spaces-events-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("status", ["published", "completed"])
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No upcoming events"
        description="Host a show, workshop, screening, or meetup. Every manifest, artifact, and ticket is anchored on-chain."
        cta={user ? { label: "Host the first event", to: "/spaces/events/new" } : { label: "Browse events", to: "/discover?view=events" }}
        size="lg"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {events.map((ev: any, i: number) => {
        const start = new Date(ev.starts_at);
        const isHost = user?.id === ev.host_id;
        return (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={`/spaces/events/${ev.id}`}
              className="group block rounded-2xl bg-card border border-border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                {ev.cover_url ? (
                  <img
                    src={ev.cover_url}
                    alt={ev.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/10">
                    <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground shadow-sm capitalize">
                  {ev.category}
                </div>
                {ev.manifest_hash && (
                  <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-foreground shadow-sm">
                    <Sparkles className="h-3 w-3 text-primary" /> Anchored
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {format(start, "EEE, MMM d · h:mm a")}
                </p>
                <h3 className="font-display font-semibold text-foreground text-base group-hover:text-primary transition-colors line-clamp-1">
                  {ev.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                  {ev.is_online ? (
                    <span className="flex items-center gap-1">
                      <Globe2 className="h-3 w-3" /> Online
                    </span>
                  ) : (
                    ev.venue_name && (
                      <span className="flex items-center gap-1 line-clamp-1">
                        <MapPin className="h-3 w-3" /> {ev.venue_name}
                      </span>
                    )
                  )}
                  {ev.capacity && (
                    <span className="flex items-center gap-1">
                      <Ticket className="h-3 w-3" /> {ev.capacity} cap
                    </span>
                  )}
                </div>
                {isHost && (
                  <div className="pt-2">
                    <span className="inline-flex items-center text-[10px] uppercase tracking-wider rounded-full bg-primary/10 text-primary px-2 py-0.5">
                      You're hosting
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
};

export default EventsListPanel;
