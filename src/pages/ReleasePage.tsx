/**
 * ReleasePage — public `/release/:slug` view.
 *
 * Mirrors the owner ProjectDetailPage layout (full-bleed hero + tab bar)
 * but read-only. Empty states are HIDDEN from fans across every tab so the
 * page never feels broken. The Board tab itself is hidden when empty.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
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

  const hasMilestones = (milestones?.length ?? 0) > 0;
  const hasStory = storyItems.length > 0;
  const hasBoard = (deliverables ?? []).some((d: any) => d.file_url || d.title);

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
              {hasMilestones && (
                <section>
                  <MilestoneTrack milestones={milestones as any} contractId={contract?.id} />
                </section>
              )}

              {(hasStory || hasBoard) && (
                <div className={`grid gap-6 ${hasStory && hasBoard ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                  {hasStory && (
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Story</h3>
                      <StoryFeed items={storyItems} publicOnly preview hideWhenEmpty />
                    </section>
                  )}
                  {hasBoard && (
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Board</h3>
                      <BoardMasonry deliverables={deliverables as any} limit={6} hideWhenEmpty />
                    </section>
                  )}
                  <section>
                    <SupportersStrip
                      projectId={project.id}
                      ownerId={project.user_id}
                      owner={owner ?? null}
                      team={team as any}
                      milestones={milestones as any}
                      hideSupportersWhenEmpty
                    />
                  </section>
                </div>
              )}

              <div ref={commentsRef}>
                <ReleaseComments projectId={project.id} />
              </div>
            </TabsContent>

            {/* ROADMAP — read-only stage list (no vision/scope boxes per spec) */}
            <TabsContent value="roadmap" className="space-y-3">
              {hasMilestones ? (
                <>
                  <MilestoneTrack milestones={milestones as any} contractId={contract?.id} />
                  <ol className="mt-6 space-y-2">
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Roadmap coming soon.</p>
              )}
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

            {/* BOARD */}
            {hasBoard && (
              <TabsContent value="board">
                <BoardMasonry deliverables={deliverables as any} showFilters />
              </TabsContent>
            )}

            {/* STORY — description paragraph then chronological feed */}
            <TabsContent value="story" className="space-y-6">
              <div className="max-w-3xl">
                {(project.description || project.vision) && (
                  <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed mb-6">
                    {project.description ?? project.vision}
                  </p>
                )}
                <StoryFeed items={storyItems} publicOnly hideWhenEmpty />
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
          publicView
        />
      </div>
    </div>
  );
};

export default ReleasePage;
