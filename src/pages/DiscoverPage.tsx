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
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RegionPromptBanner from "@/components/discover/RegionPromptBanner";


import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import ConversationsMosaic from "@/components/hub/ConversationsMosaic";
import CompactFlowFeed from "@/components/hub/CompactFlowFeed";
import PostMenuButton from "@/components/PostMenuButton";
import DiscoverTable from "@/components/discover/DiscoverTable";
import SubscribedFeed from "@/components/discover/SubscribedFeed";
import ListingsBoard from "@/components/discover/ListingsBoard";
import ConnectBoard from "@/components/connect/ConnectBoard";
import ChartsPage from "@/pages/ChartsPage";

import TrendingArtistsLane from "@/components/discover/TrendingArtistsLane";
// v11 Pillar 8: PublicReleasesLane removed — it was auto-attaching profile
// tokens to releases the owner never linked, plus it duplicated profile
// surfaces. Public release pages still exist at /release/:slug.

import DiscoverEventsGrid from "@/components/discover/DiscoverEventsGrid";
import EventCategoryPills from "@/components/discover/EventCategoryPills";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RegionMarket } from "@/lib/regions";
import { todayGradient } from "@/lib/rhoze-gradients";
import {
  ArrowRight,
  Coins,
  Loader2,
  Sparkles,
  CalendarDays,
  MapPin,
  FileText,
  ChevronDown,
  Check,
  Music2,
  Palette,
  MessageSquare,
  Briefcase,
  Clapperboard,
  Building2,
  ShoppingBag,
  X,
  Cpu,
  UtensilsCrossed,
  Brain,
  Leaf,
  Activity,
  Sparkle,
  Bitcoin,
  Camera,
  Mic2,
  Image as ImageIcon,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";


const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

const normalizeCategory = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");

const EVENT_CATEGORY_DEFS = [
  { slug: "music", label: "Music", icon: Music2, accent: "hsl(var(--orange))" },
  { slug: "art", label: "Arts & Culture", icon: Palette, accent: "hsl(var(--pink))" },
  { slug: "tech", label: "Tech", icon: Cpu, accent: "hsl(var(--amber))" },
  { slug: "ai", label: "AI", icon: Brain, accent: "hsl(var(--rose))" },
  { slug: "food", label: "Food & Drink", icon: UtensilsCrossed, accent: "hsl(var(--orange))" },
  { slug: "wellness", label: "Wellness", icon: Sparkle, accent: "hsl(var(--mint))" },
  { slug: "fitness", label: "Fitness", icon: Activity, accent: "hsl(var(--rose))" },
  { slug: "climate", label: "Climate", icon: Leaf, accent: "hsl(var(--mint))" },
  { slug: "crypto", label: "Crypto", icon: Bitcoin, accent: "hsl(var(--violet))" },
] as const;

const SPACE_CATEGORY_DEFS = [
  { slug: "studio", label: "Studio", icon: Building2, accent: "hsl(var(--blue))" },
  { slug: "music", label: "Music Studio", icon: Mic2, accent: "hsl(var(--orange))" },
  { slug: "photo", label: "Photo", icon: Camera, accent: "hsl(var(--pink))" },
  { slug: "gallery", label: "Gallery", icon: ImageIcon, accent: "hsl(var(--rose))" },
  { slug: "coworking", label: "Coworking", icon: Users, accent: "hsl(var(--mint))" },
  { slug: "venue", label: "Venue", icon: Building2, accent: "hsl(var(--violet))" },
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
  <section className="rounded-2xl border border-border/70 bg-card/65 px-4 py-3 sm:px-5 sm:py-4 space-y-3">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-baseline gap-2 min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
          Explore {noun === "event" ? "events" : "spaces"} by mood
        </h3>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Browse by category
        </p>
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

    <div className="flex flex-wrap gap-1.5">
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
              "group inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-all duration-200 hover:border-foreground/20 hover:bg-background hover:text-foreground",
              active && "border-foreground/40 bg-background text-foreground shadow-sm",
            )}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: def.accent }} />
            <span>{def.label}</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
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
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);
  const creatorFeaturedSlides = useMemo(
    () => featuredSlides.filter((slide) => slide.kind === "artist"),
    [featuredSlides],
  );

  const [searchParams, setSearchParams] = useSearchParams();

  // v11 Pillar 9: stream tabs / archetype / category filters removed from
  // Discover — those interactions live on /market (Connect) now. Discover
  // keeps the editorial feed only.

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


  const todayGrad = todayGradient();

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
                backgroundImage: todayGrad.text,
                WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
              }}
            >
              {firstName}.
            </span>
          </h1>
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
              Get Discovered.{" "}
              <span
                className="inline-block"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
                  WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
                }}
              >
                Get Supported. On-Chain.
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
            featuredSlides={creatorFeaturedSlides}
            height={400}
          />
        </Suspense>
      </motion.section>


      {/* ─── Guest unlock strip — what joining gets you ─── */}
      {!user && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur-sm p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-1">
                Members only
              </p>
              <h2 className="font-display text-xl sm:text-2xl text-foreground tracking-tight">
                What you'll unlock
              </h2>
            </div>
            <Link to="/auth" className="shrink-0">
              <Button size="sm" className="rounded-full gap-1.5 text-xs">
                Join free <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: Sparkles,
                title: "Back creators",
                blurb: "Subscribe from $5/mo to unlock private works, behind-the-scenes drops, and gated posts.",
              },
              {
                icon: MessageSquare,
                title: "Direct messages",
                blurb: "DM verified artists, hire them on commission, or start a project together.",
              },
              {
                icon: CalendarDays,
                title: "Events & spaces",
                blurb: "Book studios, RSVP to live drops, and join open calls across the network.",
              },
            ].map(({ icon: Icon, title, blurb }) => (
              <div
                key={title}
                className="rounded-2xl border border-border/50 bg-background/60 p-4 hover:border-foreground/20 hover:bg-background transition-colors"
              >
                <Icon className="h-4 w-4 text-foreground/70 mb-2.5" />
                <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{blurb}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Public Releases lane removed — see import comment above. */}

      {/* ─── Trending artists (self-gated by liquidity) ───────────── */}

      {/* v11: Coins in motion lane removed per product call — pump.fun discovery
          now lives only on individual profiles via TokenDiscoveryChip. */}

      <TrendingArtistsLane marketFilter={marketFilter} />

      {/* Listings now live as a dedicated tab inside the Feed below. */}




      {/* ─── Stream ───────────────────────────────────────────────── */}
      {/* v11 Pillar 9: Discover no longer hosts Creators/Listings/Events/
          Spaces tabs — those live on /market (Connect). Discover stays
          editorial: subscribed feed → fresh works → mosaic. */}
      <section id="discover-stream" className="space-y-5 scroll-mt-20">
        {user && (
          <div className="sticky top-14 z-20 -mx-4 px-4 py-3 bg-background/85 backdrop-blur-md border-b border-border/60 flex items-center justify-end">
            <PostMenuButton
              trigger={
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 sm:px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Post</span>
                </button>
              }
            />
          </div>
        )}

        <div className="space-y-8">
          <SubscribedFeed />
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-xs font-semibold tracking-[0.18em] uppercase text-foreground/70 shrink-0">
                Fresh on Rhozeland
              </h3>
              <div className="h-px flex-1 bg-border" />
            </div>
            <CompactFlowFeed />
            {/* Feed mosaic = content only (works/drops). Spaces & events live on their own pages. */}
            <ConversationsMosaic kind="drop" />
          </div>
        </div>
      </section>


      {/* v10.2 — "Coins moving today" lane removed; Trending Tokens lane lands next loop. */}

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
