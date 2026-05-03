/**
 * HubFlowWidget — compact 3-card teaser surfacing the top of the Flow
 * feed inside Hub. Lives at the top of the Conversations lane and acts
 * as the embedded entry point into the immersive Flow experience.
 *
 * Two interactions:
 *   • "Open Flow" button or any card → navigates to `/flow` (the
 *     fullscreen swipe stack, unchanged).
 *   • The Hub view toggle (?view=flow) also routes through here.
 *
 * Intentionally cheap: pulls 3 items and renders thumbnails. We do NOT
 * embed FlowModePage's swipe state machine — that's a 2K-line page
 * with its own calibration, upload, and idle-hint flow.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Flame, Sparkles, ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadFlowFeed } from "@/lib/flow-feed";
import { Button } from "@/components/ui/button";
import FlowThumbnail from "@/components/flow/FlowThumbnail";

const HubFlowWidget = ({ expanded = false, hideHeading = false }: { expanded?: boolean; hideHeading?: boolean }) => {
  const navigate = useNavigate();

  const { data: items, isLoading } = useQuery({
    queryKey: ["hub-flow-widget", expanded ? "expanded" : "compact"],
    queryFn: async () => {
      // Empty preferences → global feed, sorted by Flow's tier rules.
      const all = await loadFlowFeed(supabase as any, []);
      return all.slice(0, expanded ? 9 : 3);
    },
    staleTime: 60_000,
  });

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-amber-500/5 via-background to-pink-500/5 p-5 md:p-6"
      aria-label="Flow preview"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1 flex items-center gap-1.5">
            <Flame className="h-3 w-3 fill-amber-400/40 text-amber-400" />
            Flow
          </p>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {expanded ? "Tune in." : "Quick tune-in."}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Verified creative IP, ranked. Swipe through one at a time.
          </p>
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => navigate("/flow")}
          className="rounded-full gap-1.5 shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Open Flow
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      <div
        className={`grid gap-3 ${
          expanded
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3"
            : "grid-cols-3"
        }`}
      >
        {isLoading
          ? Array.from({ length: expanded ? 9 : 3 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-muted animate-pulse"
              />
            ))
          : (items ?? []).map((item: any) => {
              const verified =
                (item as any).verification_status === "verified";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate("/flow")}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-border bg-muted text-left transition-transform hover:-translate-y-0.5"
                >
                  <FlowThumbnail
                    fileUrl={item.file_url}
                    linkUrl={item.link_url}
                    title={item.title ?? "Untitled"}
                    description={item.description as string | null}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                    <p className="text-[11px] font-medium text-white truncate">
                      {item.title ?? "Untitled"}
                    </p>
                    {verified && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-300">
                        <Shield className="h-2.5 w-2.5" />
                        Verified
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
      </div>
    </section>
  );
};

export default HubFlowWidget;
