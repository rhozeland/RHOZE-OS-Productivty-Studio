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
  Megaphone,
  CalendarDays,
  Building2,
  Shield,
  Flame,
  MapPin,
  Globe2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";

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

// Public type for the filter chips on HubPage. Keep in sync with TileKind.
export type MosaicKindFilter = "all" | TileKind;

const ConversationsMosaic = ({
  search = "",
  kind = "all",
}: {
  search?: string;
  kind?: MosaicKindFilter;
}) => {
  const navigate = useNavigate();

  // Fetch every kind in parallel — keep limits tight so the mosaic stays
  // browseable on a single screen. We always fetch all kinds (so the
  // filter chips can show live counts) and filter client-side.
  const { data, isLoading } = useQuery({
    queryKey: ["hub-mosaic", search],
    queryFn: async () => {
      const term = search.trim();
      const ilike = term ? `%${term}%` : null;

      const drops = supabase
        .from("flow_items")
        .select("id, title, description, category, file_url, link_url, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(12);

      const offerings = supabase
        .from("marketplace_listings")
        .select("id, title, description, category, price, credits_price, listing_type, created_at, user_id")
        .eq("is_active", true)
        .in("listing_type", ["service", "digital_product", "collaboration"])
        .order("created_at", { ascending: false })
        .limit(8);

      const opps = supabase
        .from("marketplace_listings")
        .select("id, title, description, category, price, credits_price, created_at, user_id")
        .eq("is_active", true)
        .eq("listing_type", "project_request")
        .order("created_at", { ascending: false })
        .limit(6);

      const events = supabase
        .from("events")
        .select("id, title, cover_url, starts_at, category, venue_name, is_online")
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(6);

      const spaces = supabase
        .from("studios")
        .select("id, name, cover_image_url, city, country, description")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);

      const works = supabase
        .from("contribution_proofs")
        .select("id, action_type, metadata, solana_signature, anchored_at, created_at, user_id")
        .not("solana_signature", "is", null)
        .order("anchored_at", { ascending: false, nullsFirst: false })
        .limit(6);

      const [dr, of, op, ev, sp, wk] = await Promise.all([drops, offerings, opps, events, spaces, works]);

      const tiles: MosaicTile[] = [];

      (dr.data ?? []).forEach((d: any) => {
        if (ilike && !`${d.title} ${d.description} ${d.category}`.toLowerCase().includes(term.toLowerCase())) return;
        tiles.push({
          id: `drop-${d.id}`,
          kind: "drop",
          title: d.title ?? "Drop",
          description: d.description,
          fileUrl: d.file_url,
          linkUrl: d.link_url,
          href: `/flow`,
          meta: d.category,
          createdAt: d.created_at,
        });
      });

      (of.data ?? []).forEach((l: any) => {
        if (ilike && !`${l.title} ${l.description} ${l.category}`.toLowerCase().includes(term.toLowerCase())) return;
        tiles.push({
          id: `off-${l.id}`,
          kind: "offering",
          title: l.title,
          description: l.description,
          href: `/marketplace/${l.id}`,
          meta: l.category,
          badge: l.credits_price
            ? `${l.credits_price} ◊`
            : l.price
              ? `$${Number(l.price).toFixed(0)}`
              : null,
          createdAt: l.created_at,
        });
      });

      (op.data ?? []).forEach((l: any) => {
        if (ilike && !`${l.title} ${l.description} ${l.category}`.toLowerCase().includes(term.toLowerCase())) return;
        tiles.push({
          id: `opp-${l.id}`,
          kind: "opportunity",
          title: l.title,
          description: l.description,
          href: `/marketplace/${l.id}`,
          meta: l.category,
          badge: l.credits_price
            ? `${l.credits_price} ◊`
            : l.price
              ? `$${Number(l.price).toFixed(0)}`
              : null,
          createdAt: l.created_at,
        });
      });

      (ev.data ?? []).forEach((e: any) => {
        if (ilike && !`${e.title} ${e.venue_name ?? ""}`.toLowerCase().includes(term.toLowerCase())) return;
        tiles.push({
          id: `ev-${e.id}`,
          kind: "event",
          title: e.title,
          cover: e.cover_url,
          href: `/spaces/events/${e.id}`,
          meta: format(new Date(e.starts_at), "EEE, MMM d · h:mm a"),
          subtitle: e.is_online ? "Online" : e.venue_name,
          createdAt: e.starts_at,
        });
      });

      (sp.data ?? []).forEach((s: any) => {
        if (ilike && !`${s.name} ${s.description ?? ""}`.toLowerCase().includes(term.toLowerCase())) return;
        tiles.push({
          id: `sp-${s.id}`,
          kind: "space",
          title: s.name,
          description: s.description,
          cover: s.cover_image_url,
          href: `/studios/${s.id}`,
          subtitle: [s.city, s.country].filter(Boolean).join(", ") || null,
          createdAt: s.cover_image_url ?? new Date().toISOString(),
        });
      });

      (wk.data ?? []).forEach((w: any) => {
        const desc = (w.metadata as Record<string, unknown> | null)?.description as string | undefined;
        if (ilike && !`${w.action_type} ${desc ?? ""}`.toLowerCase().includes(term.toLowerCase())) return;
        tiles.push({
          id: `wk-${w.id}`,
          kind: "work",
          title: desc ?? w.action_type,
          href: `/works`,
          meta: w.action_type,
          signature: w.solana_signature,
          createdAt: w.anchored_at ?? w.created_at,
        });
      });

      return seededShuffle(tiles, tiles.length);
    },
    staleTime: 30_000,
  });

  const allTiles = data ?? [];

  // Per-kind counts power the badge numbers in HubPage's filter chips.
  const counts = useMemo(() => {
    const c: Record<MosaicKindFilter, number> = {
      all: allTiles.length, drop: 0, offering: 0, opportunity: 0, event: 0, space: 0, work: 0,
    };
    for (const t of allTiles) c[t.kind]++;
    return c;
  }, [allTiles]);

  // Broadcast counts upward so HubPage chips can show them.
  // We use a module-level event so we don't have to thread props back up.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("hub-mosaic-counts", { detail: counts }));
  }, [counts]);

  const tiles = useMemo(() => {
    const filtered = kind === "all" ? allTiles : allTiles.filter((t) => t.kind === kind);
    return filtered.slice(0, 24);
  }, [allTiles, kind]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[150px] gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`${SIZE_PATTERN[i % SIZE_PATTERN.length]} rounded-2xl bg-muted animate-pulse`}
          />
        ))}
      </div>
    );
  }

  if (tiles.length === 0) {
    const hasSearch = search.trim().length > 0;
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-foreground font-medium">
          {hasSearch ? "Nothing matches that search." : kind !== "all" ? "Nothing here yet." : "The Stream is quiet."}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {hasSearch ? "Try a different word, or clear the filter." : "Be the first to drop something above."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[150px] gap-3">
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
      {/* Background — image or gradient tint */}
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
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${tint} transition-transform duration-700 group-hover:scale-110`} />
      )}

      {/* Gradient overlay for legibility on imagery */}
      {hasImage && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      )}

      {/* Hover scrim — extra contrast on hover so the preview handoff
          feels intentional. */}
      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300 pointer-events-none" />

      {/* Top chip row */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2 z-10">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-md ${chipBg}`}>
          <Icon className="h-2.5 w-2.5" />
          {label}
        </span>
        {tile.badge && (
          <span className="inline-flex items-center rounded-full bg-background/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-foreground shadow-sm">
            {tile.badge}
          </span>
        )}
        {tile.kind === "work" && tile.signature && (
          <VerifiedIPBadge signature={tile.signature} size="xs" />
        )}
      </div>

      {/* Content footer */}
      <div className={`absolute inset-x-0 bottom-0 p-3 ${hasImage ? "text-white" : "text-foreground"} z-10`}>
        {tile.meta && (
          <p className={`text-[10px] uppercase tracking-wider mb-1 ${hasImage ? "text-white/80" : "text-muted-foreground"}`}>
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
        {!tile.subtitle && tile.description && isLarge && !hasImage && (
          <p className="text-xs mt-1 text-muted-foreground line-clamp-2 leading-relaxed">
            {tile.description}
          </p>
        )}
        {isLarge && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2 opacity-80 group-hover:opacity-100 group-hover:gap-1.5 transition-all ${hasImage ? "text-white" : "text-foreground"}`}>
            Open <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </motion.button>
  );

  return tileButton;
};


export default ConversationsMosaic;
