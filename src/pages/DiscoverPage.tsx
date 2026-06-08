/**
 * Discover — single continuous freeflowing feed.
 *
 * Structure:
 *   1. Hero gradient banner
 *   2. Building Now (Projects) — always-visible grid
 *   3. Sticky filter bar (All · Projects · Coins · Artists · Opportunities · Spaces)
 *   4. Continuous feed (grids, no horizontal scroll):
 *        • Coins         → CoinsInMotionLane (grid)
 *        • Artists       → profiles with an archetype (musicians/producers/etc.)
 *        • Opportunities → editorial cards w/ cover gradient + tags
 *        • Spaces        → spaces + events grid
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import CoinsInMotionLane from "@/components/discover/CoinsInMotionLane";
import ActiveProjectsLane from "@/components/discover/ActiveProjectsLane";
import {
  useSpaceRows,
  useCallRows,
  useEventRows,
  type ConnectRow,
} from "@/components/connect/useConnectRows";
import { ARCHETYPE_BY_ID, normalizeArchetype } from "@/lib/archetypes";

type FilterKey = "all" | "projects" | "coins" | "artists" | "opportunities" | "spaces";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "projects", label: "Projects" },
  { key: "coins", label: "Coins" },
  { key: "artists", label: "Artists" },
  { key: "opportunities", label: "Opportunities" },
  { key: "spaces", label: "Spaces" },
];

// ─── Artists grid — circular avatars wrapped, only real musicians/artists ──
type ArtistProfile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  archetype: string | null;
};

const useArtistProfiles = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: ["discover-artists-archetype"],
    staleTime: 60_000,
    queryFn: async (): Promise<ArtistProfile[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, archetype")
        .not("archetype", "is", null)
        .eq("is_public", true)
        .order("featured_pin_until", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(60);
      return (data ?? []) as ArtistProfile[];
    },
  });

const ArtistsGrid = ({ rows }: { rows: ArtistProfile[] }) => {
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-y-5 gap-x-3">
      {rows.map((p) => {
        const name = p.display_name || p.username || "Artist";
        const initials = name
          .split(/\s+/)
          .map((s) => s[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();
        const arche = normalizeArchetype(p.archetype);
        const meta = arche ? ARCHETYPE_BY_ID.get(arche) : null;
        return (
          <Link
            key={p.user_id}
            to={`/profiles/${p.user_id}`}
            className="group flex flex-col items-center gap-1.5 min-w-0"
          >
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={name}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-transparent group-hover:ring-foreground/30 transition-all"
              />
            ) : (
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center font-display text-sm font-bold text-white shadow-sm"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, hsl(330 80% 65%), hsl(292 75% 60%), hsl(38 92% 60%))",
                }}
              >
                {initials || "·"}
              </div>
            )}
            <p className="text-[11px] font-medium text-foreground/90 leading-tight text-center truncate w-full">
              {name}
            </p>
            {meta && (
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/80 truncate w-full text-center">
                {meta.label}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
};

// ─── Opportunities — editorial cards ────────────────────────────────────
const OPPORTUNITY_GRADIENTS = [
  "linear-gradient(135deg, hsl(265 75% 65%), hsl(292 75% 60%))",
  "linear-gradient(135deg, hsl(330 80% 65%), hsl(20 90% 65%))",
  "linear-gradient(135deg, hsl(200 85% 60%), hsl(265 75% 65%))",
  "linear-gradient(135deg, hsl(38 92% 60%), hsl(330 80% 65%))",
  "linear-gradient(135deg, hsl(170 70% 50%), hsl(200 85% 60%))",
];

const OpportunitiesGrid = ({ rows }: { rows: ConnectRow[] }) => {
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {rows.map((row, idx) => {
        const isPaid = row.priceLabel && !/free|collab/i.test(row.priceLabel);
        const tagLabel = isPaid ? "Paid" : "Collab";
        const gradient = OPPORTUNITY_GRADIENTS[idx % OPPORTUNITY_GRADIENTS.length];
        const ownerName = row.ownerName || "Open";
        return (
          <Link
            key={`call-${row.id}`}
            to={row.detailHref}
            className="group relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-foreground/30 flex flex-col"
          >
            {/* Decorative gradient strip */}
            <div
              className="relative h-20 w-full"
              style={{ backgroundImage: row.coverUrl ? `url(${row.coverUrl})` : gradient, backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md",
                    isPaid
                      ? "bg-emerald-500/90 text-white"
                      : "bg-white/85 text-foreground",
                  )}
                >
                  {tagLabel}
                </span>
                {row.category && (
                  <span className="inline-flex items-center rounded-full bg-background/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-foreground/80 capitalize">
                    {row.category}
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-3.5 space-y-2.5 flex-1 flex flex-col">
              <p className="text-[15px] font-bold text-foreground leading-snug line-clamp-2">
                {row.title}
              </p>
              {row.subtitle && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                  {row.subtitle}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {row.ownerAvatar ? (
                    <img
                      src={row.ownerAvatar}
                      alt={ownerName}
                      className="h-6 w-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
                  )}
                  <span className="text-[11px] font-medium text-foreground/85 truncate">
                    {ownerName}
                  </span>
                </div>
                {row.priceLabel && (
                  <span className="text-[11px] tabular-nums text-foreground/80 shrink-0">
                    {row.priceLabel}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

// ─── Spaces (spaces + events) ───────────────────────────────────────────
const SpacesGrid = ({ rows }: { rows: ConnectRow[] }) => {
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {rows.map((row) => {
        const isEvent = row.kind === "event";
        return (
          <Link
            key={`${row.kind}-${row.id}`}
            to={row.detailHref}
            className="group flex flex-col rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden hover:border-foreground/30 hover:-translate-y-0.5 hover:shadow-xl transition-all"
          >
            <div
              className="aspect-[16/10] w-full bg-cover bg-center"
              style={{
                backgroundImage: row.coverUrl
                  ? `url(${row.coverUrl})`
                  : isEvent
                    ? "linear-gradient(135deg, hsl(38 92% 65%), hsl(20 95% 65%))"
                    : "linear-gradient(135deg, hsl(170 70% 55%), hsl(190 70% 55%))",
              }}
            />
            <div className="p-3.5 space-y-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  isEvent
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                    : "bg-teal-500/15 text-teal-600 dark:text-teal-300",
                )}
              >
                {isEvent ? "Event" : "Space"}
              </span>
              <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                {row.title}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                {row.metaLabel ? (
                  <span className="inline-flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{row.metaLabel}</span>
                  </span>
                ) : <span />}
                {row.priceLabel && (
                  <span className="tabular-nums text-foreground/80">{row.priceLabel}</span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

const DiscoverPage = () => {
  const [filter, setFilter] = useState<FilterKey>("all");

  const showCoins = filter === "coins";
  const showProjects = filter === "projects";
  const showArtists = filter === "all" || filter === "artists";
  const showOpps = filter === "all" || filter === "opportunities";
  const showSpaces = filter === "all" || filter === "spaces";

  const artists = useArtistProfiles(showArtists);
  const call = useCallRows(showOpps);
  const space = useSpaceRows(showSpaces);
  const event = useEventRows(showSpaces);

  const spacesRows = useMemo<ConnectRow[]>(() => {
    const out: ConnectRow[] = [];
    if (showSpaces) {
      out.push(...(space.data ?? []));
      out.push(...(event.data ?? []));
    }
    return out;
  }, [showSpaces, space.data, event.data]);

  const isLoading =
    (showArtists && artists.isLoading) ||
    (showOpps && call.isLoading) ||
    (showSpaces && (space.isLoading || event.isLoading));

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-8 px-1">
      {/* Hero banner */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full rounded-3xl overflow-hidden shadow-[0_30px_80px_-30px_hsl(var(--foreground)/0.4)]"
      >
        <div
          className="absolute inset-0 bg-[length:300%_300%] animate-gradient-shift"
          style={{
            backgroundImage:
              "linear-gradient(120deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 25%, hsl(38 92% 55%) 50%, hsl(292 84% 61%) 75%, hsl(330 85% 60%) 100%)",
          }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, hsl(0 0% 100% / 0.25), transparent 40%), radial-gradient(circle at 80% 70%, hsl(0 0% 100% / 0.18), transparent 45%)",
          }}
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          aria-hidden
          className="absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/20 blur-3xl"
          animate={{ y: [0, 16, 0], x: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white/15 blur-3xl"
          animate={{ y: [0, -12, 0], x: [0, 12, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative px-5 py-4 sm:px-6 sm:py-5 text-white">
          <p className="text-[9px] uppercase tracking-[0.22em] text-white/80">
            Connect
          </p>
          <h1 className="font-display text-xl sm:text-2xl leading-tight tracking-tight drop-shadow-sm">
            Find your next collaborator.
          </h1>
        </div>
      </motion.section>

      {/* Pinned top — always visible regardless of filter */}
      <CoinsInMotionLane />
      <ActiveProjectsLane limit={12} />

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/85 backdrop-blur-md border-y border-border/60">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-background/70 text-foreground/80 border-border hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtered feed below */}
      <div className="space-y-10">
        {showProjects && (
          <ActiveProjectsLane
            limit={500}
            eyebrow="All public releases"
            title="Every project"
          />
        )}

        {showCoins && <CoinsInMotionLane />}

        {showArtists && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-0.5">
                  Support an artist
                </p>
                <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
                  Artists & musicians
                </h2>
              </div>
              <Link
                to="/profiles"
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
              >
                Browse all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <ArtistsGrid rows={artists.data ?? []} />
          </section>
        )}

        {showOpps && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-0.5">
                  Get hired · collab
                </p>
                <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
                  Opportunities
                </h2>
              </div>
            </div>
            <OpportunitiesGrid rows={call.data ?? []} />
          </section>
        )}

        {showSpaces && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-0.5">
                  Book a room · catch a show
                </p>
                <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
                  Spaces & events
                </h2>
              </div>
            </div>
            <SpacesGrid rows={spacesRows} />
          </section>
        )}

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Floating Flow Mode launcher — vertical swipe-feed icon */}
      <Link
        to="/flow"
        aria-label="Open Flow mode"
        className="fixed bottom-6 right-6 z-40 group"
        style={{ perspective: 600 }}
      >
        {/* Outer pulse rings */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-[22px]"
          animate={{ boxShadow: [
            "0 0 0 0 hsl(180 95% 55% / 0.55)",
            "0 0 0 18px hsl(180 95% 55% / 0)",
          ]}}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          initial={{ scale: 0, opacity: 0, rotateX: -30 }}
          animate={{
            scale: 1,
            opacity: 1,
            rotateX: 0,
            y: [0, -4, 0],
          }}
          transition={{
            scale: { delay: 0.3, type: "spring", stiffness: 240, damping: 16 },
            opacity: { delay: 0.3, duration: 0.3 },
            rotateX: { delay: 0.3, duration: 0.4 },
            y: { duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
          }}
          whileHover={{ scale: 1.1, rotateZ: -4 }}
          whileTap={{ scale: 0.92, rotateZ: 0 }}
          className="relative h-16 w-16 rounded-[22px] flex items-center justify-center text-white overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(140deg, hsl(180 95% 55%) 0%, hsl(220 95% 60%) 45%, hsl(265 90% 62%) 100%)",
            boxShadow:
              "0 22px 40px -10px hsl(220 95% 50% / 0.6), 0 4px 12px -2px hsl(265 90% 50% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.4), inset 0 -3px 8px hsl(265 90% 30% / 0.5)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Glossy top highlight */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 top-1 h-1/2 rounded-[18px]"
            style={{
              backgroundImage: "linear-gradient(180deg, hsl(0 0% 100% / 0.35), hsl(0 0% 100% / 0))",
            }}
          />
          {/* Animated swipe-feed cards icon */}
          <div className="relative h-7 w-6 flex flex-col items-center justify-center gap-[3px]">
            <motion.span
              className="block h-[7px] w-5 rounded-[3px] bg-white/55"
              animate={{ y: [0, 14, 14], opacity: [1, 0, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", times: [0, 0.7, 1] }}
            />
            <motion.span
              className="block h-[10px] w-5 rounded-[4px] bg-white"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ boxShadow: "0 2px 6px hsl(220 95% 30% / 0.4)" }}
            />
            <motion.span
              className="block h-[7px] w-5 rounded-[3px] bg-white/35"
              animate={{ y: [0, -3, 0], opacity: [0.35, 0.55, 0.35] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          {/* Shimmer sweep */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(115deg, transparent 35%, hsl(0 0% 100% / 0.35) 50%, transparent 65%)",
            }}
            animate={{ x: ["-120%", "120%"] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.4 }}
          />
        </motion.div>
        <span className="pointer-events-none absolute right-[72px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-foreground text-background text-[11px] font-semibold px-2.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
          Flow
        </span>
      </Link>
    </div>
  );
};

export default DiscoverPage;
