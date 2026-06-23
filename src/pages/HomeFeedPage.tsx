/**
 * HomeFeedPage — `/home`
 *
 * Reverted to the globe + Flow hero the user loved.
 * Studio / "continue building" lives in the Projects tab (`/my-projects`).
 *
 * No tile grids. No thumbnail-heavy cards. Recent activity is a
 * minimal text list so empty cover images don't dominate the screen.
 */

import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import type { RegionMarket } from "@/lib/regions";
import { formatDistanceToNow } from "date-fns";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

// ─── Recent activity (text-only, no thumbnails) ────────────────────────────
type RecentRow = {
  id: string;
  title: string;
  updated_at: string | null;
  user_id: string;
  owner_name: string | null;
};

const RecentActivityList = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["home-recent-projects"],
    staleTime: 30_000,
    queryFn: async (): Promise<RecentRow[]> => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, updated_at, user_id, is_public")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(12);
      const rows = (data ?? []) as any[];
      const ownerIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      let owners: Record<string, string> = {};
      if (ownerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", ownerIds);
        for (const p of (profs ?? []) as any[]) {
          owners[p.id] = p.display_name || p.username || "Anon";
        }
      }
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        updated_at: r.updated_at,
        user_id: r.user_id,
        owner_name: owners[r.user_id] ?? null,
      }));
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-0.5">
            Recent activity
          </p>
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
            What's moving right now
          </h2>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Nothing public yet — check back soon.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
          {data.map((r) => (
            <li key={r.id}>
              <Link
                to={`/projects/${r.id}`}
                className="flex items-baseline justify-between gap-4 px-4 py-3 hover:bg-card/70 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.owner_name ?? "Someone"}
                    {r.updated_at
                      ? ` · updated ${formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}`
                      : ""}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────
const HomeFeedPage = () => {
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-12 space-y-10">
      {/* Globe hero */}
      <section className="space-y-4">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold">
            Featured worldwide
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            A living map of creative work.
          </h1>
        </div>
        <Suspense
          fallback={
            <div className="flex h-[420px] w-full items-center justify-center rounded-[2rem] border border-border/60 bg-card/40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <DiscoverGlobe
            marketFilter={marketFilter}
            onSelectMarket={setMarketFilter}
            featuredSlides={featuredSlides}
            height={420}
          />
        </Suspense>
      </section>

      {/* Flow launcher — prominent, swipeable feed */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Link
          to="/flow"
          className="group relative block overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-6 md:p-7 text-white shadow-[0_30px_80px_-30px_hsl(330_85%_60%/0.6)] hover:-translate-y-0.5 transition-transform"
        >
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/85 font-semibold">
                Swipeable feed
              </p>
              <h2 className="font-display text-xl md:text-2xl font-bold leading-tight inline-flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Open Flow
              </h2>
              <p className="text-sm text-white/90 max-w-md">
                Vertical swipe through fresh work — audio, video, photo. Tap up for the artist, right to keep going.
              </p>
            </div>
            <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </motion.div>

      {/* Recent activity — text list, no thumbnails */}
      <RecentActivityList />
    </div>
  );
};

export default HomeFeedPage;
