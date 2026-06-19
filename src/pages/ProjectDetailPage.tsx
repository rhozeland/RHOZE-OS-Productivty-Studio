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
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Check, X, Lock, ArrowLeft, Plus, Eye, Calendar as CalendarIcon, ListChecks, Music, Video as VideoIcon, Image as ImageIcon, FileText, MoreHorizontal, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { format, isPast, isToday } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import ProjectHero from "@/components/project/shared/ProjectHero";
import MilestoneTrack from "@/components/project/shared/MilestoneTrack";
import BoardMasonry from "@/components/project/shared/BoardMasonry";
import ProjectBoardCanvas from "@/components/project/board/ProjectBoardCanvas";
import AddBoardAssetDialog from "@/components/project/AddBoardAssetDialog";
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
import ProjectRolloutTab from "@/components/project/ProjectRolloutTab";
import AttachCoinToProjectCard from "@/components/project/AttachCoinToProjectCard";
import RoadmapCopilot from "@/components/project/RoadmapCopilot";
import TokenizeProjectCta from "@/components/project/TokenizeProjectCta";
import EditorSideRail from "@/components/project/shared/EditorSideRail";
import ProjectFeaturedVisual from "@/components/project/ProjectFeaturedVisual";
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

  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, completed, due_date, priority")
        .eq("project_id", id!)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({ completed }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("tasks").insert({ project_id: id!, user_id: user.id, title });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", id] }),
    onError: (e: any) => toast.error(e.message),
  });
  const [newTaskTitle, setNewTaskTitle] = useState("");

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

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addAssetOpen, setAddAssetOpen] = useState(false);

  const archiveProject = useMutation({
    mutationFn: async (nextStatus: "archived" | "active") => {
      const { error } = await supabase
        .from("projects")
        .update({ status: nextStatus })
        .eq("id", id!);
      if (error) throw error;
      return nextStatus;
    },
    onSuccess: (nextStatus) => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(nextStatus === "archived" ? "Project archived" : "Project restored");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      navigate("/studio");
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

  const rawTab = searchParams.get("tab") ?? "overview";
  // Timeline tab merged into Roadmap — redirect legacy deeplinks.
  const activeTab = rawTab === "timeline" ? "roadmap" : rawTab;
  const setTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const [roadmapView, setRoadmapView] = useState<"list" | "calendar">(
    rawTab === "timeline" ? "calendar" : "list",
  );

  // When the project was just created via "Build with AI", land on the
  // Roadmap tab so <AiRoadmapDraftButton /> mounts and its auto-fire effect
  // runs immediately — otherwise the drafting modal only appears after the
  // user manually clicks Roadmap.
  useEffect(() => {
    let mode: string | null = null;
    try { mode = sessionStorage.getItem("startProjectMode"); } catch { /* ignore */ }
    if (mode === "ai" && activeTab !== "roadmap") {
      setTab("roadmap");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {isOwner && !editingHeader && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Project actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {project.status === "archived" ? (
                <DropdownMenuItem onClick={() => archiveProject.mutate("active")}>
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Restore project
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => archiveProject.mutate("archived")}>
                  <Archive className="mr-2 h-4 w-4" /> Archive project
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {project.status === "archived" && (
        <div className="mt-3 px-1">
          <Badge variant="outline" className="gap-1 text-[10px] bg-muted text-muted-foreground">
            <Archive className="h-2.5 w-2.5" /> Archived
          </Badge>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove “{project.title}” and all of its milestones, tasks,
              board items, story updates and uploads. This cannot be undone. If you only want to
              hide it from your workspace, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProject.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* TABS + EDITOR SIDE RAIL */}
      {/* Top support rail — highlighted above the workspace tabs */}
      {isOwner && (
        <div className="mt-6">
          <EditorSideRail
            orientation="horizontal"
            isPublic={(project as any).is_public ?? false}
            publicSlug={(project as any).public_slug ?? null}
            projectTitle={project.title}
            cheerCount={(project as any).cheer_count ?? 0}
            stagesTotal={overviewStages.length}
            stagesComplete={overviewDoneCount}
          />
        </div>
      )}
      {!canManageProject && !isCollaborator && (
        <div className="mt-6">
          <SupportProjectCard
            projectId={id!}
            projectTitle={project.title}
            isPublic={(project as any).is_public ?? false}
            ownerName={owner?.display_name ?? owner?.username ?? null}
          />
        </div>
      )}
      <ProjectCoinLiveCard linkedTokenId={(project as any).linked_token_id ?? null} />

      {/* TABS — now full-width */}
      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={setTab} className="w-full min-w-0">

          <TabsList
            className="sticky top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mb-6 w-[calc(100%+2rem)] md:w-full justify-start overflow-x-auto flex-nowrap shrink-0 h-auto gap-6 rounded-none border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-0"
          >
            <TabsTrigger value="overview" className={TAB_TRIGGER}>Overview</TabsTrigger>
            <TabsTrigger value="roadmap" className={TAB_TRIGGER}>Roadmap</TabsTrigger>
            <TabsTrigger value="rollout" className={TAB_TRIGGER}>Rollout</TabsTrigger>
            <TabsTrigger value="board" className={TAB_TRIGGER}>Board</TabsTrigger>
            <TabsTrigger value="story" className={TAB_TRIGGER}>Story</TabsTrigger>
            <TabsTrigger value="team" className={TAB_TRIGGER}>Team</TabsTrigger>
            {isPaid && <TabsTrigger value="budget" className={TAB_TRIGGER}>Budget</TabsTrigger>}
          </TabsList>

          {/* OVERVIEW — owner workspace */}
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
              const featured = mediaDeliverables[0];
              const featuredKind = featured
                ? (featured.mime_type || "").startsWith("video/")
                  ? "video"
                  : (featured.mime_type || "").startsWith("audio/")
                    ? "audio"
                    : "image"
                : null;

              const taskList = tasks ?? [];
              const taskDone = taskList.filter((t: any) => t.completed).length;

              return (
                <>
                  {/* Top row: Roadmap+Timeline · Tasks · Visual */}
                  <div className="grid gap-4 md:grid-cols-12">
                    {/* widths: roadmap 4 · tasks 3 · visual 5 */}
                    {/* Roadmap + Timeline combined */}
                    <button
                      onClick={() => setTab("roadmap")}
                      className="md:col-span-4 text-left rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 via-card to-indigo-500/5 p-4 transition-all hover:border-primary/40 hover:shadow-md min-h-[240px] flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-violet-600 dark:text-violet-300">Roadmap · Timeline</div>
                          <p className="font-display text-xl font-bold text-foreground mt-1 tabular-nums">
                            {total ? `${done}/${total}` : "—"}
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{total ? `${pct}%` : "no stages"}</span>
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">Open →</span>
                      </div>
                      {total > 0 && <Progress value={pct} className="mt-2 h-1.5" />}
                      <div className="mt-3 flex-1" onClick={(e) => e.stopPropagation()}>
                        {upcoming.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No upcoming deadlines.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {upcoming.slice(0, 3).map((m: any) => {
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
                    </button>

                    {/* Tasks */}
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
                            <label key={t.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!t.completed}
                                onChange={(e) => toggleTask.mutate({ taskId: t.id, completed: e.target.checked })}
                                className="h-3.5 w-3.5 rounded border-border accent-primary"
                              />
                              <span className={`text-xs leading-snug flex-1 ${t.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {t.title}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      {canManageProject && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const v = newTaskTitle.trim();
                            if (!v) return;
                            addTask.mutate(v);
                            setNewTaskTitle("");
                          }}
                          className="mt-2 flex items-center gap-1.5"
                        >
                          <Input
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Add task…"
                            className="h-7 text-xs"
                          />
                          <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      )}
                    </div>

                    {/* Visual — official project media */}
                    <div className="md:col-span-5">
                      <ProjectFeaturedVisual
                        projectId={project.id}
                        featuredUrl={(project as any).featured_visual_url}
                        featuredExternalUrl={(project as any).featured_visual_external_url}
                        featuredMime={(project as any).featured_visual_mime}
                        featuredTitle={(project as any).featured_visual_title}
                        canManage={canManageProject}
                      />
                    </div>
                  </div>




                  {/* Board — wide card matching the row above */}
                  <button
                    onClick={() => setTab("board")}
                    className="block w-full text-left rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex items-end justify-between gap-3 mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Board</div>
                        <p className="font-display text-base font-semibold text-foreground mt-0.5">Mood, references & uploads</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Open board →</span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {mediaDeliverables.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
                          <p className="text-sm text-muted-foreground">No board items yet.</p>
                          <p className="text-[11px] text-muted-foreground/70 mt-1">Upload visuals, audio clips and colours from the Roadmap tab — they'll cluster here as a creative board.</p>
                        </div>
                      ) : (
                        <BoardMasonry
                          deliverables={mediaDeliverables as any}
                          limit={12}
                          onSeeMore={() => setTab("board")}
                        />
                      )}
                    </div>
                  </button>

                </>
              );
            })()}
          </TabsContent>



        {/* ROADMAP */}
        <TabsContent value="roadmap" className="space-y-6">
          <SignedAgreementCard projectId={id!} contractId={contract?.id} />


          {isOwner && (
            <AttachCoinToProjectCard
              projectId={project.id}
              linkedTokenId={(project as any).linked_token_id ?? null}
            />
          )}

          {isOwner && <RoadmapCopilot projectId={id!} />}


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

          {isOwner && !isLocked && (goals?.filter((g: any) => !g.parent_id).length ?? 0) < 2 && (
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
            <div className="lg:col-span-2 space-y-3">
              {/* View toggle: List ↔ Calendar (Timeline merged in) */}
              <div className="flex items-center justify-end">
                <div className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setRoadmapView("list")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      roadmapView === "list"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoadmapView("calendar")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      roadmapView === "calendar"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Calendar
                  </button>
                </div>
              </div>

              {roadmapView === "list" ? (
                <StageRoadmap
                  goals={goals}
                  projectId={id!}
                  projectTitle={project.title}
                  contract={contract}
                  milestones={milestones}
                  collaborators={collaborators}
                  isCollaborative={project.project_type === "collaborative"}
                  isLocked={isLocked}
                  isOwner={isOwner}
                />
              ) : (
                <RoadmapCalendarView goals={goals} projectId={id!} />
              )}
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

        {/* ROLLOUT — empty-canvas marketing planner w/ AI sidekick */}
        <TabsContent value="rollout" className="space-y-6">
          <ProjectRolloutTab
            projectId={id!}
            projectOwnerId={project.user_id}
            ownerProfileId={project.user_id}
            isOwner={isOwner}
            existingGoalCount={goals?.filter((g: any) => !g.parent_id).length ?? 0}
          />
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="space-y-6">
          <RoadmapCalendarView goals={goals} projectId={id!} />
        </TabsContent>

        <TabsContent value="board" className="space-y-4">
          {/* Desktop/tablet: real whiteboard. Mobile (<sm): masonry fallback. */}
          <div className="hidden sm:block">
            <ProjectBoardCanvas
              projectId={id!}
              canManage={canManageProject}
              onAdd={() => setAddAssetOpen(true)}
            />
          </div>
          <div className="sm:hidden space-y-3">
            {canManageProject && (
              <div className="flex justify-end">
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full h-9 w-9"
                  onClick={() => setAddAssetOpen(true)}
                  aria-label="Add asset"
                  title="Add asset"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            <BoardMasonry
              deliverables={deliverables as any}
              canManage={canManageProject}
              onAdd={() => setAddAssetOpen(true)}
              projectId={id!}
              emptyStateVariant="large"
            />
          </div>
          <AddBoardAssetDialog
            projectId={id!}
            open={addAssetOpen}
            onOpenChange={setAddAssetOpen}
          />
        </TabsContent>



        {/* STORY */}
        <TabsContent value="story" className="space-y-8">
          <div className="max-w-3xl space-y-8">
            <InlineProjectDescription
              projectId={id!}
              description={(project as any).description ?? null}
              canManage={canManageProject}
            />
            <StoryUpdates projectId={id!} canManage={canManageProject} isOwner={isOwner} />
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
