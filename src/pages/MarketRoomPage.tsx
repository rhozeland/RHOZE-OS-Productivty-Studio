import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, LayoutGrid, ChevronDown, Plus } from "lucide-react";
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
 * v11 Pillar 8: 3 filters — All · Creators · Projects.
 * The header has ONE primary CTA: "Start a Project" → opens the listing
 * intake (PostMenuButton intent="listing"), which is the single front door
 * to authoring work, collabs, or open calls. Posting events / spaces still
 * lives on their dedicated create pages — Connect is a discovery + start
 * surface only.
 */

type FilterKey = "all" | "hire" | "projects";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "hire",     label: "Creators" },
  { key: "projects", label: "Projects" },
];

const URL_TO_FILTER: Record<string, FilterKey> = {
  hire: "hire", creator: "hire", creators: "hire",
  space: "projects", spaces: "projects",
  call: "projects", calls: "projects",
  listing: "projects", listings: "projects",
  project: "projects", projects: "projects",
  event: "projects", events: "projects", live: "projects",
  all: "all", foryou: "all",
};

// Map our UI filter to the underlying ConnectBoard kind. "Projects" still
// rides the listings rows (open calls + service offers) under the hood —
// we just renamed the chip.
const FILTER_TO_BOARD: Record<FilterKey, BoardKind> = {
  all: "all",
  hire: "hire",
  projects: "listings",
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

      {/* Filter chips + single "Start a Project" CTA on the right */}
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
          intent="listing"
          trigger={
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 sm:px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Start a Project</span>
              <span className="sm:hidden">Start</span>
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

      <ConnectBoard kind={FILTER_TO_BOARD[filter]} search={search} />
    </div>
  );
};

export default MarketRoomPage;
