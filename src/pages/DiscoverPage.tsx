/**
 * Discover — v7.5 front door.
 * ─────────────────────────────────────────────────────────────────────────
 * Globe-led hero (3D earth + auto-shuffling Featured carousel) →
 * infinite Fresh works → upcoming events → coins.
 *
 * Removed (per product direction):
 *   • "Trending this week" creator row
 *   • Region pill strip (replaced by globe)
 *   • Standalone Featured artist (folded into carousel)
 */
import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FeaturedCarousel from "@/components/discover/FeaturedCarousel";
import FreshWorksGrid from "@/components/discover/FreshWorksGrid";
import { MARKETS, type RegionMarket } from "@/lib/regions";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Compass, Calendar as CalendarIcon, Coins, Globe2, Loader2,
} from "lucide-react";
import { format } from "date-fns";

// Globe hero lazily imported to keep Discover lightweight on first load.
const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

const DiscoverPage = () => {
  const { user } = useAuth();
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");

  // ─── Upcoming events (small carousel) ────────────────────────────
  const { data: events } = useQuery({
    queryKey: ["discover-upcoming-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, slug, title, cover_url, starts_at, venue_name, is_online, category")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(6);
      return data ?? [];
    },
  });

  // ─── Coins moving today ──────────────────────────────────────────
  const { data: coins } = useQuery({
    queryKey: ["discover-coins"],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, image_url, status, virtual_sol_reserves, real_sol_reserves, creator_id, updated_at")
        .in("status", ["active", "graduated"])
        .order("updated_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-12">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-2"
      >
        <p className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
          <Compass className="h-3 w-3" /> Discover
        </p>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-[1.1] text-foreground">
          The world is{" "}
          <span
            className="inline-block"
            style={{
              backgroundImage:
                "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
              WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
            }}
          >
            making.
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl">
          Spin the globe, find an artist, an event, or a space.
          {user ? " Pick a thread." : " Have a look around."}
        </p>
      </motion.header>

      {/* ─── Globe + Featured carousel ─────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <div className="relative rounded-3xl overflow-hidden border border-border/60 bg-gradient-to-br from-background via-background to-card h-[360px]">
          <Suspense
            fallback={
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <DiscoverGlobe
              marketFilter={marketFilter}
              onSelectMarket={setMarketFilter}
              height={360}
            />
          </Suspense>

          {/* Region pills overlay (also acts as fallback for non-WebGL users) */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5 z-10 pointer-events-none">
            {MARKETS.map((m) => {
              const active = marketFilter === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMarketFilter(m.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur transition-colors pointer-events-auto",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/40 bg-background/60 hover:bg-background/80 text-foreground",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <div className="absolute top-3 left-4 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Globe2 className="h-3 w-3" /> Browse the world
          </div>
        </div>

        <FeaturedCarousel marketFilter={marketFilter} />
      </motion.section>

      {/* ─── Fresh works (infinite) ─────────────────────────────────── */}
      <FreshWorksGrid />

      {/* ─── Upcoming events ────────────────────────────────────────── */}
      {events && events.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" /> Showing up soon
            </h2>
            <Link to="/spaces?tab=events" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.map((e: any) => (
              <Link
                key={e.id}
                to={`/events/${e.slug || e.id}`}
                className="group rounded-xl border border-border/60 bg-card overflow-hidden hover:border-foreground/30 transition-colors"
              >
                {e.cover_url ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img src={e.cover_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <CalendarIcon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{e.title}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{format(new Date(e.starts_at), "MMM d · h:mm a")}</span>
                    {e.is_online ? (
                      <Badge variant="outline" className="text-[9px]">Online</Badge>
                    ) : e.venue_name ? (
                      <span className="truncate">· {e.venue_name}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Coins moving today ─────────────────────────────────────── */}
      {coins && coins.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Coins moving today
            </h2>
            <Link to="/launchpad" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {coins.map((c: any) => (
              <Link
                key={c.id}
                to={`/launchpad/${c.id}`}
                className="group rounded-xl border border-border/60 bg-card p-3 hover:border-foreground/30 transition-colors text-center"
              >
                <div className="aspect-square rounded-lg bg-muted overflow-hidden mb-2">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Coins className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-foreground truncate">${c.ticker}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.name}</p>
                {c.status === "graduated" && (
                  <Badge variant="secondary" className="text-[9px] mt-1">Graduated</Badge>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!user && (
        <section className="text-center pt-4 space-y-2">
          <Link to="/auth">
            <Button size="lg" className="rounded-full gap-1.5">
              Join the network <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-[11px] text-muted-foreground">
            Free to start. Built for independent artists.{" "}
            <Link to="/rewards" className="underline-offset-2 hover:underline text-foreground/70">
              How rewards work →
            </Link>
          </p>
        </section>
      )}
    </div>
  );
};

export default DiscoverPage;
