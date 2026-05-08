/**
 * ConversationsMosaic — the unified Hub feed.
 *
 * Replaces the lane tabs (Conversations / Offerings / Opportunities / Works)
 * with a single bento-style mosaic that interleaves every kind of activity
 * happening across Rhozeland: drops, offerings, opportunities, events,
 * spaces, and verified works.
 *
 * "Conversations" is the framing — the mosaic IS the conversation.
 *
 * Design notes:
 *  - Varied tile sizes (1x1, 2x1, 1x2, 2x2) shuffled into a CSS grid for
 *    an editorial, magazine-like density without feeling chaotic.
 *  - Each tile is type-aware: events use cover + date, offerings use price,
 *    opportunities lead with the brief, works show the verified badge.
 *  - Staggered framer-motion entrance + subtle hover lift for tactility.
 */
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Briefcase,
  CalendarDays,
  Building2,
  Flame,
  MapPin,
  Globe2,
  ArrowRight,
  Sparkles,
  Music,
  Palette,
  Camera,
  Video,
  PenTool,
  Theater,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

// ─── Tile shape ────────────────────────────────────────────────────────
// Note: "work" + "opportunity" no longer exist as standalone tile kinds.
//   - Verified Works are surfaced as a `verifiedSignature` badge on a Drop.
//   - Open Calls (project_request listings) are folded into "offering" with
//     an "Open Call" sub-label, since they live in the same marketplace.
type TileKind = "drop" | "offering" | "event" | "space";

interface MosaicTile {
  id: string;
  kind: TileKind;
  /** Sub-classification within a kind (e.g. "Open Call" for offerings). */
  variant?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  href: string;
  cover?: string | null;
  fileUrl?: string | null;
  linkUrl?: string | null;
  meta?: string | null;
  badge?: string | null;
  /** When set on a drop, surfaces the green Verified IP shield. */
  verifiedSignature?: string | null;
  createdAt: string;
}

// Deterministic-ish size assignment so the layout is varied but stable
// per session (no jarring re-shuffle on re-render).
const SIZE_PATTERN = [
  "col-span-2 row-span-2", // hero
  "col-span-1 row-span-1",
  "col-span-1 row-span-1",
  "col-span-2 row-span-1", // wide
  "col-span-1 row-span-2", // tall
  "col-span-1 row-span-1",
  "col-span-1 row-span-1",
  "col-span-2 row-span-1",
  "col-span-1 row-span-1",
  "col-span-1 row-span-1",
  "col-span-2 row-span-2",
  "col-span-1 row-span-1",
];

const KIND_META: Record<
  TileKind,
  { label: string; Icon: typeof Briefcase; tint: string; chipBg: string }
> = {
  drop: {
    label: "Drop",
    Icon: Flame,
    tint: "from-amber-500/15 via-pink-500/10 to-transparent",
    chipBg: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  offering: {
    label: "Offering",
    Icon: Briefcase,
    tint: "from-sky-500/15 via-cyan-500/10 to-transparent",
    chipBg: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  },
  event: {
    label: "Event",
    Icon: CalendarDays,
    tint: "from-pink-500/15 via-rose-500/10 to-transparent",
    chipBg: "bg-pink-500/15 text-pink-600 dark:text-pink-300",
  },
  space: {
    label: "Space",
    Icon: Building2,
    tint: "from-emerald-500/15 via-teal-500/10 to-transparent",
    chipBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
};

// Visual identity per offering category — drives the big icon + accent
// color used on text-only offering/opportunity tiles. Kept in sync with
// MarketplacePage's CATEGORIES.
const CATEGORY_VISUAL: Record<string, { Icon: typeof Briefcase; accent: string; label: string }> = {
  audio:   { Icon: Music,   accent: "hsl(280 60% 55%)", label: "Audio" },
  music:   { Icon: Music,   accent: "hsl(280 60% 55%)", label: "Music" },
  design:  { Icon: Palette, accent: "hsl(160 60% 50%)", label: "Design" },
  photo:   { Icon: Camera,  accent: "hsl(35 90% 55%)",  label: "Photo" },
  video:   { Icon: Video,   accent: "hsl(340 70% 55%)", label: "Video" },
  writing: { Icon: PenTool, accent: "hsl(210 60% 55%)", label: "Writing" },
  talent:  { Icon: Theater, accent: "hsl(50 80% 50%)",  label: "Talent" },
};

const getCategoryVisual = (cat?: string | null) =>
  CATEGORY_VISUAL[(cat ?? "").toLowerCase()] ?? {
    Icon: Briefcase,
    accent: "hsl(var(--foreground))",
    label: cat ?? "Offering",
  };

const normalizeCategory = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");


// Deterministic shuffle (Mulberry32 seeded by length) so order feels mixed
// but doesn't dance on every render.
const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Public type kept for any external consumers (no longer used for filtering).
export type MosaicKindFilter = "all" | TileKind;

const ConversationsMosaic = ({
  search = "",
  kind = "all",
  category = null,
}: {
  search?: string;
  kind?: MosaicKindFilter;
  /** Optional sub-filter (only meaningful when kind is "event" or "space"). */
  category?: string | null;
} = {}) => {
  const navigate = useNavigate();

  // Mosaic now focuses on content + IP + seasonal events:
  // Drops (with Verified IP badge), Events, Spaces. Offerings live on
  // the Conversations page (Listings tab) — not here.
  const { data, isLoading } = useQuery({
    queryKey: ["hub-mosaic", search],
    queryFn: async () => {
      const term = search.trim();
      const ilike = term ? term.toLowerCase() : null;

      const drops = supabase
        .from("flow_items")
        .select("id, title, description, category, file_url, link_url, created_at, user_id, solana_signature")
        .order("created_at", { ascending: false })
        .limit(16);

      const events = supabase
        .from("events")
        .select("id, title, cover_url, starts_at, category, venue_name, is_online")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(8);

      const spaces = supabase
        .from("studios")
        .select("id, name, cover_image_url, city, country, description, category")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);

      const [dr, ev, sp] = await Promise.all([drops, events, spaces]);

      const tiles: MosaicTile[] = [];

      (dr.data ?? []).forEach((d: any) => {
        if (ilike && !`${d.title} ${d.description} ${d.category}`.toLowerCase().includes(ilike)) return;
        tiles.push({
          id: `drop-${d.id}`,
          kind: "drop",
          title: d.title ?? "Drop",
          description: d.description,
          category: d.category,
          fileUrl: d.file_url,
          linkUrl: d.link_url,
          href: `/flow?item=${d.id}`,
          meta: d.category,
          verifiedSignature: d.solana_signature ?? null,
          createdAt: d.created_at,
        });
      });

      (ev.data ?? []).forEach((e: any) => {
        if (ilike && !`${e.title} ${e.venue_name ?? ""}`.toLowerCase().includes(ilike)) return;
        tiles.push({
          id: `ev-${e.id}`,
          kind: "event",
          title: e.title,
          cover: e.cover_url,
          category: e.category,
          href: `/spaces/events/${e.id}`,
          meta: format(new Date(e.starts_at), "EEE, MMM d · h:mm a"),
          subtitle: e.is_online ? "Online" : e.venue_name,
          createdAt: e.starts_at,
        });
      });

      (sp.data ?? []).forEach((s: any) => {
        if (ilike && !`${s.name} ${s.description ?? ""}`.toLowerCase().includes(ilike)) return;
        tiles.push({
          id: `sp-${s.id}`,
          kind: "space",
          title: s.name,
          description: s.description,
          category: s.category,
          cover: s.cover_image_url,
          href: `/studios/${s.id}`,
          subtitle: [s.city, s.country].filter(Boolean).join(", ") || null,
          createdAt: s.cover_image_url ?? new Date().toISOString(),
        });
      });

      return seededShuffle(tiles, tiles.length);
    },
    staleTime: 30_000,
  });

  const allTiles = data ?? [];
  const tiles = useMemo(() => {
    let filtered = kind === "all" ? allTiles : allTiles.filter((t) => t.kind === kind);
    if (category && kind !== "all") {
      const cat = normalizeCategory(category);
      filtered = filtered.filter((t) => normalizeCategory(t.category) === cat);
    }
    return filtered.slice(0, 24);
  }, [allTiles, kind, category]);

  // When filtered to a single kind, drop the bento "hero/wide/tall" pattern
  // (which creates large empty cells when there are only a handful of items)
  // and render a tight uniform grid instead.
  const isFiltered = kind !== "all";

  if (isLoading) {
    return (
      <div className={isFiltered
        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        : "grid grid-cols-2 md:grid-cols-4 auto-rows-[150px] gap-3 grid-flow-dense"}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-2xl bg-muted animate-pulse",
              isFiltered ? "aspect-square" : SIZE_PATTERN[i % SIZE_PATTERN.length],
            )}
          />
        ))}
      </div>
    );
  }

  if (tiles.length === 0) {
    const hasSearch = search.trim().length > 0;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-5 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-display text-sm font-semibold text-foreground">
              {hasSearch ? "Nothing matches that search" : kind !== "all" ? "Nothing here yet" : "The Stream is quiet"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasSearch ? "While you're here, check who's trending." : "While the stream fills up, here's who's trending."}
            </p>
          </div>
        </div>
        {/* Lazy import to avoid circular hub deps */}
        <FallbackTrendingArtists />
      </div>
    );
  }

  if (isFiltered) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map((tile, i) => (
          <MosaicTileCard
            key={tile.id}
            tile={tile}
            sizeClass="aspect-square"
            index={i}
            onClick={() => navigate(tile.href)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[150px] gap-3 grid-flow-dense">
      {tiles.map((tile, i) => {
        const size = SIZE_PATTERN[i % SIZE_PATTERN.length];
        return (
          <MosaicTileCard key={tile.id} tile={tile} sizeClass={size} index={i} onClick={() => navigate(tile.href)} />
        );
      })}
    </div>
  );
};

// ─── Tile renderer ─────────────────────────────────────────────────────
//
// Interactions:
//   • Click  → navigate to the kind-specific detail page (tile.href).
//   • Hover  → after 250ms, surface a glassy preview popover with the
//     cover, description, meta, and an explicit "Open" CTA. On touch
//     devices HoverCard simply doesn't fire (no hover) — click still
//     navigates, so behavior degrades gracefully.
//
const MosaicTileCard = ({
  tile,
  sizeClass,
  index,
  onClick,
}: {
  tile: MosaicTile;
  sizeClass: string;
  index: number;
  onClick: () => void;
}) => {
  const { Icon, label, tint, chipBg } = KIND_META[tile.kind];
  const hasImage = !!(tile.cover || tile.fileUrl || tile.linkUrl);
  const isLarge = sizeClass.includes("row-span-2") || sizeClass.includes("col-span-2");
  // Offerings without a cover image lean on a bold category icon + theme
  // color so they stop reading as "empty white space". The big icon does
  // the visual lifting; copy fills in the rest.
  const isIconHero = !hasImage && tile.kind === "offering";
  const catVisual = getCategoryVisual(tile.category);
  // The category accent overrides the kind tint for offerings — gives
  // each craft (Music / Design / Photo / etc.) a distinct color identity
  // even when no media is attached.
  const accentStyle = isIconHero
    ? {
        background: `radial-gradient(circle at 30% 20%, ${catVisual.accent}22, transparent 60%), radial-gradient(circle at 80% 90%, ${catVisual.accent}1a, transparent 55%)`,
      }
    : undefined;

  const tileButton = (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index * 0.025, 0.35), type: "spring", stiffness: 220, damping: 24 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className={`${sizeClass} group relative w-full h-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-all duration-300 hover:border-foreground/40 hover:shadow-lg cursor-pointer`}
      aria-label={`${label}: ${tile.title}. Click to open.`}
    >
      {/* Background — image, gradient tint, or category-tinted icon hero */}
      {tile.cover ? (
        <img
          src={tile.cover}
          alt={tile.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : tile.kind === "drop" && (tile.fileUrl || tile.linkUrl) ? (
        <FlowThumbnail
          fileUrl={tile.fileUrl}
          linkUrl={tile.linkUrl}
          title={tile.title}
          description={tile.description}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : isIconHero ? (
        // Category-driven hero: subtle dual-radial wash + huge soft icon
        // floating off-axis. Reads as designed, not empty.
        <>
          <div
            className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
            style={accentStyle}
          />
          <catVisual.Icon
            className="absolute -right-4 -bottom-6 transition-all duration-500 group-hover:-rotate-6 group-hover:scale-110"
            style={{
              color: catVisual.accent,
              opacity: 0.22,
              width: isLarge ? "11rem" : "7.5rem",
              height: isLarge ? "11rem" : "7.5rem",
            }}
            strokeWidth={1.25}
          />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${tint} transition-transform duration-700 group-hover:scale-110`} />
      )}

      {/* Gradient overlay for legibility on imagery */}
      {hasImage && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      )}

      {/* Hover scrim */}
      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300 pointer-events-none" />

      {/* Top chip row */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2 z-10">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-md ${chipBg}`}>
            <Icon className="h-2.5 w-2.5" />
            {tile.variant ?? label}
          </span>
          {/* Verified IP shield on drops — replaces the standalone "Works" lane */}
          {tile.kind === "drop" && tile.verifiedSignature && (
            <VerifiedIPBadge signature={tile.verifiedSignature} size="xs" />
          )}
        </div>
        {tile.badge && (
          <span className="inline-flex items-center rounded-full bg-background/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-foreground shadow-sm">
            {tile.badge}
          </span>
        )}
      </div>

      {/* Content footer */}
      <div className={`absolute inset-x-0 bottom-0 p-3 ${hasImage ? "text-white" : "text-foreground"} z-10`}>
        {/* Category eyebrow — colored for offerings so the craft is obvious at a glance */}
        {tile.meta && (
          <p
            className={`text-[10px] uppercase tracking-wider mb-1 font-semibold ${
              hasImage ? "text-white/80" : isIconHero ? "" : "text-muted-foreground"
            }`}
            style={isIconHero ? { color: catVisual.accent } : undefined}
          >
            {tile.meta}
          </p>
        )}
        <p
          className={`font-display font-semibold leading-tight ${isLarge ? "text-base sm:text-lg" : "text-sm"} ${hasImage ? "text-white" : "text-foreground"} line-clamp-2`}
        >
          {tile.title}
        </p>
        {tile.subtitle && (
          <p className={`text-[11px] mt-0.5 truncate ${hasImage ? "text-white/75" : "text-muted-foreground"} flex items-center gap-1`}>
            {tile.kind === "event" && tile.subtitle === "Online" ? <Globe2 className="h-3 w-3 shrink-0" /> : null}
            {tile.kind === "event" && tile.subtitle !== "Online" ? <MapPin className="h-3 w-3 shrink-0" /> : null}
            {tile.kind === "space" ? <MapPin className="h-3 w-3 shrink-0" /> : null}
            {tile.subtitle}
          </p>
        )}
        {/* Short description — now also shown on icon-hero offering tiles
            (not just large ones) so they're never just an icon + title. */}
        {!tile.subtitle && tile.description && (isLarge || isIconHero) && !hasImage && (
          <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${isIconHero ? "text-foreground/70" : "text-muted-foreground"}`}>
            {tile.description}
          </p>
        )}
        {(isLarge || isIconHero) && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2 opacity-80 group-hover:opacity-100 group-hover:gap-1.5 transition-all ${hasImage ? "text-white" : "text-foreground"}`}
          >
            Open <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </motion.button>
  );

  return tileButton;
};


export default ConversationsMosaic;
