/**
 * Discover — Fan & investor surface.
 *
 * Layout:
 *   1. Hero banner ("CONNECT · Find your next collaborator.")
 *   2. Coins in Motion lane (auto-hidden when empty)
 *   3. Filter pills + Sort dropdown
 *   4. Results header ([X] RESULTS · [ACTIVE FILTER])
 *   5. Card grid (2-col desktop, 1 mobile, every 6th featured full-width)
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowRight, ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CoinsInMotionLane from "@/components/discover/CoinsInMotionLane";
import {
  useHireRows,
  useSpaceRows,
  useCallRows,
  useEventRows,
  type ConnectRow,
} from "@/components/connect/useConnectRows";
import { useAuth } from "@/contexts/AuthContext";

type FilterKey = "all" | "creators" | "calls" | "spaces" | "for-you" | "flow";
type SortKey = "recent";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "creators", label: "Find Creators" },
  { key: "calls", label: "Opportunities" },
  { key: "spaces", label: "Spaces" }, // spaces + events combined
  { key: "for-you", label: "For You" },
  { key: "flow", label: "Flow" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Most Recent" },
];

const CATEGORY_STYLE: Record<
  ConnectRow["kind"],
  { label: string; pill: string; gradient: string; cta: string }
> = {
  hire: {
    label: "Creator",
    pill: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30",
    gradient: "linear-gradient(135deg, hsl(330 80% 70%), hsl(20 90% 70%))",
    cta: "View Creator",
  },
  call: {
    label: "Open Call",
    pill: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
    gradient: "linear-gradient(135deg, hsl(265 75% 65%), hsl(290 75% 65%))",
    cta: "Apply Now",
  },
  event: {
    label: "Event",
    pill: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
    gradient: "linear-gradient(135deg, hsl(38 92% 65%), hsl(20 95% 65%))",
    cta: "See Event",
  },
  space: {
    label: "Space",
    pill: "bg-teal-500/15 text-teal-600 dark:text-teal-300 border-teal-500/30",
    gradient: "linear-gradient(135deg, hsl(170 70% 55%), hsl(190 70% 55%))",
    cta: "Join Space",
  },
};

interface CardProps {
  row: ConnectRow;
  featured?: boolean;
}

const DiscoverCard = ({ row, featured }: CardProps) => {
  const style = CATEGORY_STYLE[row.kind];
  const initials = (row.title || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      to={row.detailHref}
      className={cn(
        "group block rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden",
        "transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-foreground/30",
        featured && "sm:col-span-2 relative",
      )}
    >
      {/* Top half: cover */}
      <div
        className={cn(
          "relative w-full",
          featured ? "aspect-[21/9]" : "aspect-[16/10]",
        )}
        style={{
          backgroundImage: row.coverUrl ? `url(${row.coverUrl})` : style.gradient,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!row.coverUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-5xl font-bold text-white/85 drop-shadow">
              {initials || "·"}
            </span>
          </div>
        )}
        {/* Category pill top-left */}
        <span
          className={cn(
            "absolute top-3 left-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm bg-background/70",
            style.pill,
          )}
        >
          {style.label}
        </span>
        {/* Featured tag top-right */}
        {featured && (
          <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-foreground/90 text-background px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Featured
          </span>
        )}
        {/* Bottom overlay: avatar + name + city */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          <div className="flex items-center gap-2">
            {row.ownerAvatar ? (
              <img
                src={row.ownerAvatar}
                alt={row.ownerName || row.title}
                className="h-8 w-8 rounded-full border border-white/30 object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-[10px] font-bold text-white">
                {(row.ownerName || row.title || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {row.title}
              </p>
              {row.metaLabel && (
                <p className="text-[11px] text-white/75 truncate">{row.metaLabel}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom half: meta */}
      <div className="p-4 space-y-2.5 bg-card/40">
        <div className="flex items-center gap-2 flex-wrap">
          {row.category && (
            <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
              {row.category}
            </span>
          )}
          {row.priceLabel && (
            <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-foreground tabular-nums">
              {row.priceLabel}
            </span>
          )}
          {row.isPro && (
            <span className="inline-flex items-center rounded-full bg-foreground/90 text-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              Verified Pro
            </span>
          )}
        </div>

        {row.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {row.subtitle}
          </p>
        )}

        <Button size="sm" variant="secondary" className="w-full rounded-full gap-1.5">
          {style.cta} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Link>
  );
};

const DiscoverPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const enableHire = filter === "all" || filter === "creators" || filter === "for-you";
  const enableCall = filter === "all" || filter === "calls" || filter === "for-you";
  const enableSpace = filter === "all" || filter === "spaces" || filter === "for-you";
  const enableEvent = filter === "all" || filter === "spaces" || filter === "for-you";

  const hire = useHireRows(enableHire);
  const call = useCallRows(enableCall);
  const space = useSpaceRows(enableSpace);
  const event = useEventRows(enableEvent);

  const isLoading =
    (enableHire && hire.isLoading) ||
    (enableCall && call.isLoading) ||
    (enableSpace && space.isLoading) ||
    (enableEvent && event.isLoading);

  const rows = useMemo<ConnectRow[]>(() => {
    const collected: ConnectRow[] = [];
    if (enableHire) collected.push(...(hire.data ?? []));
    if (enableCall) collected.push(...(call.data ?? []));
    if (enableSpace) collected.push(...(space.data ?? []));
    if (enableEvent) collected.push(...(event.data ?? []));

    // Sort. "Most Recent" keeps source order (each hook already orders newest first).
    // Other sorts currently fall back to source order until real per-row signals
    // are wired in via an RPC (RLS blocks direct counts).

    // For You: Pro first, then everyone.
    if (filter === "for-you") {
      return [
        ...collected.filter((r) => r.isPro),
        ...collected.filter((r) => !r.isPro),
      ];
    }
    return collected;
  }, [enableHire, enableCall, enableSpace, enableEvent, hire.data, call.data, space.data, event.data, sort, filter]);

  const activeFilterLabel =
    FILTERS.find((f) => f.key === filter)?.label.toUpperCase() ?? "ALL";
  const activeSortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Most Recent";

  // Stats for right rail
  const kindCounts = useMemo(() => {
    const c = { hire: 0, call: 0, space: 0, event: 0 };
    rows.forEach((r) => {
      c[r.kind] = (c[r.kind] ?? 0) + 1;
    });
    return c;
  }, [rows]);
  const proCount = useMemo(() => rows.filter((r) => r.isPro).length, [rows]);

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-8">
      {/* SECTION 1 — Hero banner (gradient slider box, matches /studio) */}
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

      {/* SECTION 2 — Coins in Motion (full width) */}
      <CoinsInMotionLane />

      {/* SECTION 3 — Asymmetrical 2/3 + 1/3 split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        {/* LEFT — main scrolling feed (2 cols) */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Filter pills + Sort */}
          <section className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      if (f.key === "flow") {
                        navigate("/flow");
                        return;
                      }
                      setFilter(f.key);
                    }}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
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

          </section>

          {/* Results header */}
          <div className="flex items-center gap-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold tabular-nums">
              {rows.length} RESULTS · {activeFilterLabel}
            </p>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Card grid */}
          {isLoading && rows.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nothing here yet — try another filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rows.map((row, idx) => {
                const featured = (idx + 1) % 6 === 0;
                return <DiscoverCard key={`${row.kind}-${row.id}`} row={row} featured={featured} />;
              })}
            </div>
          )}

          {!user && (
            <section className="text-center pt-6 space-y-2">
              <Link to="/auth">
                <Button size="lg" className="rounded-full gap-1.5">
                  Join the network <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-[11px] text-muted-foreground">
                Free to start. Built for independent creators.
              </p>
            </section>
          )}
        </div>

        {/* RIGHT — sticky stats sidebar (1 col) */}
        <aside className="lg:col-span-1 lg:sticky lg:top-20 space-y-4">
          <DiscoverStatsRail
            kindCounts={kindCounts}
            total={rows.length}
            proCount={proCount}
          />
        </aside>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// DiscoverStatsRail — sticky right column: live counts + composition bar
// ─────────────────────────────────────────────────────────────────────
function DiscoverStatsRail({
  kindCounts,
  total,
  proCount,
}: {
  kindCounts: { hire: number; call: number; space: number; event: number };
  total: number;
  proCount: number;
}) {
  const rows: { key: keyof typeof kindCounts; label: string; color: string }[] = [
    { key: "hire", label: "Creators", color: "hsl(330 80% 65%)" },
    { key: "call", label: "Opportunities", color: "hsl(265 75% 65%)" },
    { key: "space", label: "Spaces", color: "hsl(170 70% 50%)" },
    { key: "event", label: "Events", color: "hsl(38 92% 60%)" },
  ];
  const max = Math.max(1, ...rows.map((r) => kindCounts[r.key]));

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-3">
          Live on Discover
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-display text-2xl font-bold tabular-nums leading-none">
              {total}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">total results</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold tabular-nums leading-none">
              {proCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Pro creators</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-3">
          By category
        </p>
        <div className="space-y-2.5">
          {rows.map((r) => {
            const val = kindCounts[r.key];
            const pct = (val / max) * 100;
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-foreground/80">{r.label}</span>
                  <span className="tabular-nums text-muted-foreground">{val}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, backgroundColor: r.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-3">
          Quick links
        </p>
        <div className="flex flex-col gap-1.5 text-sm">
          <Link to="/flow" className="text-foreground/80 hover:text-foreground transition-colors">
            → Open Flow
          </Link>
          <Link to="/credits" className="text-foreground/80 hover:text-foreground transition-colors">
            → Creator Pass
          </Link>
          <Link to="/messages" className="text-foreground/80 hover:text-foreground transition-colors">
            → Messages
          </Link>
        </div>
      </div>
    </>
  );
}

export default DiscoverPage;
