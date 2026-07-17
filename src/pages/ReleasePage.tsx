/**
 * ReleasePage — public `/release/:slug` view.
 *
 * Mirrors the owner ProjectDetailPage layout (full-bleed hero + tab bar)
 * but read-only. Empty states are HIDDEN from fans across every tab so the
 * page never feels broken. The Board tab itself is hidden when empty.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Calendar as CalendarIcon, ListChecks } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";

import ProjectHero from "@/components/project/shared/ProjectHero";
import MilestoneTrack from "@/components/project/shared/MilestoneTrack";
import BoardMasonry from "@/components/project/shared/BoardMasonry";
import SupportersStrip from "@/components/project/shared/SupportersStrip";
import StoryFeed from "@/components/project/shared/StoryFeed";
import ReleaseActivityFeed from "@/components/project/ReleaseActivityFeed";
import TokenizeBottomCta from "@/components/project/shared/TokenizeBottomCta";
import ProjectCoinLiveCard from "@/components/project/shared/ProjectCoinLiveCard";
import { computeProjectStatus } from "@/components/project/shared/projectStatus";

import SupportPanel from "@/components/release/SupportPanel";
import ProjectFeaturedVisual from "@/components/project/ProjectFeaturedVisual";

import RoadmapCalendarView from "@/components/project/RoadmapCalendarView";

const TAB_TRIGGER =
  "shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

const ReleasePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const { data: project, isLoading } = useQuery({
    queryKey: ["release", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, vision, scope_of_work, cover_color, cover_image_url, cheer_count, tokenize_ready, user_id, public_slug, linked_token_id, is_public, created_at, featured_visual_url, featured_visual_external_url, featured_visual_mime, featured_visual_title",
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

  const { data: tasks } = useQuery({
    queryKey: ["release-tasks", project?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, completed")
        .eq("project_id", project!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!project?.id,
  });

  const { data: team } = useQuery({
    queryKey: ["release-team", project?.id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("project_collaborators")
        .select("user_id, project_role, created_at")
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
      const { data } = await (supabase as any)
        .from("project_cheers")
        .select("id, shared_to_profile")
        .eq("project_id", project!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!project?.id && !!user?.id,
  });

  const status = useMemo(() => computeProjectStatus(milestones as any), [milestones]);

  const overallPct = useMemo(() => {
    const ms = milestones ?? [];
    if (!ms.length) return 0;
    const done = ms.filter((m) => m.status === "approved" || m.status === "released").length;
    return Math.round((done / ms.length) * 100);
  }, [milestones]);

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

  const roadmapStages = useMemo(
    () =>
      (goals ?? [])
        .filter((g: any) => !g.parent_id)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [goals],
  );

  const roadmapDoneCount = useMemo(
    () =>
      roadmapStages.filter((g: any) => {
        const s = (g.status || "").toLowerCase();
        return s === "approved" || s === "released" || s === "completed" || s === "shipped" || s === "done";
      }).length,
    [roadmapStages],
  );

  const overviewStages = roadmapStages.length ? roadmapStages : (milestones ?? []);
  const overviewDoneCount = roadmapStages.length
    ? roadmapDoneCount
    : (milestones ?? []).filter((m: any) => m.status === "approved" || m.status === "released").length;

  const hasMilestones = (milestones?.length ?? 0) > 0;
  const hasStory = storyItems.length > 0;
  const hasBoard = (deliverables ?? []).some((d: any) => d.file_url || d.title);


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

      <div className="container mx-auto px-4 py-8 space-y-6">
        <SupportPanel
          horizontal
          projectId={project.id}
          projectTitle={project.title}
          cheerCount={project.cheer_count ?? 0}
          iSupport={!!myCheer}
          iSupportShared={!!(myCheer as any)?.shared_to_profile}
          releaseUrl={typeof window !== "undefined" ? window.location.href : `/release/${slug}`}
          ownerName={owner?.display_name ?? owner?.username ?? null}
          coverColor={project.cover_color}
          coverImageUrl={(project as any).cover_image_url ?? null}
          linkedTokenTicker={linkedToken?.ticker ?? null}
          linkedTokenMint={linkedToken?.mint_address ?? null}
          stagesComplete={overviewDoneCount}
          stagesTotal={overviewStages.length}
        />
        <ProjectCoinLiveCard linkedTokenId={(project as any).linked_token_id ?? null} />

        <div className="space-y-6 min-w-0">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="sticky top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mb-6 w-[calc(100%+2rem)] md:w-full justify-start overflow-x-auto flex-nowrap shrink-0 h-auto gap-6 rounded-none border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-0">
              <TabsTrigger value="overview" className={TAB_TRIGGER}>Overview</TabsTrigger>
              <TabsTrigger value="roadmap" className={TAB_TRIGGER}>Roadmap</TabsTrigger>
              <TabsTrigger value="timeline" className={TAB_TRIGGER}>Timeline</TabsTrigger>
              <TabsTrigger value="board" className={TAB_TRIGGER}>Board</TabsTrigger>
              <TabsTrigger value="story" className={TAB_TRIGGER}>Story</TabsTrigger>
              <TabsTrigger value="activity" className={TAB_TRIGGER}>Activity</TabsTrigger>
              <TabsTrigger value="team" className={TAB_TRIGGER}>Team</TabsTrigger>
            </TabsList>

            {/* OVERVIEW — mirrors owner ProjectDetailPage layout */}
            <TabsContent value="overview" className="space-y-6">
              {(() => {
                const ms = overviewStages;
                const done = overviewDoneCount;
                const total = ms.length;
                const pct = total ? Math.round((done / total) * 100) : 0;
                const upcoming = ms
                  .filter((m: any) => {
                    const s = (m.status || "").toLowerCase();
                    const isDone = s === "approved" || s === "released" || s === "completed" || s === "shipped" || s === "done";
                    return m.due_date && !isDone;
                  })
                  .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                  .slice(0, 3);

                const mediaDeliverables = (deliverables ?? []).filter((d: any) => {
                  if (!d.file_url) return false;
                  const m = (d.mime_type || "").toLowerCase();
                  return m.startsWith("audio/") || m.startsWith("video/") || m.startsWith("image/");
                });

                const taskList = tasks ?? [];
                const taskDone = taskList.filter((t: any) => t.completed).length;

                return (
                  <>
                    <div className="grid gap-4 md:grid-cols-12">
                      {/* Roadmap + Timeline */}
                      <div className="md:col-span-4 rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 via-card to-indigo-500/5 p-4 min-h-[240px] flex flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-violet-600 dark:text-violet-300">Roadmap · Timeline</div>
                            <p className="font-display text-xl font-bold text-foreground mt-1 tabular-nums">
                              {total ? `${done}/${total}` : "—"}
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{total ? `${pct}%` : "no stages"}</span>
                            </p>
                          </div>
                        </div>
                        {total > 0 && <Progress value={pct} className="mt-2 h-1.5" />}
                        <div className="mt-3 flex-1">
                          {upcoming.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No upcoming deadlines.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {upcoming.map((m: any) => {
                                const d = new Date(m.due_date);
                                const overdue = isPast(d) && !isToday(d);
                                return (
                                  <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <CalendarIcon className={`h-3 w-3 shrink-0 ${overdue ? "text-destructive" : "text-muted-foreground"}`} />
                                      <span className="text-xs text-foreground truncate">{m.title}</span>
                                    </div>
                                    <span className={`text-[10px] tabular-nums shrink-0 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                                      {format(d, "MMM d")}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* Tasks (read-only) */}
                      <div className="md:col-span-3 rounded-2xl border border-border bg-card p-4 min-h-[240px] flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
                              <ListChecks className="h-3 w-3" /> Tasks
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{taskDone}/{taskList.length} done</p>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
                          {taskList.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No tasks yet.</p>
                          ) : (
                            taskList.map((t: any) => (
                              <div key={t.id} className="flex items-center gap-2 rounded-md px-1.5 py-1">
                                <span className={`h-3.5 w-3.5 rounded border border-border grid place-items-center shrink-0 ${t.completed ? "bg-primary/15 border-primary/30" : ""}`}>
                                  {t.completed && <Check className="h-2.5 w-2.5 text-primary" />}
                                </span>
                                <span className={`text-xs leading-snug flex-1 ${t.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                  {t.title}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Visual */}
                      <div className="md:col-span-5">
                        <ProjectFeaturedVisual
                          projectId={project.id}
                          featuredUrl={(project as any).featured_visual_url}
                          featuredExternalUrl={(project as any).featured_visual_external_url}
                          featuredMime={(project as any).featured_visual_mime}
                          featuredTitle={(project as any).featured_visual_title}
                          canManage={false}
                          publicView
                        />
                      </div>
                    </div>

                    {/* Board — wide */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-end justify-between gap-3 mb-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Board</div>
                          <p className="font-display text-base font-semibold text-foreground mt-0.5">Mood, references & uploads</p>
                        </div>
                      </div>
                      {mediaDeliverables.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
                          <p className="text-sm text-muted-foreground">No board items yet.</p>
                        </div>
                      ) : (
                        <BoardMasonry deliverables={mediaDeliverables as any} limit={12} />
                      )}
                    </div>
                  </>
                );
              })()}
            </TabsContent>


            {/* ROADMAP — vision + scope + AI-drafted milestones (project_goals) */}
            <TabsContent value="roadmap" className="space-y-6">
              {(project.vision || project.scope_of_work) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {project.vision && (
                    <div className="rounded-2xl border border-border bg-card/40 p-5">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vision</h3>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.vision}</p>
                    </div>
                  )}
                  {project.scope_of_work && (
                    <div className="rounded-2xl border border-border bg-card/40 p-5">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Scope of work</h3>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.scope_of_work}</p>
                    </div>
                  )}
                </div>
              )}

              {hasMilestones && (
                <MilestoneTrack milestones={milestones as any} contractId={contract?.id} />
              )}

              {storyItems.length > 0 ? (
                <ol className="space-y-3">
                  {storyItems.map((g: any, i: number) => (
                    <li key={g.id} className="rounded-2xl border border-border bg-card/40 p-5">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                        <span className="h-5 w-5 rounded-full grid place-items-center bg-muted text-[10px] font-semibold text-foreground">{i + 1}</span>
                        {g.created_at && new Date(g.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <h3 className="text-base font-semibold leading-snug">{g.title}</h3>
                      {g.description && (
                        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {g.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : hasMilestones ? (
                <ol className="space-y-2">
                  {milestones!.map((m: any, i: number) => {
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
              ) : !(project.vision || project.scope_of_work) ? (
                <p className="text-sm text-muted-foreground text-center py-8">Roadmap coming soon.</p>
              ) : null}
            </TabsContent>

            {/* TIMELINE — thin progress + read-only calendar */}
            <TabsContent value="timeline" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Overall</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{overallPct}%</span>
                </div>
                <Progress value={overallPct} className="h-1" />
              </div>
              <div className="pointer-events-none opacity-95">
                <RoadmapCalendarView goals={goals as any} projectId={project.id} />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">Read-only timeline of public milestones.</p>
            </TabsContent>

            {/* BOARD — always visible in public view */}
            <TabsContent value="board">
              {hasBoard ? (
                <BoardMasonry deliverables={deliverables as any} showFilters />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No board items have been shared yet.
                </p>
              )}
            </TabsContent>

            {/* STORY — description + background only (roadmap milestones live in Roadmap) */}
            <TabsContent value="story" className="space-y-6">
              <div className="max-w-3xl space-y-6">
                {project.description ? (
                  <section>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">About this release</h3>
                    <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
                      {project.description}
                    </p>
                  </section>
                ) : null}
                {project.vision ? (
                  <section>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Background</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {project.vision}
                    </p>
                  </section>
                ) : null}
                {!project.description && !project.vision && (
                  <p className="text-sm text-muted-foreground text-center py-8">No story yet.</p>
                )}
              </div>
            </TabsContent>


            {/* ACTIVITY — public build-in-public stream */}
            <TabsContent value="activity" className="space-y-6">
              <div className="max-w-3xl">
                <ReleaseActivityFeed
                  projectId={project.id}
                  contractId={contract?.id}
                  publicOnly
                />
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
                hideSupportersWhenEmpty
              />
            </TabsContent>
          </Tabs>
        </div>

      </div>


    </div>
  );
};

export default ReleasePage;
