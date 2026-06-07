/**
 * Discover — single continuous freeflowing feed.
 *
 * Layout (top → bottom):
 *   1. Hero gradient banner
 *   2. Coins in Motion lane
 *   3. Sticky filter bar (All · Projects · Coins · Artists · Opportunities · Spaces)
 *   4. Continuous feed — sections rendered inline with no headers/cards around them.
 *        • Projects     → ActiveProjectsLane (existing design)
 *        • Coins        → CoinsInMotionLane (existing design, repeated when filter=coins)
 *        • Artists      → 56px circle avatars, horizontal scroll
 *        • Opportunities → clean list rows w/ thin dividers
 *        • Spaces       → spaces + events grid
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CoinsInMotionLane from "@/components/discover/CoinsInMotionLane";
import ActiveProjectsLane from "@/components/discover/ActiveProjectsLane";
import {
  useHireRows,
  useSpaceRows,
  useCallRows,
  useEventRows,
  type ConnectRow,
} from "@/components/connect/useConnectRows";

type FilterKey = "all" | "projects" | "coins" | "artists" | "opportunities" | "spaces";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "projects", label: "Projects" },
  { key: "coins", label: "Coins" },
  { key: "artists", label: "Artists" },
  { key: "opportunities", label: "Opportunities" },
  { key: "spaces", label: "Spaces" },
];

// ─── Artists row — circular avatars, horizontal scroll ─────────────────
const ArtistsRow = ({ rows }: { rows: ConnectRow[] }) => {
  if (!rows.length) return null;
  return (
    <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
      <div className="flex gap-5 pb-1">
        {rows.map((row) => {
          const initials = (row.ownerName || row.title || "?")
            .split(/\s+/)
            .map((s) => s[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase();
          return (
            <Link
              key={`artist-${row.id}`}
              to={row.detailHref}
              className="group shrink-0 flex flex-col items-center gap-1.5 w-[68px]"
            >
              {row.ownerAvatar ? (
                <img
                  src={row.ownerAvatar}
                  alt={row.ownerName || row.title}
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
              <p className="text-[11px] text-foreground/85 leading-tight text-center truncate w-full">
                {row.ownerName || row.title}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

// ─── Opportunities — clean list rows, thin dividers ─────────────────────
const OpportunitiesList = ({ rows }: { rows: ConnectRow[] }) => {
  if (!rows.length) return null;
  return (
    <div className="divide-y divide-border/60">
      {rows.map((row) => {
        const isPaid = row.priceLabel && !/free|collab/i.test(row.priceLabel);
        const tagLabel = isPaid ? "Paid" : "Collab";
        return (
          <Link
            key={`call-${row.id}`}
            to={row.detailHref}
            className="flex items-center gap-3 py-3.5 group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-[15px] font-semibold text-foreground truncate group-hover:text-foreground/80 transition-colors">
                {row.title}
              </p>
              {row.subtitle && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {row.subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  isPaid
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : "bg-violet-500/15 text-violet-600 dark:text-violet-300",
                )}
              >
                {tagLabel}
              </span>
              <div className="flex items-center gap-1.5 min-w-0 max-w-[140px]">
                {row.ownerAvatar ? (
                  <img
                    src={row.ownerAvatar}
                    alt={row.ownerName || ""}
                    className="h-6 w-6 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
                )}
                <span className="text-[11px] text-muted-foreground truncate">
                  {row.ownerName || "—"}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

// ─── Spaces (spaces + events) — small editorial grid ────────────────────
const SpacesGrid = ({ rows }: { rows: ConnectRow[] }) => {
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map((row) => {
        const isEvent = row.kind === "event";
        return (
          <Link
            key={`${row.kind}-${row.id}`}
            to={row.detailHref}
            className="group flex gap-3 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-3 hover:border-foreground/30 hover:-translate-y-0.5 transition-all"
          >
            <div
              className="h-20 w-20 shrink-0 rounded-xl bg-cover bg-center"
              style={{
                backgroundImage: row.coverUrl
                  ? `url(${row.coverUrl})`
                  : isEvent
                    ? "linear-gradient(135deg, hsl(38 92% 65%), hsl(20 95% 65%))"
                    : "linear-gradient(135deg, hsl(170 70% 55%), hsl(190 70% 55%))",
              }}
            />
            <div className="min-w-0 flex-1 py-0.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                  isEvent
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                    : "bg-teal-500/15 text-teal-600 dark:text-teal-300",
                )}
              >
                {isEvent ? "Event" : "Space"}
              </span>
              <p className="text-sm font-semibold text-foreground truncate mt-1.5 leading-tight">
                {row.title}
              </p>
              {row.metaLabel && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {row.metaLabel}
                </p>
              )}
              {row.priceLabel && (
                <p className="text-[11px] text-foreground/80 tabular-nums mt-0.5">
                  {row.priceLabel}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};

const DiscoverPage = () => {
  const [filter, setFilter] = useState<FilterKey>("all");

  const showArtists = filter === "all" || filter === "artists";
  const showOpps = filter === "all" || filter === "opportunities";
  const showSpaces = filter === "all" || filter === "spaces";
  const showProjects = filter === "all" || filter === "projects";
  const showCoins = filter === "coins"; // coins lane always renders above filter; repeat here only when filtered

  const hire = useHireRows(showArtists);
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
    (showArtists && hire.isLoading) ||
    (showOpps && call.isLoading) ||
    (showSpaces && (space.isLoading || event.isLoading));

  const hasAny =
    (showArtists && (hire.data?.length ?? 0) > 0) ||
    (showOpps && (call.data?.length ?? 0) > 0) ||
    (showSpaces && spacesRows.length > 0) ||
    showProjects ||
    showCoins;

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-6 px-1">
      {/* Hero banner — gradient */}
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

      {/* Coins in Motion */}
      <CoinsInMotionLane />

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/85 backdrop-blur-md border-b border-border/60">
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

      {/* Continuous feed — no section headers */}
      <div className="space-y-8">
        {showProjects && <ActiveProjectsLane />}

        {showCoins && <CoinsInMotionLane />}

        {showArtists && <ArtistsRow rows={hire.data ?? []} />}

        {showOpps && <OpportunitiesList rows={call.data ?? []} />}

        {showSpaces && <SpacesGrid rows={spacesRows} />}

        {isLoading && !hasAny && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverPage;
