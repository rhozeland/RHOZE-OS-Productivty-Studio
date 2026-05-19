import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ArrowRight, Sparkles, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { avatarGradientFor } from "@/lib/avatar-gradient";
import ConnectMatchDeck from "@/components/connect/ConnectMatchDeck";
import RoomHero from "@/components/rooms/RoomHero";
import {
  useHireRows,
  useSpaceRows,
  useCallRows,
  useEventRows,
  KIND_META,
  type ConnectKind,
  type ConnectRow,
} from "@/components/connect/useConnectRows";

/**
 * CONNECT — Discover marketplace.
 *
 * v9.9.2: Instagram Explore–style single-surface feed. Filter pills
 * ("All · Find Creators · Opportunities · Spaces · Events · For You") refilter
 * the unified feed inline — no navigation. Match deck stays pinned at the top.
 */

type FilterKey = "all" | "hire" | "call" | "space" | "event" | "foryou";

const FILTERS: { key: FilterKey; label: string; kinds: ConnectKind[] | "all" | "foryou" }[] = [
  { key: "all", label: "All", kinds: "all" },
  { key: "hire", label: "Find Creators", kinds: ["hire"] },
  { key: "call", label: "Opportunities", kinds: ["call"] },
  { key: "space", label: "Spaces", kinds: ["space"] },
  { key: "event", label: "Events", kinds: ["event"] },
  { key: "foryou", label: "For You", kinds: "foryou" },
];

const KIND_TAG_COLOR: Record<ConnectKind, string> = {
  hire: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/20",
  call: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  space: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  event: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
};

const KIND_TAG_LABEL: Record<ConnectKind, string> = {
  hire: "Creator",
  call: "Open Call",
  space: "Space",
  event: "Event",
};

// URL ?kind= back-compat → map onto new filter keys
const URL_TO_FILTER: Record<string, FilterKey> = {
  hire: "hire",
  space: "space",
  spaces: "space",
  call: "call",
  calls: "call",
  event: "event",
  events: "event",
  foryou: "foryou",
  all: "all",
};

const MarketRoomPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = URL_TO_FILTER[(searchParams.get("kind") || "").toLowerCase()];
  const [filter, setFilter] = useState<FilterKey>(urlFilter ?? "all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (urlFilter && urlFilter !== filter) setFilter(urlFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter]);

  // Always fetch all kinds so filter switches are instant.
  const hire = useHireRows(true);
  const spaces = useSpaceRows(true);
  const calls = useCallRows(true);
  const events = useEventRows(true);

  const isLoading =
    hire.isLoading && spaces.isLoading && calls.isLoading && events.isLoading;

  const all: ConnectRow[] = useMemo(() => {
    return interleave([
      hire.data ?? [],
      spaces.data ?? [],
      calls.data ?? [],
      events.data ?? [],
    ]);
  }, [hire.data, spaces.data, calls.data, events.data]);

  const filtered = useMemo(() => {
    let rows = all;
    const def = FILTERS.find((f) => f.key === filter);
    if (def?.kinds === "foryou") {
      // Simple heuristic: Verified Pro creators first, then newest mixed.
      rows = [...all.filter((r) => r.isPro), ...all.filter((r) => !r.isPro)];
    } else if (Array.isArray(def?.kinds)) {
      rows = all.filter((r) => (def!.kinds as ConnectKind[]).includes(r.kind));
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subtitle || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q),
    );
  }, [all, filter, search]);

  const handleFilterChange = (next: FilterKey) => {
    setFilter(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("kind");
    else params.set("kind", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-6">
      <RoomHero variant="connect" eyebrow="Connect" title="Find your next collaborator." />

      {/* Matchmaking HUD — pinned regardless of filter */}
      <ConnectMatchDeck />

      {/* Filter pills + search */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            const Icon = key === "all" ? LayoutGrid : key === "foryou" ? Sparkles : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleFilterChange(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 border",
                  active
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative rounded-2xl border border-border bg-card/60 overflow-hidden">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="What are you looking for?"
            className="pl-11 h-12 border-0 rounded-none focus-visible:ring-0 bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Results */}
      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{filtered.length} results</span>
          <span className="hidden sm:inline">
            {FILTERS.find((f) => f.key === filter)?.label}
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {isLoading && (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
              ))}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-10 text-center">
              <LayoutGrid className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            </div>
          )}
          {filtered.map((row) => {
            const grad = avatarGradientFor(row.ownerId || row.id);
            const ownerName = row.ownerName || "Creator";
            const KindIcon = KIND_META[row.kind].Icon;
            return (
              <div
                key={`${row.kind}-${row.id}`}
                className="group w-full px-4 py-3 transition-colors flex items-start gap-3 hover:bg-muted/40"
              >
                <HoverCard openDelay={120} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (row.ownerId) navigate(`/profiles/${row.ownerId}`);
                      }}
                      aria-label={`View ${ownerName}'s profile`}
                      className="shrink-0 h-10 w-10 rounded-full overflow-hidden ring-1 ring-border/60 hover:ring-2 hover:ring-foreground/40 transition"
                      style={{ background: grad.background }}
                    >
                      {row.ownerAvatar && (
                        <img src={row.ownerAvatar} alt={ownerName} className="h-full w-full object-cover" />
                      )}
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent side="right" align="start" className="w-64 p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-full overflow-hidden ring-1 ring-border/60 shrink-0"
                        style={{ background: grad.background }}
                      >
                        {row.ownerAvatar && (
                          <img src={row.ownerAvatar} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{ownerName}</p>
                        <p className="text-[11px] text-muted-foreground capitalize truncate">
                          {row.category || row.kind}
                        </p>
                      </div>
                    </div>
                    {row.ownerId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/profiles/${row.ownerId}`)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-1 text-xs font-medium rounded-md border border-border/60 px-2 py-1.5 hover:bg-muted transition"
                      >
                        View profile <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </HoverCardContent>
                </HoverCard>

                <button
                  type="button"
                  onClick={() => navigate(row.detailHref)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                            KIND_TAG_COLOR[row.kind],
                          )}
                        >
                          <KindIcon className="h-3 w-3" />
                          {KIND_TAG_LABEL[row.kind]}
                        </span>
                      </div>
                      <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">
                        {row.title}
                      </h3>
                    </div>
                    {row.priceLabel && (
                      <span className="shrink-0 text-xs font-semibold text-foreground tabular-nums">
                        {row.priceLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    {row.subtitle && <span className="truncate">{row.subtitle}</span>}
                    {row.metaLabel && (
                      <>
                        <span>·</span>
                        <span>{row.metaLabel}</span>
                      </>
                    )}
                    {row.category && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{row.category}</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function interleave<T>(groups: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) {
    for (const g of groups) if (g[i]) out.push(g[i]);
  }
  return out;
}

export default MarketRoomPage;
