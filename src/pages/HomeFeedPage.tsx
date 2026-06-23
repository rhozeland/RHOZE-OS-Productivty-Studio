import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Loader2 } from "lucide-react";
import FlowModePage from "@/pages/FlowModePage";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import { supabase } from "@/integrations/supabase/client";
import type { RegionMarket } from "@/lib/regions";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

type ActivityProject = {
  id: string;
  title: string | null;
  vision: string | null;
  updated_at: string | null;
  public_slug: string | null;
  user_id: string | null;
  ownerName?: string | null;
};

const RecentActivityList = () => {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["home-recent-public-projects"],
    staleTime: 60_000,
    queryFn: async (): Promise<ActivityProject[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,vision,updated_at,public_slug,user_id")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(8);
      if (error) throw error;

      const rows = (data ?? []) as ActivityProject[];
      const ownerIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))) as string[];
      if (!ownerIds.length) return rows;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,display_name,username")
        .in("user_id", ownerIds);
      const profileById = new Map(
        (profiles ?? []).map((profile) => [
          profile.user_id,
          profile.display_name || profile.username || null,
        ]),
      );

      return rows.map((row) => ({
        ...row,
        ownerName: row.user_id ? profileById.get(row.user_id) ?? null : null,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!projects.length) return null;

  return (
    <div className="divide-y divide-border/50">
      {projects.map((project) => {
        const owner = project.ownerName || "Rhozeland";
        const href = project.public_slug ? `/release/${project.public_slug}` : `/projects/${project.id}`;
        return (
          <Link
            key={project.id}
            to={href}
            className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-muted/30 sm:px-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <span>{owner}</span>
                {project.updated_at && (
                  <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
                )}
              </div>
              <p className="truncate font-display text-base font-semibold text-foreground">
                {project.title || "Untitled release"}
              </p>
              {project.vision && (
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {project.vision}
                </p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
          </Link>
        );
      })}
    </div>
  );
};

const HomeFeedPage = () => {
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <section className="px-4 pb-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="overflow-hidden rounded-[2rem] border border-border/50 bg-card/30 shadow-[0_24px_80px_-48px_hsl(var(--foreground)/0.35)]"
          >
            <Suspense
              fallback={
                <div className="flex h-[560px] w-full items-center justify-center bg-card/40">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <DiscoverGlobe
                marketFilter={marketFilter}
                onSelectMarket={setMarketFilter}
                featuredSlides={featuredSlides}
                height={560}
              />
            </Suspense>
          </motion.div>
        </div>
      </section>

      <section className="px-0 pb-0 sm:px-4 lg:px-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-t-[2rem] border-x border-t border-border/40 bg-background/80 shadow-[0_-24px_80px_-56px_hsl(var(--foreground)/0.45)]">
          <div className="h-[calc(100vh-520px)] min-h-[560px]">
            <FlowModePage embedded />
          </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Live activity</p>
              <h2 className="font-display text-xl font-bold text-foreground">Recent releases</h2>
            </div>
          </div>
          <RecentActivityList />
        </div>
      </section>
    </main>
  );
};

export default HomeFeedPage;
