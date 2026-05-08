/**
 * DiscoverEventsGrid — Discover Stream "Events" view.
 *
 * Compact 2-column grid of upcoming published events. Each card carries
 * the cover image, title, date/time, location, and a primary "Show
 * interest" CTA that routes to the event detail page where RSVP /
 * checkout flows live.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { CalendarDays, MapPin, Globe2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface DiscoverEventsGridProps {
  /** Normalized category slug (e.g. "music") or null for "all". */
  category?: string | null;
  search?: string;
}

const DiscoverEventsGrid = ({ category = null, search = "" }: DiscoverEventsGridProps) => {
  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ["discover-events-grid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, cover_url, starts_at, ends_at, category, venue_name, venue_address, is_online, host_id")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const term = search.trim().toLowerCase();
  const filtered = (events ?? []).filter((e: any) => {
    if (category && (e.category ?? "").toLowerCase() !== category) return false;
    if (!term) return true;
    return (
      e.title?.toLowerCase().includes(term) ||
      e.venue_name?.toLowerCase().includes(term)
    );
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={category ? `No upcoming ${category} events` : "No upcoming events"}
        description="Be the first to host one — workshops, screenings, listening parties, anything."
        cta={{ label: "Host an event", to: "/spaces/events/new" }}
        secondary={category ? { label: "Show all events", onClick: () => navigate("/discover?view=events") } : undefined}
        size="lg"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {filtered.map((e: any, i: number) => {
        const starts = new Date(e.starts_at);
        const dateLabel = format(starts, "EEE, MMM d");
        const timeLabel = format(starts, "h:mm a");
        const locationLabel = e.is_online
          ? "Online"
          : e.venue_name || e.venue_address || "TBA";

        return (
          <motion.article
            key={e.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            onClick={() => navigate(`/spaces/events/${e.id}`)}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card hover:border-foreground/40 hover:shadow-lg transition-all cursor-pointer flex flex-col"
          >
            {/* Cover */}
            <div className="relative aspect-[16/9] overflow-hidden bg-muted">
              {e.cover_url ? (
                <img
                  src={e.cover_url}
                  alt={e.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-rose-500/10 to-transparent flex items-center justify-center">
                  <CalendarDays className="h-10 w-10 text-pink-500/40" />
                </div>
              )}
              {/* Date pill */}
              <div className="absolute top-3 left-3 rounded-xl bg-background/95 backdrop-blur-sm px-2.5 py-1.5 shadow-sm flex flex-col items-center leading-none">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {format(starts, "MMM")}
                </span>
                <span className="text-base font-display font-bold text-foreground">
                  {format(starts, "d")}
                </span>
              </div>
              {e.category && (
                <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-background/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  {e.category}
                </span>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col p-4 gap-2">
              <h3 className="font-display font-semibold text-base text-foreground leading-tight line-clamp-2">
                {e.title}
              </h3>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {dateLabel} · {timeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {e.is_online ? (
                    <Globe2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{locationLabel}</span>
                </div>
              </div>

              <Button
                size="sm"
                className="mt-2 w-full"
                onClick={(ev) => {
                  ev.stopPropagation();
                  navigate(`/spaces/events/${e.id}`);
                }}
              >
                Show interest
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
};

export default DiscoverEventsGrid;
