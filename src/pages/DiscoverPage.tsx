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
import { Suspense, lazy, useState, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import CreatorPassUpgradeCta from "@/components/creators/CreatorPassUpgradeCta";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

const normalizeCategory = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");

type DiscoverView = "all" | "events" | "spaces" | "works";
const VIEW_OPTIONS: { value: DiscoverView; label: string; icon: any; kind: MosaicKindFilter }[] = [
  { value: "all", label: "All", icon: Sparkles, kind: "all" },
  { value: "events", label: "Events", icon: CalendarDays, kind: "event" },
  { value: "spaces", label: "Spaces", icon: MapPin, kind: "space" },
  { value: "works", label: "Works", icon: FileText, kind: "drop" },
];

const EVENT_CATEGORY_DEFS = [
  { slug: "music", label: "Music", icon: Music2, accent: "hsl(var(--orange))" },
  { slug: "art", label: "Art", icon: Palette, accent: "hsl(var(--pink))" },
  { slug: "talk", label: "Talk", icon: MessageSquare, accent: "hsl(var(--blue))" },
  { slug: "workshop", label: "Workshop", icon: Briefcase, accent: "hsl(var(--warm))" },
  { slug: "screening", label: "Screening", icon: Clapperboard, accent: "hsl(var(--foreground))" },
  { slug: "exhibition", label: "Exhibition", icon: Sparkles, accent: "hsl(var(--teal))" },
  { slug: "meetup", label: "Meetup", icon: Users, accent: "hsl(var(--accent))" },
  { slug: "other", label: "Other", icon: Compass, accent: "hsl(var(--muted-foreground))" },
] as const;

const SPACE_CATEGORY_DEFS = [
  { slug: "studio", label: "Studio", icon: Building2, accent: "hsl(var(--blue))" },
  { slug: "gallery", label: "Gallery", icon: Palette, accent: "hsl(var(--pink))" },
  { slug: "venue", label: "Venue", icon: CalendarDays, accent: "hsl(var(--orange))" },
  { slug: "rehearsal", label: "Rehearsal", icon: Music2, accent: "hsl(var(--warm))" },
  { slug: "co-working", label: "Co-working", icon: Briefcase, accent: "hsl(var(--teal))" },
  { slug: "outdoor", label: "Outdoor", icon: MapPin, accent: "hsl(var(--foreground))" },
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

  // View toggle (all / events / spaces / works), persisted in ?view= param.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get("view");
  const view: DiscoverView =
    rawView === "events" || rawView === "spaces" || rawView === "works"
      ? rawView
      : "all";
  const setView = (v: DiscoverView) => {
    if (v === "all") searchParams.delete("view");
    else searchParams.set("view", v);
    searchParams.delete("cat");
    setSearchParams(searchParams, { replace: true });
  };
  const activeOption = VIEW_OPTIONS.find((o) => o.value === view) ?? VIEW_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  const category = searchParams.get("cat");
  const setCategory = (c: string | null) => {
    if (!c) searchParams.delete("cat");
    else searchParams.set("cat", c);
    setSearchParams(searchParams, { replace: true });
  };
  const categoryList =
    view === "events" ? EVENT_CATEGORIES : view === "spaces" ? SPACE_CATEGORIES : null;

  useEffect(() => {
    if (view !== "all") {
      requestAnimationFrame(() => {
        document.getElementById("discover-stream")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [view]);

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
              Real artists.{" "}
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
              Spin the globe to meet verified artists, step inside their spaces,
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

      {/* ─── The Stream ─────────────────────────────────────────────── */}
      <section id="discover-stream" className="space-y-4 scroll-mt-20">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
              The Stream
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              Everything, all at once.
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter dropdown — All / Events / Spaces / Works */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
                >
                  <ActiveIcon className="h-3.5 w-3.5" />
                  {activeOption.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={value}
                    onSelect={() => setView(value)}
                    className="gap-2 text-xs"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="flex-1">{label}</span>
                    {view === value && <Check className="h-3.5 w-3.5 opacity-70" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Open Flow — replaces the old Tune-in heading; opens full Flow Mode */}
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

        {categoryList && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
              Browse by category
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  !category
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:bg-muted/60",
                )}
              >
                All
              </button>
              {categoryList.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? null : c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    category === c
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:bg-muted/60",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <ConversationsMosaic kind={activeOption.kind} category={category} />
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
