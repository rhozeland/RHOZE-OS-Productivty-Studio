/**
 * Discover — v8 unified front door.
 *
 * Hub + Stream are gone. Everything happening across Rhozeland scrolls
 * here as one feed. Layout, top-to-bottom:
 *
 *   1. Personal greeting (signed-in only) — "Good {time}, {Name}."
 *   2. Globe + Featured carousel (3D earth + auto-shuffling artists/events/spaces)
 *   3. Quick-drop StreamComposer
 *   4. Conversations mosaic — drops, offerings, events, spaces (mixed)
 *      with filter chips + search + a single Flow Mode toggle button.
 *   5. Coins moving today
 *
 * Replaces the old Hub (/stream) entirely. The Conversations mosaic is
 * lifted from HubPage and Fresh Works is removed (the mosaic IS the
 * fresh feed now — drops, works, offerings, events, spaces all in one).
 */
import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RegionPromptBanner from "@/components/discover/RegionPromptBanner";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import StreamComposer from "@/components/stream/StreamComposer";
import ConversationsMosaic from "@/components/hub/ConversationsMosaic";
import type { RegionMarket } from "@/lib/regions";
import { ArrowRight, Coins, Loader2 } from "lucide-react";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const DiscoverPage = () => {
  const { user } = useAuth();
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);

  // ─── Personal greeting (signed-in only) ─────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["discover-greeting", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const firstName = (() => {
    const dn = profile?.display_name?.trim();
    if (dn) return dn.split(" ")[0];
    if (profile?.username) return profile.username;
    const meta = (user?.user_metadata as any)?.full_name;
    if (meta) return String(meta).split(" ")[0];
    return user?.email?.split("@")[0] || "Creator";
  })();

  // ─── Coins moving today ─────────────────────────────────────────
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
    <div className="max-w-6xl mx-auto pb-20 space-y-6">
      {/* ─── Personal greeting (signed in) ───────────────────────────── */}
      {user && (
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="pt-1"
        >
          <h1 className="font-display text-3xl sm:text-4xl leading-[1.1] text-foreground tracking-tight">
            {getGreeting()},{" "}
            <span
              className="inline-block"
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
                WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
              }}
            >
              {firstName}.
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything happening on Rhozeland — in one breath.
          </p>
        </motion.header>
      )}

      <RegionPromptBanner />

      {/* ─── Globe-led featured orbit ──────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-1"
      >
        <Suspense
          fallback={
            <div className="flex h-[420px] w-full items-center justify-center rounded-[2rem] border border-border/60 bg-card/40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <DiscoverGlobe
            marketFilter={marketFilter}
            onSelectMarket={setMarketFilter}
            featuredSlides={featuredSlides}
            height={400}
          />
        </Suspense>
      </motion.section>

      {/* ─── Quick-drop composer ───────────────────────────────────── */}
      {user && <StreamComposer defaultType="text" />}

      {/* ─── Conversations mosaic — unified feed ───────────────────── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
              Conversations
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              Everything, in one breath.
            </h2>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link to="/flow" className="shrink-0">
              <Button variant="outline" size="sm" className="rounded-full gap-1.5 h-10">
                <Waves className="h-3.5 w-3.5" /> Flow
              </Button>
            </Link>
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeFilter.label.toLowerCase()}…`}
                className="pl-10 pr-9 h-10 rounded-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {FILTERS.map((f) => {
            const FIcon = f.Icon;
            const active = kind === f.key;
            const count = counts?.[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setKind(f.key)}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <FIcon className="h-3 w-3" />
                {f.label}
                {typeof count === "number" && count > 0 && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums ${
                      active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {hasFilter && (
            <button
              type="button"
              onClick={() => { setKind("all"); setSearch(""); }}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground ml-1 px-2 py-1 transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <ConversationsMosaic search={search} kind={kind} />
      </section>

      {/* ─── Coins moving today ─────────────────────────────────────── */}
      {coins && coins.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Coins moving today
            </h2>
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
