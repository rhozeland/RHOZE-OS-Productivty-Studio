/**
 * ConnectBoard — unified compact split-pane browser.
 *
 * Single reusable component used by:
 *   • /market (Connect) — kind cycling via parent
 *   • /discover Stream — Events/Spaces/Listings tabs
 *
 * Layout matches the agreed pattern (per Listings screenshot):
 *   - Hero preview card for the selected row at the top
 *     (no giant cover image — thin gradient strip + chips + title + by + CTAs)
 *   - Compact vertical list rows below: 48×48 thumb + title + tag chips
 *
 * All four kinds (hire / call / event / space) ride on the existing
 * useConnectRows hooks; "all" interleaves them.
 *
 * CTAs:
 *   - Start a project from this — primes sessionStorage.newProjectPrefill
 *     and routes to /messages?tab=projects&new=1 (works for any kind).
 *   - Message — DM the owner.
 *   - Full page — row.detailHref.
 *   - Save (listings + hire only).
 */
import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Plus,
  Search as SearchIcon,
  Sparkles,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import SaveButton from "@/components/saved/SaveButton";
import {
  useHireRows,
  useCallRows,
  useEventRows,
  useSpaceRows,
  type ConnectKind,
  type ConnectRow,
} from "@/components/connect/useConnectRows";
import DiscoverTable from "@/components/discover/DiscoverTable";

export type BoardKind = ConnectKind | "all" | "listings";

const KIND_CHIP: Record<ConnectKind, { label: string; cls: string; Icon: typeof Users }> = {
  hire:  { label: "Creator", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300", Icon: Users },
  call:  { label: "Listing", cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300", Icon: Briefcase },
  event: { label: "Event",   cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300", Icon: CalendarDays },
  space: { label: "Space",   cls: "bg-teal-500/10 text-teal-700 dark:text-teal-300", Icon: Building2 },
};

const EMPTY_COPY: Record<BoardKind, { title: string; description: string }> = {
  all:      { title: "Nothing here yet", description: "Be the first to post a listing, event, or space." },
  hire:     { title: "No creators available", description: "Verified creators show up here as they sign up." },
  call:     { title: "No listings yet", description: "Listings are how creators announce work, collabs, and briefs." },
  listings: { title: "No listings yet", description: "Spaces to book, events to attend, and open calls all live here." },
  event:    { title: "No upcoming events", description: "Be the first to host — Rhozeland surfaces your event the moment it's published." },
  space:    { title: "No spaces yet", description: "Studios, venues, and shared rooms hosted by creators land here." },
};


interface Props {
  kind: BoardKind;
  search?: string;
}

type ProjectSeed = {
  title: string;
  listingId?: string;
  collaboratorId?: string | null;
  scope?: string | null;
  sourceKind: ConnectKind;
  sourceId: string;
};

const stashProjectSeed = (seed: ProjectSeed) => {
  try {
    sessionStorage.setItem("newProjectPrefill", JSON.stringify(seed));
  } catch {
    // no-op
  }
};

const ConnectBoard = ({ kind, search = "" }: Props) => {
  const navigate = useNavigate();

  const hire = useHireRows(kind === "all" || kind === "hire");
  const calls = useCallRows(kind === "all" || kind === "call");
  const events = useEventRows(kind === "all" || kind === "event");
  const spaces = useSpaceRows(kind === "all" || kind === "space");

  const rows: ConnectRow[] = useMemo(() => {
    const pick: ConnectRow[][] = [];
    if (kind === "all" || kind === "hire") pick.push(hire.data ?? []);
    if (kind === "all" || kind === "call") pick.push(calls.data ?? []);
    if (kind === "all" || kind === "event") pick.push(events.data ?? []);
    if (kind === "all" || kind === "space") pick.push(spaces.data ?? []);
    if (kind === "all") return interleave(pick);
    return pick.flat();
  }, [kind, hire.data, calls.data, events.data, spaces.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subtitle || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q) ||
        (r.ownerName || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const isLoading =
    (kind === "hire"  && hire.isLoading) ||
    (kind === "call"  && calls.isLoading) ||
    (kind === "event" && events.isLoading) ||
    (kind === "space" && spaces.isLoading) ||
    (kind === "all"   && hire.isLoading && calls.isLoading && events.isLoading && spaces.isLoading);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Reset selection when the data set changes (filter/kind switch).
  useEffect(() => { setSelectedId(null); }, [kind]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const handleStartProject = (r: ConnectRow) => {
    stashProjectSeed({
      title: r.title,
      listingId: r.kind === "call" ? r.id : undefined,
      collaboratorId: r.ownerId,
      scope: r.description ?? null,
      sourceKind: r.kind,
      sourceId: r.id,
    });
    navigate(`/messages?tab=projects&new=1&source=${r.kind}`);
  };

  return (
    <div className="space-y-4">
      {/* Hero preview of selected row */}
      {selected ? (
        <HeroPreview row={selected} onStartProject={handleStartProject} />
      ) : !isLoading ? (
        <EmptyState
          icon={SearchIcon}
          title={EMPTY_COPY[kind].title}
          description={EMPTY_COPY[kind].description}
          size="md"
        />
      ) : null}

      {/* Compact list */}
      <div className="space-y-1.5">
        {isLoading && (
          <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
        )}
        {filtered.map((r) => {
          const meta = KIND_CHIP[r.kind];
          const Icon = meta.Icon;
          const active = selected?.id === r.id;
          return (
            <button
              key={`${r.kind}-${r.id}`}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "w-full text-left rounded-2xl border bg-card/50 px-3 py-2.5 transition-all hover:bg-card hover:border-foreground/30",
                active && "border-foreground/60 bg-card shadow-sm ring-1 ring-foreground/10",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0 h-11 w-11 rounded-lg overflow-hidden bg-muted">
                  {r.coverUrl ? (
                    <img src={r.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className={cn("w-full h-full flex items-center justify-center", meta.cls)}>
                      <Icon className="h-4 w-4 opacity-60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
                    {r.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium", meta.cls)}>
                      <Icon className="h-2.5 w-2.5" /> {meta.label}
                    </span>
                    {r.category && (
                      <span className="text-muted-foreground capitalize">{r.category}</span>
                    )}
                    {r.metaLabel && r.metaLabel !== r.category && (
                      <span className="text-muted-foreground/70 inline-flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {r.metaLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const HeroPreview = ({
  row,
  onStartProject,
}: {
  row: ConnectRow;
  onStartProject: (r: ConnectRow) => void;
}) => {
  const navigate = useNavigate();
  const meta = KIND_CHIP[row.kind];
  const Icon = meta.Icon;
  const ownerName = row.ownerName || "Creator";

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70">
      {/* Slim gradient strip — keeps the hero light, no giant cover */}
      <div className="h-1.5 bg-gradient-to-r from-rose-300 via-violet-300 to-sky-300" />

      <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
        {/* Chips */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Badge variant="secondary" className={cn("gap-1 text-[10px]", meta.cls)}>
            <Icon className="h-3 w-3" /> {meta.label}
          </Badge>
          {row.category && (
            <Badge variant="outline" className="text-[10px] capitalize">{row.category}</Badge>
          )}
          {row.priceLabel && (
            <span className="text-[11px] text-muted-foreground">{row.priceLabel}</span>
          )}
          {row.kind === "event" && row.metaLabel && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" /> {row.metaLabel}
            </span>
          )}
          {row.kind === "space" && row.subtitle && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-full">
              <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{row.subtitle}</span>
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="font-display text-xl sm:text-3xl font-semibold tracking-tight leading-tight text-foreground break-words">
          {row.title}
        </h2>

        {/* Owner */}
        {row.ownerId && (
          <Link
            to={`/profiles/${row.ownerId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={row.ownerAvatar || ""} />
              <AvatarFallback className="text-[10px]">{ownerName.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate">by <span className="font-medium text-foreground">{ownerName}</span></span>
          </Link>
        )}

        {/* CTAs — stack on mobile, inline on sm+ */}
        <div className="border-t border-border/60 pt-3 sm:pt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <Button
            onClick={() => onStartProject(row)}
            className="gap-1.5 w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" /> Start a project from this
          </Button>
          <div className="flex items-center gap-2 sm:contents">
            {row.ownerId && (
              <Button
                variant="outline"
                onClick={() => navigate(`/messages?with=${row.ownerId}&${row.kind}=${row.id}`)}
                className="gap-1.5 flex-1 sm:flex-none justify-center"
              >
                <MessageCircle className="h-4 w-4" /> Message
              </Button>
            )}
            <Button variant="ghost" asChild className="gap-1.5 flex-1 sm:flex-none justify-center">
              <Link to={row.detailHref}>
                Full page <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {(row.kind === "call" || row.kind === "hire") && (
              <div className="sm:ml-auto shrink-0">
                <SaveButton type="listing" id={row.id} size="sm" />
              </div>
            )}
          </div>
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

export default ConnectBoard;
