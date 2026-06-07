/**
 * ReleasePage — public `/release/:slug` view, redesigned to match the
 * owner ProjectDetailPage layout (full-bleed hero + 6 tabs). Read-only:
 * no edit affordances, board shows only files the artist exposed, story
 * shows only public updates, team shows team + supporters.
 *
 * Tabs: Overview · Roadmap · Timeline · Board · Story · Team.
 *
 * Right rail keeps the existing SupportPanel (cheer / share / coin) and the
 * comments thread renders below the tabs. Tokenize CTA pinned at bottom.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ListChecks, Check, Target, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useMemo, useRef } from "react";

import ProjectHero from "@/components/project/shared/ProjectHero";
import MilestoneTrack from "@/components/project/shared/MilestoneTrack";
import BoardMasonry from "@/components/project/shared/BoardMasonry";
import SupportersStrip from "@/components/project/shared/SupportersStrip";
import StoryFeed from "@/components/project/shared/StoryFeed";
import TokenizeBottomCta from "@/components/project/shared/TokenizeBottomCta";
import { computeProjectStatus } from "@/components/project/shared/projectStatus";

import SupportPanel from "@/components/release/SupportPanel";
import ReleaseComments from "@/components/release/ReleaseComments";
import RoadmapCalendarView from "@/components/project/RoadmapCalendarView";

const TAB_TRIGGER =
  "shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

const ReleasePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const { data: project, isLoading } = useQuery({
    queryKey: ["release", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, vision, scope_of_work, cover_color, cover_image_url, cheer_count, tokenize_ready, user_id, public_slug, linked_token_id, is_public, created_at",
        )
        .eq("public_slug", slug!)
        .eq("is_public", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: linkedToken } = useQuery({
    queryKey: ["release-linked-token", (project as any)?.linked_token_id],
    enabled: !!(project as any)?.linked_token_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("creator_tokens")
        .select("ticker, name, mint_address")
        .eq("id", (project as any).linked_token_id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
  });

  const { data: owner } = useQuery({
    queryKey: ["release-owner", project?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", project!.user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!project?.user_id,
  });

  const { data: contract } = useQuery({
    queryKey: ["release-contract", project?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_contracts")
        .select("id")
        .eq("project_id", project!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!project?.id,
  });

  const { data: milestones } = useQuery({
    queryKey: ["release-milestones", contract?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_milestones")
        .select("id, title, description, status, sort_order, due_date, approved_at, updated_at")
        .eq("contract_id", contract!.id)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!contract?.id,
  });

  const { data: goals } = useQuery({
    queryKey: ["release-goals", project?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_goals")
        .select("id, title, description, status, sort_order, due_date, parent_id, stage_date_start, stage_date_end, progress, priority, created_at")
        .eq("project_id", project!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!project?.id,
  });

  const { data: deliverables } = useQuery({
    queryKey: ["release-deliverables", project?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_deliverables")
        .select("id, title, completed, sort_order, anchored_at, file_url, file_name, mime_type, created_at")
        .eq("project_id", project!.id)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!project?.id,
  });

  const { data: team } = useQuery({
    queryKey: ["release-team", project?.id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("project_collaborators")
        .select("user_id, project_role")
        .eq("project_id", project!.id);
      if (!rows?.length) return [] as any[];
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, bio")
        .in("user_id", ids);
      return rows.map((r) => ({
        ...r,
        profile: profs?.find((p) => p.user_id === r.user_id),
      }));
    },
    enabled: !!project?.id,
  });

  const { data: myCheer } = useQuery({
    queryKey: ["release-mycheer", project?.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_cheers")
        .select("id")
        .eq("project_id", project!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!project?.id && !!user?.id,
  });

  const status = useMemo(() => computeProjectStatus(milestones as any), [milestones]);

  const stats = useMemo(() => {
    const ms = milestones ?? [];
    const dlv = deliverables ?? [];
    const done = ms.filter((m) => m.status === "approved" || m.status === "released").length;
    const inProgress = ms.filter((m) => m.status === "in_progress" || m.status === "submitted").length;
    const overall = ms.length ? Math.round((done / ms.length) * 100) : 0;
    const tasksDone = dlv.filter((d: any) => d.completed).length;
    return { done, inProgress, overall, tasksDone, tasksTotal: dlv.length, goalsTotal: ms.length };
  }, [milestones, deliverables]);

  const storyItems = useMemo(
    () =>
      (goals ?? [])
        .filter((g: any) => !g.parent_id)
        .map((g: any) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          created_at: g.created_at,
          is_public: true,
        })),
    [goals],
  );

  const commentsRef = useRef<HTMLDivElement>(null);
  const scrollToComments = () => commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (isLoading) {
    return <div className="container mx-auto py-20 text-center text-muted-foreground">Loading release…</div>;
  }
  if (!project) {
    return (
      <div className="container mx-auto py-20 text-center">
        <p className="text-muted-foreground">This release isn't public.</p>
        <Link to="/discover" className="text-sm underline mt-2 inline-block">Back to Discover</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-6">
        <Link to="/discover" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3 w-3" /> Discover
        </Link>
      </div>

      <div className="container mx-auto px-0 md:px-4">
        <ProjectHero
          project={project}
          owner={owner ?? null}
          status={status}
          isOwner={false}
          publicView
        />
      </div>

      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-[1fr,340px] gap-8">
        <div className="space-y-6 min-w-0">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="sticky top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mb-6 w-[calc(100%+2rem)] md:w-full justify-start overflow-x-auto flex-nowrap shrink-0 h-auto gap-6 rounded-none border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-0">
              <TabsTrigger value="overview" className={TAB_TRIGGER}>Overview</TabsTrigger>
              <TabsTrigger value="roadmap" className={TAB_TRIGGER}>Roadmap</TabsTrigger>
              <TabsTrigger value="timeline" className={TAB_TRIGGER}>Timeline</TabsTrigger>
              <TabsTrigger value="board" className={TAB_TRIGGER}>Board</TabsTrigger>
              <TabsTrigger value="story" className={TAB_TRIGGER}>Story</TabsTrigger>
              <TabsTrigger value="team" className={TAB_TRIGGER}>Team</TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="space-y-8">
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Milestones</h2>
                <MilestoneTrack milestones={milestones as any} contractId={contract?.id} />
              </section>

              <section className="rounded-2xl border border-border bg-card/40 p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Progress</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={<ListChecks className="h-3.5 w-3.5" />} label="Overall" value={`${stats.overall}%`} bar={stats.overall} />
                  <StatCard icon={<Check className="h-3.5 w-3.5" />} label="Tasks" value={`${stats.tasksDone}/${stats.tasksTotal}`} bar={stats.tasksTotal ? (stats.tasksDone / stats.tasksTotal) * 100 : 0} />
                  <StatCard icon={<Target className="h-3.5 w-3.5" />} label="Milestones" value={`${stats.done}/${stats.goalsTotal}`} bar={stats.goalsTotal ? (stats.done / stats.goalsTotal) * 100 : 0} />
                  <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="In progress" value={`${stats.inProgress}`} />
                </div>
              </section>

              <div className="grid gap-6 md:grid-cols-3">
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Story</h3>
                  <StoryFeed items={storyItems} publicOnly preview />
                </section>
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Board</h3>
                  <BoardMasonry deliverables={deliverables as any} limit={6} />
                </section>
                <section>
                  <SupportersStrip
                    projectId={project.id}
                    ownerId={project.user_id}
                    owner={owner ?? null}
                    team={team as any}
                    milestones={milestones as any}
                  />
                </section>
              </div>
            </TabsContent>

            {/* ROADMAP — read-only milestone stack */}
            <TabsContent value="roadmap" className="space-y-3">
              {project.vision && (
                <section className="rounded-2xl border border-border bg-card/40 p-5 mb-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vision</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{project.vision}</p>
                </section>
              )}
              {project.scope_of_work && (
                <section className="rounded-2xl border border-border bg-card/40 p-5 mb-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Scope</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{project.scope_of_work}</p>
                </section>
              )}
              <MilestoneTrack milestones={milestones as any} contractId={contract?.id} />
              {!!milestones?.length && (
                <ol className="mt-6 space-y-2">
                  {milestones.map((m: any, i: number) => {
                    const done = m.status === "approved" || m.status === "released";
                    return (
                      <li key={m.id} className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4">
                        <div className={["h-6 w-6 rounded-full grid place-items-center text-[10px] font-semibold shrink-0", done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"].join(" ")}>
                          {done ? <Check className="h-3 w-3" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{m.title}</div>
                          {m.description && (
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{m.description}</p>
                          )}
                          {m.due_date && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Due {new Date(m.due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </TabsContent>

            {/* TIMELINE — read-only calendar */}
            <TabsContent value="timeline">
              <div className="pointer-events-none opacity-95">
                <RoadmapCalendarView goals={goals as any} projectId={project.id} />
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground text-center">Read-only timeline of public milestones.</p>
            </TabsContent>

            {/* BOARD */}
            <TabsContent value="board">
              <BoardMasonry deliverables={deliverables as any} showFilters />
            </TabsContent>

            {/* STORY */}
            <TabsContent value="story">
              <div className="max-w-3xl">
                <StoryFeed items={storyItems} publicOnly />
              </div>
            </TabsContent>

            {/* TEAM */}
            <TabsContent value="team" className="space-y-6">
              <SupportersStrip
                projectId={project.id}
                ownerId={project.user_id}
                owner={owner ?? null}
                team={team as any}
                milestones={milestones as any}
              />
            </TabsContent>
          </Tabs>

          <ReleaseComments ref={commentsRef} projectId={project.id} />
        </div>

        {/* Sticky support rail */}
        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <SupportPanel
            projectId={project.id}
            projectTitle={project.title}
            cheerCount={project.cheer_count ?? 0}
            iSupport={!!myCheer}
            releaseUrl={typeof window !== "undefined" ? window.location.href : `/release/${slug}`}
            ownerName={owner?.display_name ?? owner?.username ?? null}
            coverColor={project.cover_color}
            coverImageUrl={(project as any).cover_image_url ?? null}
            linkedTokenTicker={linkedToken?.ticker ?? null}
            linkedTokenMint={linkedToken?.mint_address ?? null}
            onScrollToComments={scrollToComments}
          />
        </aside>
      </div>

      <div className="container mx-auto px-4 pb-10">
        <TokenizeBottomCta
          project={project as any}
          linkedTokenTicker={linkedToken?.ticker ?? null}
        />
      </div>
    </div>
  );
};

const StatCard = ({
  icon, label, value, bar,
}: { icon: React.ReactNode; label: string; value: string; bar?: number }) => (
  <div className="rounded-xl border border-border bg-background/40 p-3">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      {icon} {label}
    </div>
    <div className="mt-1.5 text-2xl font-display font-bold tabular-nums">{value}</div>
    {typeof bar === "number" && <Progress value={bar} className="h-1 mt-2" />}
  </div>
);

export default ReleasePage;
