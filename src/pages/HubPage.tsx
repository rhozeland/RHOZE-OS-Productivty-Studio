/**
 * HubPage — Rhozeland's unified Stream.
 *
 * v7 phase 5 simplification:
 *   - No more Tile/Flow toggle (Flow lives at /flow + as a teaser widget).
 *   - No more lane tabs (Conversations/Offerings/Opportunities/Works).
 *   - The composer moves to the TOP — drop anything inline.
 *   - Below it: a mixed "Conversations" mosaic of every kind of activity
 *     happening across the network — drops, offerings, open calls,
 *     events, spaces, verified works.
 *   - Flow widget stays as an embedded teaser into /flow.
 *
 * URL state:
 *   ?q=...     — search query
 *   ?kind=...  — type filter (all|drop|offering|opportunity|event|space|work)
 *
 * Both survive refresh + share.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  X,
  Layers,
  Flame,
  Briefcase,
  Megaphone,
  CalendarDays,
  Building2,
  Shield,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import StreamComposer from "@/components/stream/StreamComposer";
import HubFlowWidget from "@/components/hub/HubFlowWidget";
import ConversationsMosaic, { type MosaicKindFilter } from "@/components/hub/ConversationsMosaic";

// Filter chips. Order = how readers scan: "All" first, then content
// kinds in roughly creation-frequency order.
const FILTERS: { key: MosaicKindFilter; label: string; Icon: typeof Flame }[] = [
  { key: "all",         label: "All",        Icon: Layers },
  { key: "drop",        label: "Drops",      Icon: Flame },
  { key: "offering",    label: "Offerings",  Icon: Briefcase },
  { key: "opportunity", label: "Open Calls", Icon: Megaphone },
  { key: "event",       label: "Events",     Icon: CalendarDays },
  { key: "space",       label: "Spaces",     Icon: Building2 },
  { key: "work",        label: "Works",      Icon: Shield },
];

const VALID_KINDS = new Set<MosaicKindFilter>(FILTERS.map((f) => f.key));

const HubPage = () => {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const initialKind = (params.get("kind") as MosaicKindFilter) ?? "all";
  const [kind, setKind] = useState<MosaicKindFilter>(
    VALID_KINDS.has(initialKind) ? initialKind : "all",
  );
  const [counts, setCounts] = useState<Record<MosaicKindFilter, number> | null>(null);

  // Keep ?q= and ?kind= in sync so URL = source of truth for sharing.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    if (kind && kind !== "all") next.set("kind", kind);
    else next.delete("kind");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kind]);

  // Listen for the mosaic's count broadcasts so chips can show live tallies.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<MosaicKindFilter, number>;
      setCounts(detail);
    };
    window.addEventListener("hub-mosaic-counts", handler);
    return () => window.removeEventListener("hub-mosaic-counts", handler);
  }, []);

  const activeFilter = useMemo(() => FILTERS.find((f) => f.key === kind)!, [kind]);
  const hasFilter = kind !== "all" || search.trim().length > 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-pink-500/5 via-background to-amber-500/5 p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(320_80%_60%/0.15),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_85%,hsl(30_90%_55%/0.12),transparent_55%)] pointer-events-none" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">
            The Stream
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground tracking-tight">
            What&rsquo;s happening.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-md">
            Drops, offerings, calls, events, spaces, works — one feed.
          </p>
        </div>
      </header>

      {/* ─── Composer (the new top-of-page Drop surface) ───────────────── */}
      <StreamComposer defaultType="text" />

      {/* ─── Embedded Flow teaser (3-card widget into /flow) ───────────── */}
      <HubFlowWidget />

      {/* ─── Conversations mosaic — mixed feed of every activity type ── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1">
              Conversations
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              Everything, in one breath.
            </h2>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeFilter.label.toLowerCase()}…`}
              className="pl-10 pr-9 h-10 rounded-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips — horizontally scrollable on small screens */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {FILTERS.map((f) => {
            const FIcon = f.Icon;
            const active = kind === f.key;
            const count = counts?.[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setKind(f.key)}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <FIcon className="h-3 w-3" />
                {f.label}
                {typeof count === "number" && count > 0 && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold tabular-nums ${
                      active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setKind("all");
                setSearch("");
              }}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground ml-1 px-2 py-1 transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <ConversationsMosaic search={search} kind={kind} />
      </section>
    </div>
  );
};

export default HubPage;
