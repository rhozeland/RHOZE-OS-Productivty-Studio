import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Flame, Globe2, Loader2, MessageSquare, Play, Radio, Sparkles } from "lucide-react";
import FlowModePage from "@/pages/FlowModePage";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorXP } from "@/hooks/useCreatorXP";
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

// ============================================================================
// Pass card — gradient hero showing the user's Creator Pass rank + progress.
// ============================================================================
const PassHeroCard = () => {
  const { user } = useAuth();
  const { data: xp } = useCreatorXP();

  if (!user) {
    return (
      <Link
        to="/auth"
        className="relative block overflow-hidden rounded-3xl border border-border/60 p-6 transition hover:border-foreground/30"
        style={{
          background:
            "linear-gradient(135deg, hsl(330 80% 60% / 0.18), hsl(280 70% 55% / 0.12) 45%, hsl(38 90% 60% / 0.18))",
        }}
      >
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Creator Pass</p>
        <p className="mt-1 font-display text-2xl font-bold">Start your pass</p>
        <p className="mt-1 text-sm text-muted-foreground">Earn XP, level up, unlock perks.</p>
      </Link>
    );
  }

  const tierColor = xp?.titleColor ?? "210 60% 55%";
  const level = xp?.level ?? 1;
  const title = xp?.title ?? "Newcomer";
  const totalXP = xp?.totalXP ?? 0;
  const nextLevelXP = xp?.nextLevelXP ?? 20;
  const progressPct = xp?.progressPct ?? 0;
  const streak = xp?.streak ?? 0;

  return (
    <Link
      to="/credits"
      className="group relative block overflow-hidden rounded-3xl border border-border/60 p-6 transition hover:border-foreground/30"
      style={{
        background: `
          radial-gradient(circle at 0% 0%, hsl(${tierColor} / 0.35), transparent 55%),
          radial-gradient(circle at 100% 100%, hsl(330 80% 60% / 0.22), transparent 55%),
          linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)/0.7) 100%)
        `,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Creator Pass</p>
          <p className="mt-1 font-display text-2xl font-bold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground">Level {level}</p>
        </div>
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, hsl(${tierColor}), hsl(${tierColor} / 0.6))`,
            boxShadow: `0 8px 24px -8px hsl(${tierColor} / 0.6)`,
          }}
        >
          {level}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{totalXP} XP</span>
          <span>{nextLevelXP} XP</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, hsl(${tierColor}), hsl(${tierColor} / 0.5))`,
              boxShadow: `0 0 8px hsl(${tierColor} / 0.6)`,
            }}
          />
        </div>
      </div>

      {streak > 0 && (
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--orange)/0.3)] bg-[hsl(var(--orange)/0.1)] px-2.5 py-1">
          <Flame className="h-3 w-3" style={{ color: "hsl(var(--orange))" }} />
          <span className="text-[10px] font-bold tabular-nums" style={{ color: "hsl(var(--orange))" }}>
            {streak}d streak
          </span>
        </div>
      )}
    </Link>
  );
};

// ============================================================================
// Recent messages — last 5 DMs into the user's inbox with sender names.
// ============================================================================
type RecentMessage = {
  id: string;
  sender_id: string | null;
  body: string | null;
  created_at: string | null;
  read: boolean | null;
  senderName?: string | null;
};

const RecentMessagesCard = () => {
  const { user } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["home-recent-messages", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<RecentMessage[]> => {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("messages")
        .select("id,sender_id,body,created_at,read")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      const msgs = (data ?? []) as RecentMessage[];
      const ids = Array.from(new Set(msgs.map((m) => m.sender_id).filter(Boolean))) as string[];
      if (!ids.length) return msgs;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,display_name,username")
        .in("user_id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name || p.username]));
      return msgs.map((m) => ({ ...m, senderName: m.sender_id ? byId.get(m.sender_id) ?? null : null }));
    },
  });

  return (
    <div className="rounded-3xl border border-border/60 bg-card/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-sm font-semibold">Inbox</h3>
        </div>
        <Link to="/messages" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
          Open
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : !user || !rows.length ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li key={m.id}>
              <Link
                to="/messages"
                className="group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                    m.read ? "bg-muted-foreground/30" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{m.senderName || "Someone"}</span>
                    {m.created_at && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  {m.body && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{m.body}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ============================================================================
// Active projects — user's own projects with milestone progress bars.
// ============================================================================
type ProjectRow = {
  id: string;
  title: string | null;
  cover_color: string | null;
  updated_at: string | null;
  total?: number;
  done?: number;
};

const ProjectsProgressCard = () => {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["home-my-projects", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,cover_color,updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      const rows = (data ?? []) as ProjectRow[];
      if (!rows.length) return rows;
      const { data: goals } = await supabase
        .from("project_goals" as any)
        .select("project_id,status")
        .in("project_id", rows.map((r) => r.id));
      const stats: Record<string, { total: number; done: number }> = {};
      ((goals as any[]) ?? []).forEach((g) => {
        const s = stats[g.project_id] ?? { total: 0, done: 0 };
        s.total += 1;
        if (["approved", "completed", "done", "shipped"].includes(g.status)) s.done += 1;
        stats[g.project_id] = s;
      });
      return rows.map((r) => ({ ...r, total: stats[r.id]?.total ?? 0, done: stats[r.id]?.done ?? 0 }));
    },
  });

  return (
    <div className="rounded-3xl border border-border/60 bg-card/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-sm font-semibold">Your projects</h3>
        </div>
        <Link to="/my-projects" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
          All
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : !user || !projects.length ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const total = p.total ?? 0;
            const done = p.done ?? 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const accent = p.cover_color || "var(--primary)";
            return (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="group block rounded-xl px-2 py-2 transition hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{p.title || "Untitled"}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {total > 0 ? `${done}/${total}` : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
                      }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ============================================================================
// Recent releases — what's shipping publicly across the platform.
// ============================================================================
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
        (profiles ?? []).map((profile) => [profile.user_id, profile.display_name || profile.username || null]),
      );
      return rows.map((row) => ({
        ...row,
        ownerName: row.user_id ? profileById.get(row.user_id) ?? null : null,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (!projects.length) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Nothing live right now.</p>;
  }

  return (
    <div className="divide-y divide-border/50">
      {projects.map((project) => {
        const owner = project.ownerName || "Rhoze";
        const href = project.public_slug ? `/release/${project.public_slug}` : `/projects/${project.id}`;
        return (
          <Link
            key={project.id}
            to={href}
            className="group flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/30 sm:px-2"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span>{owner}</span>
                {project.updated_at && (
                  <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
                )}
              </div>
              <p className="truncate font-display text-sm font-semibold text-foreground">
                {project.title || "Untitled release"}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
          </Link>
        );
      })}
    </div>
  );
};

// ============================================================================
// Live activity — personal dashboard with gradient pass + inbox + projects.
// ============================================================================
const LiveActivityPanel = () => (
  <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
    <header className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Live activity</p>
      <h2 className="font-display text-2xl font-bold text-foreground">What's moving for you</h2>
    </header>

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <PassHeroCard />
      </div>
      <div className="space-y-4 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <RecentMessagesCard />
          <ProjectsProgressCard />
        </div>
      </div>
    </div>

    <div className="rounded-3xl border border-border/60 bg-card/40 p-5">
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
