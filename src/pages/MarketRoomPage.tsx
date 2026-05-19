import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ArrowRight, Sparkles, LayoutGrid, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  hire: "bg-rose-500 text-white",
  call: "bg-purple-500 text-white",
  space: "bg-teal-500 text-white",
  event: "bg-amber-500 text-white",
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
      <div>
        <div className="flex items-center justify-between mb-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>{filtered.length} results</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              {FILTERS.find((f) => f.key === filter)?.label}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition">
              Sort: Most Recent
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Most Recent</DropdownMenuItem>
              <DropdownMenuItem>Featured First</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-72 bg-muted/50 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/60 p-10 text-center">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((row) => {
              const grad = avatarGradientFor(row.ownerId || row.id);
              const ownerName = row.ownerName || "Creator";
              return (
                <button
                  key={`${row.kind}-${row.id}`}
                  type="button"
                  onClick={() => navigate(row.detailHref)}
                  className="group relative text-left rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                >
                  {/* Top: cover image */}
                  <div
                    className="relative h-44 w-full overflow-hidden"
                    style={!row.coverUrl ? { background: grad.background } : undefined}
                  >
                    {row.coverUrl && (
                      <img
                        src={row.coverUrl}
                        alt={row.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    {/* gradient fade */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
                    {/* Category tag */}
                    <span
                      className={cn(
                        "absolute top-3 left-3 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm",
                        KIND_TAG_COLOR[row.kind],
                      )}
                    >
                      {KIND_TAG_LABEL[row.kind]}
                    </span>
                  </div>

                  {/* Bottom: content */}
                  <div className="flex-1 flex flex-col p-4 gap-2">
                    <h3 className="font-semibold text-[15px] text-foreground leading-snug line-clamp-2">
                      {row.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {ownerName}
                      {row.subtitle ? ` · ${row.subtitle}` : ""}
                    </p>
                    <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {row.priceLabel || row.metaLabel || row.category || ""}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground group-hover:gap-1.5 transition-all">
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
