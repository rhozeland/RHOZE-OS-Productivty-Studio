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

// Lightweight deterministic momentum / supporter stand-ins so cards feel
// alive even before we hook up real per-entity stats. Stable per id.
const seededInt = (seed: string, max: number, offset = 0) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h + offset) % max;
};

const SupporterStack = ({ count, seed }: { count: number; seed: string }) => {
  const dots = Math.min(3, count);
  return (
    <div className="flex -space-x-1.5">
      {Array.from({ length: dots }).map((_, i) => {
        const hue = seededInt(seed, 360, i * 47);
        return (
          <span
            key={i}
            className="h-5 w-5 rounded-full border border-background"
            style={{ background: `hsl(${hue} 70% 65%)` }}
            aria-hidden
          />
        );
      })}
    </div>
  );
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

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8">
      {/* SECTION 1 — Hero banner */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative pt-2 overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 h-[360px] w-[360px] rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, hsl(330 85% 70% / 0.5), transparent 55%)," +
              "radial-gradient(circle at 70% 60%, hsl(38 92% 65% / 0.5), transparent 60%)," +
              "radial-gradient(circle at 50% 90%, hsl(160 65% 60% / 0.35), transparent 60%)",
          }}
        />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
            Connect
          </p>
          <h1 className="font-display text-3xl sm:text-4xl leading-[1.05] text-foreground tracking-tight max-w-2xl">
            Find your next collaborator.
          </h1>
        </div>
      </motion.header>

      {/* SECTION 2 — Coins in Motion */}
      <CoinsInMotionLane />

      {/* SECTION 3 — Filter pills + Sort */}
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3.5 py-1.5 text-xs font-medium text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors">
              Sort: {activeSortLabel} <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {SORTS.map((s) => (
              <DropdownMenuItem
                key={s.key}
                onClick={() => setSort(s.key)}
                className="text-xs"
              >
                <Check
                  className={cn(
                    "h-3.5 w-3.5 mr-2",
                    sort === s.key ? "opacity-100" : "opacity-0",
                  )}
                />
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </section>

      {/* SECTION 4 — Results header */}
      <div className="flex items-center gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold tabular-nums">
          {rows.length} RESULTS · {activeFilterLabel}
        </p>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* SECTION 5 — Card grid */}
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
            // Every 6th card featured (idx 5, 11, 17 …)
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
  );
};

export default DiscoverPage;
