/**
 * FreshWorksGrid — infinite-scroll Fresh works tile grid for Discover.
 *
 * Page 1 prioritizes verified IP first (then anchored, then recent) so the
 * provenance story is visible above the fold. Subsequent pages are pure
 * chronological by `created_at` so the cursor stays stable.
 */
import { useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";

const PAGE_SIZE = 16;

const FreshWorksGrid = () => {
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey: ["discover-fresh-works-infinite"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("flow_items")
        .select("id, title, description, file_url, link_url, category, content_type, verification_status, work_id, user_id, creator_name, solana_signature, created_at")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data } = await q;
      const list = data ?? [];
      // First page only: verified-IP-first ordering.
      if (!pageParam) {
        const order = (s?: string | null) =>
          s === "verified" ? 0 : s === "pending" ? 1 : s === "fingerprinted" ? 2 : 3;
        list.sort((a: any, b: any) => order(a.verification_status) - order(b.verification_status));
      }
      return list;
    },
    getNextPageParam: (last) => (last.length === PAGE_SIZE ? last[last.length - 1].created_at : undefined),
  });

  // IntersectionObserver sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { rootMargin: "300px" });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const works = data?.pages.flat() ?? [];

  if (isLoading) {
    return (
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (works.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5" /> Fresh works
        </h2>
        <Link to="/flow" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Open Flow <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {works.map((w: any) => {
          const isVideo = w.file_url && (w.category === "video" || w.content_type === "video");
          return (
            <button
              key={w.id}
              onClick={() => navigate(`/profiles/${w.user_id}?tab=works`)}
              className="group text-left rounded-xl border border-border/60 bg-card overflow-hidden hover:border-foreground/30 transition-colors"
            >
              <div className="aspect-square bg-muted overflow-hidden">
                {isVideo ? (
                  <video src={w.file_url} className="h-full w-full object-cover" muted preload="metadata" />
                ) : (
                  <FlowThumbnail
                    fileUrl={w.file_url}
                    linkUrl={w.link_url}
                    title={w.title || "Untitled"}
                    description={w.description}
                    category={w.category}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground truncate">{w.title || "Untitled"}</p>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-muted-foreground truncate">{w.creator_name ?? "—"}</span>
                  {w.solana_signature && <VerifiedIPBadge signature={w.solana_signature} size="xs" showLabel={false} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sentinel + loading indicator */}
      <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more…
          </div>
        )}
        {!hasNextPage && works.length > PAGE_SIZE && (
          <p className="text-[11px] text-muted-foreground/60">You're all caught up.</p>
        )}
      </div>
    </section>
  );
};

export default FreshWorksGrid;
