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
import { Suspense, lazy, useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RegionPromptBanner from "@/components/discover/RegionPromptBanner";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import StreamComposer from "@/components/stream/StreamComposer";
import ConversationsMosaic, { type MosaicKindFilter } from "@/components/hub/ConversationsMosaic";
import CreatorsGrid from "@/components/discover/CreatorsGrid";
import TrendingArtistsLane from "@/components/discover/TrendingArtistsLane";
import DiscoverEventsGrid from "@/components/discover/DiscoverEventsGrid";
import EventCategoryPills from "@/components/discover/EventCategoryPills";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RegionMarket } from "@/lib/regions";
import {
  ArrowRight,
  Coins,
  Loader2,
  Sparkles,
  CalendarDays,
  Flame,
  MapPin,
  FileText,
  ChevronDown,
  Check,
  Music2,
  Palette,
  MessageSquare,
  Briefcase,
  Clapperboard,
  Users,
  Compass,
  Building2,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CreatorPassUpgradeCta from "@/components/creators/CreatorPassUpgradeCta";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

const normalizeCategory = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");

const EVENT_CATEGORY_DEFS = [
  { slug: "music", label: "Music", icon: Music2, accent: "hsl(var(--orange))" },
  { slug: "art", label: "Art", icon: Palette, accent: "hsl(var(--pink))" },
] as const;

const SPACE_CATEGORY_DEFS = [
  { slug: "studio", label: "Studio", icon: Building2, accent: "hsl(var(--blue))" },
] as const;

type StreamCategoryDef = (typeof EVENT_CATEGORY_DEFS)[number] | (typeof SPACE_CATEGORY_DEFS)[number];

const StreamCategorySection = ({
  defs,
  noun,
  activeCategory,
  counts,
  onSelect,
}: {
  defs: readonly StreamCategoryDef[];
  noun: "event" | "space";
  activeCategory: string | null;
  counts: Record<string, number>;
  onSelect: (category: string | null) => void;
}) => (
  <section className="rounded-[1.75rem] border border-border/70 bg-card/65 p-5 sm:p-6 space-y-4">
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
          Browse by category
        </p>
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">
          Explore {noun === "event" ? "events" : "spaces"} by mood
        </h3>
      </div>
      {activeCategory && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Show all {noun}s
        </button>
      )}
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {defs.map((def) => {
        const Icon = def.icon;
        const active = activeCategory === def.slug;
        const count = counts[def.slug] ?? 0;

        return (
          <button
            key={def.slug}
            type="button"
            onClick={() => onSelect(active ? null : def.slug)}
            className={cn(
              "group flex items-center gap-4 rounded-[1.4rem] border bg-background/70 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-background",
              active && "border-foreground/40 bg-background shadow-sm",
            )}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-secondary/60"
              style={{ borderColor: active ? def.accent : "hsl(var(--border))" }}
            >
              <Icon className="h-5 w-5" style={{ color: def.accent }} />
            </div>

            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground truncate">{def.label}</p>
              <p className="text-sm text-muted-foreground">
                {count.toLocaleString()} {noun}{count === 1 ? "" : "s"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  </section>
);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const DiscoverPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);

  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("cat");
  const normalizedCategory = category ? normalizeCategory(category) : null;

  // ─── Stream view tabs (creators · events · spaces · all) ────────
  type StreamTab = "all" | "creators" | "events" | "spaces";
  const initialTab = (searchParams.get("tab") as StreamTab) || "all";
  const [streamTab, setStreamTab] = useState<StreamTab>(
    ["all", "creators", "events", "spaces"].includes(initialTab) ? initialTab : "all",
  );
  const handleStreamTab = (tab: StreamTab) => {
    setStreamTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === "all") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
    // Scroll the stream section into view so the change is felt.
    requestAnimationFrame(() => {
      document.getElementById("discover-stream")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  // ─── Archetype filter (Artist · Builder · Influencer) ───────────
  // Only meaningful on the Creators feed — preserved as ?archetype= in URL.
  const initialArchetype = (searchParams.get("archetype") as any) || "all";
  const [archetype, setArchetype] = useState<import("@/lib/archetypes").Archetype | "all">(
    ["artist", "builder", "influencer"].includes(initialArchetype) ? initialArchetype : "all",
  );
  const handleArchetype = (next: import("@/lib/archetypes").Archetype | "all") => {
    setArchetype(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("archetype");
    else params.set("archetype", next);
    setSearchParams(params, { replace: true });
  };
  const mosaicKind: MosaicKindFilter =
    streamTab === "events" ? "event" : streamTab === "spaces" ? "space" : "all";
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

  const eventCategoryRows: { category?: string | null }[] = [];
  const spaceCategoryRows: { category?: string | null }[] = [];
  const categoryCounts: Record<string, number> = {};

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

      {/* ─── Guest intro — soft gradient orb + minimal copy ─── */}
      {!user && (
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative pt-1 overflow-hidden"
        >
          {/* Soft pink→amber→mint orb à la dashboard */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 h-[420px] w-[420px] rounded-full opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, hsl(330 85% 70% / 0.55), transparent 55%)," +
                "radial-gradient(circle at 70% 60%, hsl(38 92% 65% / 0.55), transparent 60%)," +
                "radial-gradient(circle at 50% 90%, hsl(160 65% 60% / 0.40), transparent 60%)",
            }}
          />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
              Discover
            </p>
            <h1 className="font-display text-4xl sm:text-5xl leading-[1.02] text-foreground tracking-tight max-w-2xl">
              Real creators.{" "}
              <span
                className="inline-block"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
                  WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
                }}
              >
                Real spaces. Real moments.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-xl leading-relaxed">
              Spin the globe to meet verified creators, step inside their spaces,
              and catch what's happening tonight — anywhere in the world.
            </p>
          </div>
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

      {/* ─── Creator Pass upgrade nudge ─────────────────────────────── */}
      <CreatorPassUpgradeCta />

      {/* ─── Trending artists — only on All / Creators ────────────── */}
      {(streamTab === "all" || streamTab === "creators") && (
        <TrendingArtistsLane marketFilter={marketFilter} />
      )}

      {/* ─── The Stream ─────────────────────────────────────────────── */}
      <section id="discover-stream" className="space-y-4 scroll-mt-20">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
              The Stream
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              {streamTab === "creators"
                ? "Meet the creators."
                : streamTab === "events"
                ? "What's happening."
                : streamTab === "spaces"
                ? "Where it's going down."
                : "Everything, all at once."}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/flow")}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background hover:bg-foreground/90 transition-colors"
            >
              <Flame className="h-3.5 w-3.5" />
              Open Flow
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab segmented control — switch the whole feed */}
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border/60 bg-card/60 p-1">
          {([
            { id: "all", label: "All", icon: Compass },
            { id: "creators", label: "Creators", icon: Users },
            { id: "events", label: "Events", icon: CalendarDays },
            { id: "spaces", label: "Spaces", icon: Building2 },
          ] as { id: StreamTab; label: string; icon: typeof Compass }[]).map((t) => {
            const Icon = t.icon;
            const active = streamTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleStreamTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {streamTab === "creators" ? (
          <CreatorsGrid />
        ) : (
          <ConversationsMosaic kind={mosaicKind} category={normalizedCategory} />
        )}
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
            Free to start. Built for independent creators.{" "}
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
