import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "@/components/connect/useConnectRows";

/**
 * CONNECT — Room 2.
 *
 * v9.8: detail preview pane removed (rows now navigate straight to detail),
 * filter chips moved into the search shell as tabs, search placeholder
 * neutralized ("What are you looking for?"), and ?kind= URL param honored
 * so legacy /spaces and /events redirects land on the right tab.
 */

const KIND_ORDER: ConnectKind[] = ["hire", "space", "call", "event"];

const URL_TO_KIND: Record<string, ConnectKind> = {
  hire: "hire",
  space: "space",
  spaces: "space",
  call: "call",
  calls: "call",
  event: "event",
  events: "event",
};

const MarketRoomPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlKind = URL_TO_KIND[(searchParams.get("kind") || "").toLowerCase()];
  const [kind, setKind] = useState<ConnectKind>(urlKind ?? "hire");
  const [search, setSearch] = useState("");

  // React to URL changes (legacy /spaces /events redirects).
  useEffect(() => {
    if (urlKind && urlKind !== kind) setKind(urlKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKind]);

  const hire = useHireRows(kind === "hire");
  const spaces = useSpaceRows(kind === "space");
  const calls = useCallRows(kind === "call");
  const events = useEventRows(kind === "event");

  const query =
    kind === "hire" ? hire : kind === "space" ? spaces : kind === "call" ? calls : events;
  const rows = query.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subtitle || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const Heading = KIND_META[kind];

  const handleKindChange = (next: ConnectKind) => {
    setKind(next);
    // Reflect in URL so refresh/back works, but keep it clean.
    const params = new URLSearchParams(searchParams);
    if (next === "hire") params.delete("kind");
    else params.set("kind", next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-6">
      <RoomHero variant="connect" eyebrow="Connect" title="Find your next collaborator." />

      {/* Matchmaking HUD — swipeable deck (Post lives in its header) */}
      <ConnectMatchDeck />

      {/* Combined tabs + search shell */}
      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-2 pt-2">
          {KIND_ORDER.map((key) => {
            const { label, Icon } = KIND_META[key];
            const active = kind === key;
            return (
              <button
                key={key}
                onClick={() => handleKindChange(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors -mb-px",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="What are you looking for?"
            className="pl-11 h-12 border-0 rounded-none focus-visible:ring-0 bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Results — full width list, clicking navigates to detail */}
      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{filtered.length} results</span>
          <span className="hidden sm:inline">{Heading.desc}</span>
        </div>
        <div className="divide-y divide-border/50">
          {query.isLoading && (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
              ))}
            </div>
          )}
          {!query.isLoading && filtered.length === 0 && (
            <div className="p-10 text-center">
              <Heading.Icon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No {Heading.label.toLowerCase()} yet.</p>
            </div>
          )}
          {filtered.map((row) => {
            const grad = avatarGradientFor(row.ownerId || row.id);
            return (
              <button
                key={row.id}
                onClick={() => navigate(row.detailHref)}
                className="w-full text-left px-4 py-3 transition-colors flex items-start gap-3 hover:bg-muted/40"
              >
                <div
                  className="shrink-0 h-10 w-10 rounded-lg overflow-hidden ring-1 ring-border/60"
                  style={{ background: grad.background }}
                >
                  {row.ownerAvatar ? (
                    <img src={row.ownerAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Heading.Icon className="h-4 w-4 text-foreground/70 m-auto mt-3" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">
                      {row.title}
                    </h3>
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
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MarketRoomPage;
