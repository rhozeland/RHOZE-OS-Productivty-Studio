/**
 * ProjectDetailPage (owner view) — redesigned per v11 Pillar 8.
 *
 * Layout:
 *   - Full-bleed cover hero (300px+) with title, artist chip, status pill,
 *     public toggle + edit cover affordances.
 *   - Sticky tab bar: Overview · Roadmap · Timeline · Board · Story · Team.
 *   - Overview = milestone track + 3-col grid (story preview, board preview,
 *     team+supporters).
 *   - Roadmap/Timeline/Team reuse the existing in-depth tools.
 *   - Board uses the deliverables-backed masonry.
 *   - Story renders project_goals as a journal-style feed.
 *   - Tokenize CTA pinned at the bottom of every tab.
 */
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Check, X, Lock, ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import ProjectHero from "@/components/project/shared/ProjectHero";
import MilestoneTrack from "@/components/project/shared/MilestoneTrack";
import BoardMasonry from "@/components/project/shared/BoardMasonry";
import SupportersStrip from "@/components/project/shared/SupportersStrip";
import StoryFeed from "@/components/project/shared/StoryFeed";
import TokenizeBottomCta from "@/components/project/shared/TokenizeBottomCta";
import { computeProjectStatus } from "@/components/project/shared/projectStatus";

import ProjectVision from "@/components/project/ProjectVision";
import InlineProjectDescription from "@/components/project/InlineProjectDescription";
import StoryUpdates from "@/components/project/StoryUpdates";
import RoadmapCalendarView from "@/components/project/RoadmapCalendarView";
import StageRoadmap from "@/components/project/StageRoadmap";
import ProjectBudget from "@/components/project/ProjectBudget";
import ProgressChart from "@/components/project/ProgressChart";
import Timeline from "@/components/project/Timeline";
import Collaborators from "@/components/project/Collaborators";
import ProjectBackers from "@/components/project/ProjectBackers";
import RoadmapLockFlow from "@/components/project/RoadmapLockFlow";
import ProjectDisputes from "@/components/project/ProjectDisputes";
import ProjectControls from "@/components/project/ProjectControls";
import RevenueSplitConfig from "@/components/revenue/RevenueSplitConfig";
import ProjectTools from "@/components/project/ProjectTools";
import DropRoomLauncher from "@/components/project/DropRoomLauncher";
import { useProjectRole } from "@/hooks/useProjectRole";
import { getHoldTier } from "@/lib/tier-matrix";
import BackedByRhozelandBadge from "@/components/concierge/BackedByRhozelandBadge";
import PublishReleaseCard from "@/components/project/PublishReleaseCard";
import SignedAgreementCard from "@/components/proposals/SignedAgreementCard";
import ProjectScopeReview from "@/components/project/ProjectScopeReview";
import AiRoadmapDraftButton from "@/components/project/AiRoadmapDraftButton";
import AttachCoinToProjectCard from "@/components/project/AttachCoinToProjectCard";
import RoadmapCopilot from "@/components/project/RoadmapCopilot";
import TokenizeProjectCta from "@/components/project/TokenizeProjectCta";
import EditorSideRail from "@/components/project/shared/EditorSideRail";
import ProjectCoinLiveCard from "@/components/project/shared/ProjectCoinLiveCard";
import SupportProjectCard from "@/components/project/shared/SupportProjectCard";
import { Progress } from "@/components/ui/progress";

const SMARTBOARD_CAP_BY_TIER: Record<string, number> = {
  spark: 2,
  bloom: 5,
  glow: 12,
  play: Infinity,
};

const TAB_TRIGGER =
  "shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none";

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canManage: canManageProject, isOwner, isCollaborator } = useProjectRole(id);

  const { data: credits } = useQuery({
    queryKey: ["user-credits-balance", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.balance ?? 0;
    },
    enabled: !!user,
  });
  const userTier = getHoldTier(credits ?? 0);
  const smartboardCap = SMARTBOARD_CAP_BY_TIER[userTier] ?? 2;

  const [editingHeader, setEditingHeader] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: owner } = useQuery({
    queryKey: ["project-owner", project?.user_id],
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

  const { data: goals } = useQuery({
    queryKey: ["project-goals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_goals")
        .select("*")
        .eq("project_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contract } = useQuery({
    queryKey: ["project-contract", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contracts")
        .select("*")
        .eq("project_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: milestones } = useQuery({
    queryKey: ["project-milestones", contract?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_milestones")
        .select("*")
        .eq("contract_id", contract!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!contract,
  });

  const { data: collaborators } = useQuery({
    queryKey: ["project-collaborators", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("*")
        .eq("project_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: teamWithProfiles } = useQuery({
    queryKey: ["project-team-profiles", id, collaborators?.length],
    enabled: !!collaborators?.length,
    queryFn: async () => {
      const ids = (collaborators ?? []).map((c: any) => c.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      return (collaborators ?? []).map((c: any) => ({
        ...c,
        profile: profs?.find((p) => p.user_id === c.user_id),
      }));
    },
  });

  const { data: deliverables } = useQuery({
    queryKey: ["project-deliverables", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_deliverables")
        .select("*")
        .eq("project_id", id!)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
  });

  const { data: linkedSmartboards } = useQuery({
    queryKey: ["project-smartboards", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_smartboards" as any)
        .select("*")
        .eq("project_id", id!);
      if (error) throw error;
      return data as any[];
    },
  });

  const linkedIds = linkedSmartboards?.map((ls: any) => ls.smartboard_id) ?? [];
  const { data: smartboardDetails } = useQuery({
    queryKey: ["smartboard-details", linkedIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("smartboards").select("*").in("id", linkedIds);
      if (error) throw error;
      return data;
    },
    enabled: linkedIds.length > 0,
  });

  const createSmartboard = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (smartboardDetails && smartboardDetails.length >= smartboardCap) {
        throw new Error(`You've hit your tier's smartboard cap (${smartboardCap}) for this project.`);
      }
      const count = (smartboardDetails?.length ?? 0) + 1;
      const { data: board, error } = await supabase
        .from("smartboards")
        .insert({
          title: `${project?.title ?? "Project"} · Board ${count}`,
          description: null,
          cover_color: project?.cover_color ?? "#7c3aed",
          user_id: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: linkErr } = await supabase.from("project_smartboards" as any).insert({
        project_id: id!,
        smartboard_id: board.id,
        linked_by: user.id,
      } as any);
      if (linkErr) throw linkErr;
      return board.id as string;
    },
    onSuccess: (boardId) => {
      queryClient.invalidateQueries({ queryKey: ["project-smartboards", id] });
      toast.success("Smartboard created");
      navigate(`/smartboards/${boardId}?from=project:${id}`, {
        state: { backTo: `/projects/${id}`, backLabel: "Back to project" },
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlinkSmartboard = useMutation({
    mutationFn: async (smartboardId: string) => {
      const { error } = await supabase
        .from("project_smartboards" as any)
        .delete()
        .eq("project_id", id!)
        .eq("smartboard_id", smartboardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-smartboards", id] });
      toast.success("Smartboard removed");
    },
  });

  const updateHeader = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({ title: editTitle, description: editDescription || null })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setEditingHeader(false);
      toast.success("Project updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const status = useMemo(() => computeProjectStatus(milestones as any), [milestones]);
  const isPaid = project?.project_type !== "collaborative";
  const isLocked = contract?.status === "active" || contract?.status === "completed";

  // Story items: derive from project_goals (their AI-drafted descriptions
  // already read like journal entries). All marked public for owner view.
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

  const activeTab = searchParams.get("tab") ?? "overview";
  const setTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  if (!project) return <div className="text-muted-foreground p-6">Loading...</div>;

  const startEditing = () => {
    setEditTitle(project.title);
    setEditDescription(project.description || "");
    setEditingHeader(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors mb-2 ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* HERO */}
      <ProjectHero
        project={project}
        owner={owner ?? null}
        status={status}
        isOwner={isOwner}
      />


      {/* Editable header strip below the cover */}
      <div className="mt-4 md:mt-6 flex items-start justify-between gap-3 px-1">
        <div className="flex-1 min-w-0">
          {editingHeader ? (
            <div className="space-y-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-display text-xl font-bold"
                autoFocus
              />
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a project description..."
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => updateHeader.mutate()} disabled={!editTitle.trim() || updateHeader.isPending}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingHeader(false)}>
                  <X className="mr-1 h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={"group rounded-lg p-1 -m-1 " + (isOwner ? "cursor-pointer hover:bg-muted/40" : "")}
              onClick={isOwner ? startEditing : undefined}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {isLocked && (
                  <Badge variant="outline" className="gap-1 text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </Badge>
                )}
                {project.intake_tier === "concierge" && <BackedByRhozelandBadge />}
                {isOwner && (
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              {project.description && (
                <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>

          )}
        </div>
      </div>

      {/* TABS + EDITOR SIDE RAIL */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,320px]">
        <Tabs value={activeTab} onValueChange={setTab} className="w-full min-w-0">
          <TabsList
            className="sticky top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mb-6 w-[calc(100%+2rem)] md:w-full justify-start overflow-x-auto flex-nowrap shrink-0 h-auto gap-6 rounded-none border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-0"
          >
            <TabsTrigger value="overview" className={TAB_TRIGGER}>Overview</TabsTrigger>
            <TabsTrigger value="roadmap" className={TAB_TRIGGER}>Roadmap</TabsTrigger>
            <TabsTrigger value="timeline" className={TAB_TRIGGER}>Timeline</TabsTrigger>
            <TabsTrigger value="board" className={TAB_TRIGGER}>Board</TabsTrigger>
            <TabsTrigger value="story" className={TAB_TRIGGER}>Story</TabsTrigger>
            <TabsTrigger value="team" className={TAB_TRIGGER}>Team</TabsTrigger>
            {isPaid && <TabsTrigger value="budget" className={TAB_TRIGGER}>Budget</TabsTrigger>}
          </TabsList>

          {/* OVERVIEW — bento dashboard */}
          <TabsContent value="overview" className="space-y-6">
            {(() => {
              const ms = milestones ?? [];
              const done = ms.filter((m: any) => m.status === "approved" || m.status === "released").length;
              const total = ms.length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              const storyCount = storyItems.length;
              const boardCount = (deliverables ?? []).filter((d: any) => d.file_url).length;
              const teamCount = 1 + (collaborators?.length ?? 0);
              const tiles = [
                { key: "roadmap", label: "Roadmap", value: total ? `${done}/${total}` : "—", sub: total ? `${pct}% done` : "Add stages", tint: "from-violet-500/15 to-indigo-500/10 text-violet-600 dark:text-violet-300" },
                { key: "story",   label: "Story",    value: storyCount, sub: storyCount ? "Latest updates" : "Share progress", tint: "from-rose-500/15 to-pink-500/10 text-rose-600 dark:text-rose-300" },
                ...(boardCount > 0 ? [{ key: "board", label: "Board", value: boardCount, sub: "Assets attached", tint: "from-amber-500/15 to-orange-500/10 text-amber-700 dark:text-amber-300" }] : []),
                { key: "team",    label: "Crew",     value: teamCount,  sub: collaborators?.length ? `${collaborators.length} collab${collaborators.length === 1 ? "" : "s"}` : "Just you", tint: "from-emerald-500/15 to-teal-500/10 text-emerald-700 dark:text-emerald-300" },
              ];
              return (
                <div className={`grid grid-cols-2 gap-3 ${tiles.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
                  {tiles.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`group text-left rounded-2xl border border-border bg-gradient-to-br ${t.tint} p-4 transition-all hover:shadow-md hover:-translate-y-0.5`}
                    >
                      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold opacity-80">{t.label}</div>
                      <div className="mt-2 font-display text-2xl md:text-3xl font-bold text-foreground tabular-nums">{t.value}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{t.sub}</div>
                      {t.key === "roadmap" && total > 0 && (
                        <div className="mt-3"><Progress value={pct} className="h-1" /></div>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Milestones — full-width card */}
            <button
              onClick={() => setTab("roadmap")}
              className="block w-full text-left rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Milestones</h2>
                  <p className="font-display text-base font-semibold text-foreground mt-0.5">Stages & deadlines</p>
                </div>
                <span className="text-[11px] text-muted-foreground group-hover:text-foreground">Open roadmap →</span>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <MilestoneTrack milestones={milestones as any} contractId={contract?.id} canManage={canManageProject} />
              </div>
            </button>

            {canManageProject && (
              <PublishReleaseCard
                projectId={project.id}
                isPublic={(project as any).is_public ?? false}
                publicSlug={(project as any).public_slug ?? null}
                cheerCount={(project as any).cheer_count ?? 0}
                tokenizeReady={(project as any).tokenize_ready ?? false}
                title={project.title}
                description={(project as any).vision ?? project.description ?? null}
              />
            )}

            {/* Bento row: Story / Board (if any) / Crew */}
            {(() => {
              const hasBoard = (deliverables ?? []).some((d: any) => d.file_url);
              return (
            <div className={`grid gap-4 ${hasBoard ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {/* Story preview */}
              <button
                onClick={() => setTab("story")}
                className="text-left rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md min-h-[180px] flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Story</h3>
                  <span className="text-[11px] text-muted-foreground">All →</span>
                </div>
                <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                  <StoryFeed items={storyItems} canManage={canManageProject} preview />
                </div>
              </button>

              {/* Board preview — only when files exist */}
              {hasBoard && (
              <button
                onClick={() => setTab("board")}
                className="text-left rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md min-h-[180px] flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Board</h3>
                  <span className="text-[11px] text-muted-foreground">All →</span>
                </div>
                <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                  <BoardMasonry
                    deliverables={((deliverables ?? []) as any[]).filter((d) => d.file_url)}
                    limit={4}
                    onSeeMore={() => setTab("board")}
                  />
                </div>
              </button>
              )}

              {/* Crew + Supporters */}
              <button
                onClick={() => setTab("team")}
                className="text-left rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md min-h-[180px] flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crew & Supporters</h3>
                  <span className="text-[11px] text-muted-foreground">Manage →</span>
                </div>
                <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                  <SupportersStrip
                    projectId={id!}
                    ownerId={project.user_id}
                    owner={owner ?? null}
                    team={teamWithProfiles as any}
                    milestones={milestones as any}
                  />
                </div>
              </button>
            </div>
              );
            })()}

            {/* Timeline shortcut */}
            <button
              onClick={() => setTab("timeline")}
              className="block w-full text-left rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-4 transition-all hover:border-primary/40 hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</div>
                  <p className="text-sm text-foreground mt-0.5">Plan stages, deadlines, and team work by week.</p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">Open timeline →</span>
              </div>
            </button>
          </TabsContent>


        {/* ROADMAP */}
        <TabsContent value="roadmap" className="space-y-6">
          {canManageProject && (
            <TokenizeProjectCta
              projectId={project.id}
              projectTitle={project.title}
              projectDescription={(project as any).description ?? null}
              linkedTokenId={(project as any).linked_token_id ?? null}
            />
          )}

          {canManageProject && !((project as any).linked_token_id) && (() => {
            const topStages = (goals ?? []).filter((g: any) => !g.parent_id);
            const totalStages = topStages.length;
            const completed = topStages.filter((g: any) => {
              const s = (g.status || "").toLowerCase();
              return s === "completed" || s === "shipped" || s === "done";
            }).length;
            const pct = totalStages === 0 ? 0 : Math.round((completed / totalStages) * 100);
            const remaining = Math.max(0, totalStages - completed);
            let msg = "";
            if (totalStages === 0 || pct === 0) {
              msg = "Keep building — complete stages to unlock tokenization";
            } else if (pct < 50) {
              msg = `You're building momentum — ${remaining} stage${remaining === 1 ? "" : "s"} to go`;
            } else if (pct < 100) {
              msg = `Almost there — ${remaining} more stage${remaining === 1 ? "" : "s"} and you're ready to launch`;
            } else {
              msg = "You're ready to launch your coin ✨";
            }
            return (
              <p className="px-1 text-sm font-medium text-primary">
                {msg}
              </p>
            );
          })()}

          <SignedAgreementCard projectId={id!} contractId={contract?.id} />

          {canManageProject && (
            <AttachCoinToProjectCard
              projectId={project.id}
              linkedTokenId={(project as any).linked_token_id ?? null}
            />
          )}

          <RoadmapCopilot projectId={id!} />


          {isPaid && (
            <ProjectScopeReview
              projectId={id!}
              projectTitle={project.title}
              goals={goals as any}
              contract={contract as any}
              collaborators={collaborators as any}
              ownerId={project.user_id}
            />
          )}

          {!isLocked && (goals?.filter((g: any) => !g.parent_id).length ?? 0) < 2 && (
            <AiRoadmapDraftButton
              projectId={id!}
              projectTitle={project.title}
              totalBudget={Number(project.total_budget ?? 0)}
              clientId={(collaborators as any)?.find?.((c: any) => c.project_role === "client")?.user_id ?? null}
              specialistId={(collaborators as any)?.find?.((c: any) => c.project_role === "specialist")?.user_id ?? project.user_id}
              existingGoalCount={goals?.filter((g: any) => !g.parent_id).length ?? 0}
            />
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <StageRoadmap
                goals={goals}
                projectId={id!}
                projectTitle={project.title}
                contract={contract}
                milestones={milestones}
                collaborators={collaborators}
                isCollaborative={project.project_type === "collaborative"}
                isLocked={isLocked}
              />
            </div>
            <div className="space-y-4">
              {isPaid && (
                <RoadmapLockFlow
                  projectId={id!}
                  project={project}
                  goals={goals}
                  contract={contract}
                  collaborators={collaborators}
                />
              )}
              {isPaid && contract && (
                <ProjectControls
                  projectId={id!}
                  contractId={contract.id}
                  contractStatus={contract.status}
                />
              )}
              {isPaid && contract && (
                <ProjectDisputes
                  projectId={id!}
                  contractId={contract.id}
                  milestones={milestones}
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="space-y-6">
          <RoadmapCalendarView goals={goals} projectId={id!} />
        </TabsContent>

        {/* BOARD */}
        <TabsContent value="board" className="space-y-4">
          <BoardMasonry
            deliverables={deliverables as any}
            showFilters
            canManage={canManageProject}
            onAdd={() => toast.info("Use the Roadmap tab to attach files to deliverables.")}
          />
          <div className="pt-4 border-t border-border">
            <ProjectTools
              projectId={id!}
              projectTitle={project.title}
              smartboardDetails={smartboardDetails}
              onCreateSmartboard={() => createSmartboard.mutate()}
              onUnlinkSmartboard={(sbId: string) => unlinkSmartboard.mutate(sbId)}
              smartboardCap={smartboardCap}
              isCreating={createSmartboard.isPending}
            />
          </div>
        </TabsContent>

        {/* STORY */}
        <TabsContent value="story" className="space-y-8">
          <div className="max-w-3xl space-y-8">
            <InlineProjectDescription
              projectId={id!}
              description={(project as any).description ?? null}
              canManage={canManageProject}
            />
            <StoryUpdates projectId={id!} canManage={canManageProject} />
          </div>
        </TabsContent>

        {/* TEAM */}
        <TabsContent value="team" className="space-y-8">
          <Collaborators projectId={id!} isCollaborative={project.project_type === "collaborative"} />
          <ProjectBackers projectId={id!} />
        </TabsContent>

        {isPaid && (
          <TabsContent value="budget" className="space-y-6">
            <ProjectBudget project={project} goals={goals} milestones={milestones} />
            {contract && user?.id === contract.specialist_id && (
              <RevenueSplitConfig contractId={contract.id} />
            )}
          </TabsContent>
        )}
        </Tabs>

        {/* Editor side rail — sticky on desktop */}
        <aside className="space-y-4 lg:sticky lg:top-6 self-start order-first lg:order-none">
          {canManageProject && (
            <EditorSideRail
              isPublic={(project as any).is_public ?? false}
              publicSlug={(project as any).public_slug ?? null}
              projectTitle={project.title}
              cheerCount={(project as any).cheer_count ?? 0}
              stagesTotal={milestones?.length ?? 0}
              stagesComplete={milestones?.filter((m: any) => m.status === "approved" || m.status === "released").length ?? 0}
            />
          )}
          {!canManageProject && (
            <SupportProjectCard
              projectId={id!}
              projectTitle={project.title}
              isPublic={(project as any).is_public ?? false}
              ownerName={owner?.display_name ?? owner?.username ?? null}
            />
          )}
          <ProjectCoinLiveCard linkedTokenId={(project as any).linked_token_id ?? null} />
        </aside>
      </div>

      <TokenizeBottomCta
        project={project as any}
        linkedTokenTicker={null}
        stagesPct={(() => {
          const topStages = (goals ?? []).filter((g: any) => !g.parent_id);
          if (topStages.length === 0) return 0;
          const done = topStages.filter((g: any) => {
            const s = (g.status || "").toLowerCase();
            return s === "completed" || s === "shipped" || s === "done";
          }).length;
          return Math.round((done / topStages.length) * 100);
        })()}
      />

    </div>
  );
};


export default ProjectDetailPage;
