import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Globe2, Loader2, Play, Radio } from "lucide-react";
import FlowModePage from "@/pages/FlowModePage";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { RegionMarket } from "@/lib/regions";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

type HomeMode = "globe" | "flow" | "live";

const MODES: { id: HomeMode; label: string; icon: typeof Globe2 }[] = [
  { id: "globe", label: "Discover", icon: Globe2 },
  { id: "flow", label: "Flow", icon: Play },
  { id: "live", label: "Live", icon: Radio },
];

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
        .limit(12);
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

  if (!projects.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nothing live right now. Check back soon.
      </p>
    );
  }

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

const LiveActivityPanel = () => (
  <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
    <header className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Live activity</p>
      <h2 className="font-display text-2xl font-bold text-foreground">What's moving</h2>
      <p className="text-sm text-muted-foreground">
        Releases shipping in public, projects you back, and updates from your studio pass.
      </p>
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <Link
        to="/projects"
        className="rounded-2xl border border-border/60 bg-card/40 p-4 transition hover:border-foreground/30 hover:bg-card/70"
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Studio</p>
        <p className="mt-1 font-display text-sm font-semibold">Your projects</p>
      </Link>
      <Link
        to="/credits"
        className="rounded-2xl border border-border/60 bg-card/40 p-4 transition hover:border-foreground/30 hover:bg-card/70"
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Pass</p>
        <p className="mt-1 font-display text-sm font-semibold">Creator Pass</p>
      </Link>
      <Link
        to="/messages"
        className="rounded-2xl border border-border/60 bg-card/40 p-4 transition hover:border-foreground/30 hover:bg-card/70"
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Inbox</p>
        <p className="mt-1 font-display text-sm font-semibold">Conversations</p>
      </Link>
    </div>

    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Recent releases</p>
      <RecentActivityList />
    </div>
  </div>
);

const HomeFeedPage = () => {
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const [mode, setMode] = useState<HomeMode>("globe");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);

  const swipeTo = (dir: 1 | -1) => {
    const idx = MODES.findIndex((m) => m.id === mode);
    const next = (idx + dir + MODES.length) % MODES.length;
    setMode(MODES[next].id);
  };

  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-background pb-28">
      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) swipeTo(1);
                else if (info.offset.x > 80) swipeTo(-1);
              }}
              className="overflow-hidden rounded-[2rem] border border-border/50 bg-card/30 shadow-[0_24px_80px_-48px_hsl(var(--foreground)/0.35)]"
            >
              {mode === "globe" && (
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
                    height={620}
                  />
                </Suspense>
              )}

              {mode === "flow" && (
                <div className="h-[calc(100vh-220px)] min-h-[560px]">
                  <FlowModePage embedded />
                </div>
              )}

              {mode === "live" && <LiveActivityPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Docking menu */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1.5 shadow-[0_24px_60px_-24px_hsl(var(--foreground)/0.4)] backdrop-blur-xl">
          {MODES.map((m) => {
            const active = mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                aria-label={m.label}
                aria-pressed={active}
                className={cn(
                  "relative flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium uppercase tracking-[0.16em] transition-colors",
                  active ? "text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="home-dock-active"
                    className="absolute inset-0 rounded-full bg-foreground"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10 hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
};

export default HomeFeedPage;
