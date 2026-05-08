/**
 * ConversationsEventsBrowser — Luma-style event discovery embedded
 * inside the Conversations page (Events tab).
 *
 * Replaces the standalone /events page. Same visual language:
 * Featured strip + Browse by Category grid + Upcoming list.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  Cpu,
  Utensils,
  Brain,
  Palette,
  Globe2,
  Activity,
  Flower2,
  Bitcoin,
  Music2,
  Users,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useEventsCta } from "@/hooks/useEventsCta";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  category: string;
  starts_at: string;
  ends_at: string;
  is_online: boolean;
  venue_name: string | null;
  venue_address: string | null;
  capacity: number | null;
  host_id: string;
  status: string;
};

const CATEGORY_DEFS = [
  { slug: "tech", label: "Tech", icon: Cpu, accent: "text-amber-500" },
  { slug: "food", label: "Food & Drink", icon: Utensils, accent: "text-orange-500" },
  { slug: "ai", label: "AI", icon: Brain, accent: "text-pink-400" },
  { slug: "art", label: "Arts & Culture", icon: Palette, accent: "text-lime-400" },
  { slug: "climate", label: "Climate", icon: Globe2, accent: "text-emerald-500" },
  { slug: "fitness", label: "Fitness", icon: Activity, accent: "text-rose-500" },
  { slug: "wellness", label: "Wellness", icon: Flower2, accent: "text-cyan-400" },
  { slug: "crypto", label: "Crypto", icon: Bitcoin, accent: "text-violet-500" },
  { slug: "music", label: "Music", icon: Music2, accent: "text-fuchsia-500" },
  { slug: "meetup", label: "Community", icon: Users, accent: "text-sky-400" },
];

const ConversationsEventsBrowser = ({ hideHeading = false }: { hideHeading?: boolean }) => {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["conv-events-browser"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, title, description, cover_url, category, starts_at, ends_at, is_online, venue_name, venue_address, capacity, host_id, status",
        )
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, [events]);

  const filtered = useMemo(() => {
    if (!activeCategory) return events;
    return events.filter((e) => e.category === activeCategory);
  }, [events, activeCategory]);

  const featured = events[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        {hideHeading ? (
          <div />
        ) : (
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Discover events
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              What's happening
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Browse upcoming events from creators across Rhozeland.
            </p>
          </div>
        )}
        {user && (
          <Link to="/spaces/events/new">
            <Button className="rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> Host an event
            </Button>
          </Link>
        )}
      </div>

      {/* Featured */}
      {featured && (
        <Link
          to={`/spaces/events/${featured.id}`}
          className="group block rounded-3xl border border-border bg-card overflow-hidden hover:border-foreground/30 transition-colors"
        >
          <div className="grid md:grid-cols-[1.1fr,1fr]">
            <div className="aspect-[16/9] md:aspect-auto bg-muted relative overflow-hidden">
              {featured.cover_url ? (
                <img
                  src={featured.cover_url}
                  alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 via-fuchsia-500/10 to-amber-500/20 flex items-center justify-center">
                  <Sparkles className="h-12 w-12 text-foreground/30" />
                </div>
              )}
            </div>
            <div className="p-6 md:p-8 flex flex-col justify-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-medium">
                Featured · {format(new Date(featured.starts_at), "MMM d")}
              </span>
              <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight">
                {featured.title}
              </h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(featured.starts_at), "EEE, h:mm a")}
                </span>
                {featured.is_online ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5" /> Online
                  </span>
                ) : featured.venue_name ? (
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5" /> {featured.venue_name}
                  </span>
                ) : null}
              </div>
              {featured.description && (
                <p className="text-sm text-foreground/75 line-clamp-3">
                  {featured.description}
                </p>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Browse by Category */}
      <section className="space-y-4">
        <h3 className="font-display text-lg font-bold tracking-tight">Browse by Category</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CATEGORY_DEFS.map((cat) => {
            const Icon = cat.icon;
            const count = counts.get(cat.slug) ?? 0;
            const active = activeCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(active ? null : cat.slug)}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:bg-muted/40",
                  active ? "border-foreground/40 ring-1 ring-foreground/20" : "border-border",
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                  <Icon className={cn("h-5 w-5", cat.accent)} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {count.toLocaleString()} event{count === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Upcoming list */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold tracking-tight">
            {activeCategory
              ? `${CATEGORY_DEFS.find((c) => c.slug === activeCategory)?.label ?? "Events"}`
              : "Upcoming"}
          </h3>
          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filter
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming events"
            description="Be the first to host one in this category."
            cta={{ label: "Host an event", to: "/spaces/events/new" }}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((e) => (
              <Link
                key={e.id}
                to={`/spaces/events/${e.id}`}
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-foreground/30 transition-colors flex flex-col"
              >
                <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                  {e.cover_url ? (
                    <img
                      src={e.cover_url}
                      alt={e.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center">
                      <CalendarDays className="h-10 w-10 text-foreground/20" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-[10px] font-medium capitalize">
                    {e.category}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(new Date(e.starts_at), "EEE, MMM d · h:mm a")}
                  </p>
                  <h4 className="font-display text-base font-semibold leading-tight line-clamp-2">
                    {e.title}
                  </h4>
                  <div className="mt-auto pt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    {e.is_online ? (
                      <>
                        <Globe2 className="h-3.5 w-3.5" /> Online
                      </>
                    ) : e.venue_name ? (
                      <>
                        <MapPin className="h-3.5 w-3.5" />{" "}
                        <span className="truncate">{e.venue_name}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ConversationsEventsBrowser;
