import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, LayoutGrid, ChevronDown, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import RoomHero from "@/components/rooms/RoomHero";
import PostMenuButton from "@/components/PostMenuButton";
import ConnectBoard, { type BoardKind } from "@/components/connect/ConnectBoard";

/**
 * CONNECT — `/market`
 *
 * v11 Pillar 7 (refresh): a single compact split-pane board.
 * Five filters — All · Creators · Listings · Events · Spaces — all share the
 * same hero-preview-plus-compact-list layout, and every row can "Start a
 * project from this." No more giant tile grids, no more token lanes.
 */

type FilterKey = "all" | "hire" | "call" | "event" | "space";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",   label: "All" },
  { key: "hire",  label: "Creators" },
  { key: "call",  label: "Listings" },
  { key: "event", label: "Events" },
  { key: "space", label: "Spaces" },
];

const URL_TO_FILTER: Record<string, FilterKey> = {
  hire: "hire", creator: "hire", creators: "hire",
  space: "space", spaces: "space",
  call: "call", calls: "call", listing: "call", listings: "call",
  event: "event", events: "event", live: "event",
  all: "all", foryou: "all",
};

const MarketRoomPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = URL_TO_FILTER[(searchParams.get("kind") || "").toLowerCase()];
  const [filter, setFilter] = useState<FilterKey>(urlFilter ?? "all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (urlFilter && urlFilter !== filter) setFilter(urlFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter]);

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

      {/* Filter chips + Post on the right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 min-w-0 flex-1">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            const Icon = key === "all" ? LayoutGrid : null;
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

      {/* Search + sort */}
      <div className="space-y-3">
        <div className="relative rounded-2xl border border-border bg-card/60 overflow-hidden">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="What are you looking for?"
            className="pl-11 h-12 border-0 rounded-none focus-visible:ring-0 bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{FILTERS.find((f) => f.key === filter)?.label}</span>
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
      </div>

      <ConnectBoard kind={filter as BoardKind} search={search} />
    </div>
  );
};

export default MarketRoomPage;
