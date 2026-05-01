/**
 * SpacesHubPage — Luma-inspired hub unifying Events + Spaces.
 *
 * Tabs (Residencies removed — coming later):
 *   • Events    — chronological timeline of published events (default)
 *   • Spaces    — vetted studios marketplace
 *   • Discover  — curated mix: upcoming events + featured spaces + categories
 *
 * URL contract:
 *   /spaces                       → defaults to ?tab=events
 *   /spaces?tab=spaces            → Spaces marketplace
 *   /spaces?tab=discover          → Discover view
 */
import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, isSameDay, isToday, isTomorrow } from "date-fns";
import {
  CalendarDays,
  Building2,
  Compass,
  Plus,
  MapPin,
  Globe2,
  Ticket,
  Sparkles,
  ArrowRight,
  Music,
  Mic,
  Camera,
  Code,
  Palette,
  Coffee,
  Users as UsersIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import StudiosPage from "@/pages/StudiosPage";

type Tab = "events" | "spaces" | "discover";
const isTab = (v: string | null): v is Tab =>
  v === "events" || v === "spaces" || v === "discover";

const CATEGORIES: { key: string; label: string; icon: typeof Music; color: string }[] = [
  { key: "music",       label: "Music & Audio",  icon: Music,    color: "from-pink-500/20 to-rose-500/10" },
  { key: "talks",       label: "Talks & Panels", icon: Mic,      color: "from-amber-500/20 to-orange-500/10" },
  { key: "photo",       label: "Photo & Film",   icon: Camera,   color: "from-violet-500/20 to-purple-500/10" },
  { key: "tech",        label: "Tech & Build",   icon: Code,     color: "from-cyan-500/20 to-blue-500/10" },
  { key: "art",         label: "Art & Culture",  icon: Palette,  color: "from-emerald-500/20 to-teal-500/10" },
  { key: "social",      label: "Socials",        icon: Coffee,   color: "from-yellow-500/20 to-amber-500/10" },
];

/* ──────────────────────────────────────────────────────────────────────
   Header
   ────────────────────────────────────────────────────────────────────── */
const Header = ({ active, user }: { active: Tab; user: any }) => (
  <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-violet-600/[0.08] via-background to-pink-500/[0.06] px-6 py-8 md:px-10 md:py-10">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(280_80%_60%/0.18),transparent_55%)] pointer-events-none" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,hsl(330_80%_60%/0.15),transparent_55%)] pointer-events-none" />
    <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
          Physical Network · Where the work gathers
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-[1.05]">
          Spaces.
        </h1>
        <p className="text-muted-foreground mt-2.5 text-sm md:text-base max-w-lg">
          Browse vetted studios, host or RSVP to events, and discover what the
          community is building IRL — every gathering anchored on Solana.
        </p>
      </div>
      {user && (
        <div className="flex gap-2">
          {active !== "spaces" && (
            <Link to="/spaces/events/new">
              <Button className="rounded-full gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Host an Event
              </Button>
            </Link>
          )}
          {active === "spaces" && (
            <Link to="/studios/apply">
              <Button className="rounded-full gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> List Your Space
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  </div>
);

/* ──────────────────────────────────────────────────────────────────────
   Events: Luma-style timeline
   ────────────────────────────────────────────────────────────────────── */
const dayLabel = (d: Date) => {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, MMM d");
};

const EventTimeline = ({ user }: { user: any }) => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["spaces-events-timeline"],
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

  // Group by day
  const grouped = useMemo(() => {
    if (!events) return [];
    const map = new Map<string, { date: Date; items: any[] }>();
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, { date: d, items: [] });
      map.get(key)!.items.push(ev);
    }
    return Array.from(map.values());
  }, [events]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-6">
            <div className="w-24 h-16 bg-muted animate-pulse rounded" />
            <div className="flex-1 h-32 bg-muted animate-pulse rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center"
      >
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/10 flex items-center justify-center mb-4">
          <CalendarDays className="h-7 w-7 text-foreground/70" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          No events on the calendar.
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Be the first to host. Every manifest, artifact, and check-in is
          SHA-256 anchored on Solana — verifiable provenance for the whole
          gathering.
        </p>
        {user && (
          <Link to="/spaces/events/new">
            <Button className="mt-6 rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> Host the first event
            </Button>
          </Link>
        )}
      </motion.div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical rail */}
      <div className="absolute left-[88px] sm:left-[112px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border/60 to-transparent hidden sm:block" />

      <div className="space-y-10">
        {grouped.map((group, gi) => (
          <motion.section
            key={group.date.toISOString()}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.04 }}
            className="relative flex flex-col sm:flex-row gap-4 sm:gap-8"
          >
            {/* Date column */}
            <div className="sm:w-24 sm:pt-1 flex sm:block items-baseline gap-3">
              <p className="font-display text-2xl font-bold text-foreground leading-none">
                {dayLabel(group.date)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(group.date, "EEEE")}
              </p>
              {/* Dot on rail */}
              <span className="hidden sm:block absolute left-[84px] top-2 h-2 w-2 rounded-full bg-foreground ring-4 ring-background" />
            </div>

            {/* Events for this day */}
            <div className="flex-1 space-y-3">
              {group.items.map((ev: any, i: number) => {
                const start = new Date(ev.starts_at);
                const isHost = user?.id === ev.host_id;
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link
                      to={`/spaces/events/${ev.id}`}
                      className="group flex gap-4 rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-3 sm:p-4 hover:bg-card hover:border-foreground/30 hover:-translate-y-0.5 transition-all"
                    >
                      {/* Cover */}
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden bg-muted">
                        {ev.cover_url ? (
                          <img
                            src={ev.cover_url}
                            alt={ev.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-pink-500/10">
                            <CalendarDays className="h-7 w-7 text-foreground/30" />
                          </div>
                        )}
                        {ev.manifest_hash && (
                          <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full bg-background/90 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-medium text-foreground shadow-sm">
                            <Sparkles className="h-2.5 w-2.5 text-primary" />
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="flex-1 min-w-0 py-1">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                          {format(start, "h:mm a")}
                          <span className="mx-1.5 text-muted-foreground/40">·</span>
                          <span className="capitalize">{ev.category}</span>
                        </p>
                        <h3 className="font-display font-semibold text-foreground text-base sm:text-lg group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                          {ev.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
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
                          {isHost && (
                            <span className="inline-flex items-center text-[10px] uppercase tracking-wider rounded-full bg-primary/10 text-primary px-2 py-0.5">
                              You're hosting
                            </span>
                          )}
                        </div>
                      </div>

                      <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground/40 self-center group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────
   Discover
   ────────────────────────────────────────────────────────────────────── */
const DiscoverPanel = () => {
  const { data: featuredEvents } = useQuery({
    queryKey: ["spaces-discover-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .order("starts_at", { ascending: true })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: featuredSpaces } = useQuery({
    queryKey: ["spaces-discover-spaces"],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("*")
        .eq("is_active", true)
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-12">
      {/* Featured events */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
              On the calendar
            </p>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Coming up
            </h2>
          </div>
          <Link
            to="/spaces?tab=events"
            className="text-xs font-medium text-foreground/80 hover:text-foreground inline-flex items-center gap-1"
          >
            All events <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {featuredEvents && featuredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {featuredEvents.map((ev: any, i: number) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/spaces/events/${ev.id}`}
                  className="group block rounded-2xl bg-card border border-border overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all"
                >
                  <div className="aspect-[4/5] bg-muted relative overflow-hidden">
                    {ev.cover_url ? (
                      <img
                        src={ev.cover_url}
                        alt={ev.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-pink-500/10 flex items-center justify-center">
                        <CalendarDays className="h-10 w-10 text-foreground/20" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                      <p className="text-[10px] uppercase tracking-wider text-white/70 mb-1">
                        {format(new Date(ev.starts_at), "EEE, MMM d · h:mm a")}
                      </p>
                      <p className="text-sm font-display font-semibold text-white line-clamp-2 leading-tight">
                        {ev.title}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            Nothing on the calendar yet.
          </div>
        )}
      </section>

      {/* Browse by category */}
      <section>
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
            Find your scene
          </p>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Browse by category
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CATEGORIES.map((c, i) => (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                to={`/spaces?tab=events&cat=${c.key}`}
                className={`group flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-br ${c.color} p-4 hover:-translate-y-0.5 hover:border-foreground/30 transition-all`}
              >
                <div className="h-10 w-10 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center shrink-0">
                  <c.icon className="h-5 w-5 text-foreground" />
                </div>
                <span className="font-display font-semibold text-sm text-foreground">
                  {c.label}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured spaces */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
              Vetted studios
            </p>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Top-rated spaces
            </h2>
          </div>
          <Link
            to="/spaces?tab=spaces"
            className="text-xs font-medium text-foreground/80 hover:text-foreground inline-flex items-center gap-1"
          >
            All spaces <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {featuredSpaces && featuredSpaces.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {featuredSpaces.map((s: any, i: number) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/studios/${s.id}`}
                  className="group block rounded-2xl bg-card border border-border overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all"
                >
                  <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                    {s.cover_image_url ? (
                      <img
                        src={s.cover_image_url}
                        alt={s.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/10">
                        <Building2 className="h-10 w-10 text-foreground/20" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1 text-[11px] font-medium text-foreground capitalize">
                      {s.category}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-display font-semibold text-foreground text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {s.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                      {s.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {s.city}
                        </span>
                      )}
                      {s.max_guests && (
                        <span className="flex items-center gap-1">
                          <UsersIcon className="h-3 w-3" /> {s.max_guests}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            No studios listed yet.
          </div>
        )}
      </section>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────── */
const SpacesHubPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: Tab = isTab(raw) ? raw : "events";

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <Header active={active} user={user} />

      <Tabs value={active} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="rounded-full bg-card border border-border p-1 h-auto">
          <TabsTrigger
            value="events"
            className="rounded-full gap-1.5 px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Events
          </TabsTrigger>
          <TabsTrigger
            value="spaces"
            className="rounded-full gap-1.5 px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <Building2 className="h-3.5 w-3.5" /> Spaces
          </TabsTrigger>
          <TabsTrigger
            value="discover"
            className="rounded-full gap-1.5 px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background"
          >
            <Compass className="h-3.5 w-3.5" /> Discover
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-8">
          <EventTimeline user={user} />
        </TabsContent>

        <TabsContent value="spaces" className="mt-8">
          <StudiosPage />
        </TabsContent>

        <TabsContent value="discover" className="mt-8">
          <DiscoverPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SpacesHubPage;
