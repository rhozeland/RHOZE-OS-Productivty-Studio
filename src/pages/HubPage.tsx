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
 * URL: ?q=... pre-fills search.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import StreamComposer from "@/components/stream/StreamComposer";
import HubFlowWidget from "@/components/hub/HubFlowWidget";
import ConversationsMosaic from "@/components/hub/ConversationsMosaic";

const HubPage = () => {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  // Keep ?q= in sync so the search survives refresh + share.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
              placeholder="Search the Stream…"
              className="pl-10 h-10 rounded-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ConversationsMosaic search={search} />
      </section>
    </div>
  );
};

export default HubPage;
