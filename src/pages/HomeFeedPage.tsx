/**
 * HomeFeedPage — `/home` (v12 — project-first)
 *
 * Two stacked zones:
 *   1. Your Studio (signed-in only) — continue working + invites strip
 *   2. Live Projects feed — recent activity across the network
 *
 * Tile grids (artists/spaces/events/opportunities) are gone. Discover is
 * folded into here. /discover and /charts both redirect to /home.
 */

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ActiveProjectsLane from "@/components/discover/ActiveProjectsLane";

// ─────────────────────────────────────────────────────────────────────────────
// Studio strip — your active projects + Start new
// ─────────────────────────────────────────────────────────────────────────────
type MyProject = {
  id: string;
  title: string;
  cover_color: string | null;
  cover_image_url: string | null;
  is_public: boolean | null;
  updated_at: string | null;
};

const StudioStrip = ({ userId }: { userId: string }) => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["home-my-projects", userId],
    staleTime: 30_000,
    queryFn: async (): Promise<MyProject[]> => {
      // Projects you own
      const ownedRes = await supabase
        .from("projects")
        .select("id, title, cover_color, cover_image_url, is_public, updated_at, user_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(6);
      const owned = (ownedRes.data ?? []) as any[];

      // Projects you collab on
      const collabRes = await (supabase as any)
        .from("project_collaborators")
        .select("project_id")
        .eq("user_id", userId);
      const collabIds = ((collabRes.data ?? []) as any[]).map((c) => c.project_id);
      const extraIds = collabIds.filter((id) => !owned.find((o) => o.id === id));

      let extras: any[] = [];
      if (extraIds.length) {
        const r = await supabase
          .from("projects")
          .select("id, title, cover_color, cover_image_url, is_public, updated_at")
          .in("id", extraIds as string[])
          .order("updated_at", { ascending: false })
          .limit(6);
        extras = r.data ?? [];
      }

      return [...owned, ...extras]
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
        .slice(0, 8);
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-0.5">
            Your studio
          </p>
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
            Continue building
          </h2>
        </div>
        <Link
          to="/projects"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          All projects <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1 snap-x">
        {/* Start a project — always first */}
        <Link
          to="/projects?new=1"
          className="snap-start shrink-0 w-[180px] h-[140px] rounded-2xl border-2 border-dashed border-border/70 hover:border-foreground/40 bg-card/30 hover:bg-card/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <div className="h-10 w-10 rounded-full bg-foreground text-background grid place-items-center">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold">Start a project</span>
        </Link>

        {isLoading && (
          <div className="grid place-items-center w-[180px] h-[140px] rounded-2xl border border-border/60 bg-card/40">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && data.length === 0 && (
          <div className="grid place-items-center w-[260px] h-[140px] rounded-2xl border border-border/60 bg-card/40 px-4 text-center">
            <p className="text-xs text-muted-foreground leading-snug">
              No projects yet. Spin one up to start documenting your work in public.
            </p>
          </div>
        )}

        {data.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="snap-start shrink-0 group w-[180px] h-[140px] rounded-2xl overflow-hidden border border-border/60 bg-card relative hover:-translate-y-0.5 hover:shadow-xl transition-all"
            style={
              p.cover_image_url
                ? undefined
                : {
                    backgroundImage: `linear-gradient(135deg, ${p.cover_color ?? "hsl(292 84% 61%)"}, hsl(330 85% 60%))`,
                  }
            }
          >
            {p.cover_image_url && (
              <img
                src={p.cover_image_url}
                alt={p.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
              <p className="text-xs font-bold text-white line-clamp-2 leading-tight drop-shadow">
                {p.title}
              </p>
              {p.is_public && (
                <span className="mt-1 inline-block text-[9px] uppercase tracking-wider font-bold text-emerald-300">
                  Public
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Guest hero — sign in to start a project
// ─────────────────────────────────────────────────────────────────────────────
const GuestBanner = () => (
  <motion.section
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-6 md:p-8 text-white shadow-[0_30px_80px_-30px_hsl(330_85%_60%/0.6)]"
  >
    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/80 font-semibold">
          Build in public
        </p>
        <h2 className="font-display text-2xl md:text-3xl font-bold leading-tight">
          Watch projects come to life — or start your own.
        </h2>
        <p className="text-sm text-white/85 max-w-md">
          Artists open projects, collaborators jump in, supporters back the work as it ships.
        </p>
      </div>
      <Link
        to="/auth"
        className="self-start md:self-auto inline-flex items-center gap-1.5 rounded-full bg-white text-foreground px-4 py-2 text-sm font-semibold shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-transform"
      >
        Sign in to start <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  </motion.section>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
const HomeFeedPage = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3 pb-12 space-y-8">
      {/* 1. Studio strip (auth only) or guest banner */}
      {user ? <StudioStrip userId={user.id} /> : <GuestBanner />}

      {/* 2. Live Projects feed — public projects, sorted by activity */}
      <ActiveProjectsLane limit={30} eyebrow="Live across Rhozeland" title="Projects in the open" />

      {/* 3. Quiet Flow launcher (small, end of page) */}
      <Link
        to="/flow"
        className="group relative block overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-5 text-white shadow-md hover:-translate-y-0.5 transition-transform"
      >
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/80 font-semibold">
              Swipeable feed
            </p>
            <h3 className="font-display text-lg md:text-xl leading-tight inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Open Flow
            </h3>
          </div>
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>
    </div>
  );
};

export default HomeFeedPage;
