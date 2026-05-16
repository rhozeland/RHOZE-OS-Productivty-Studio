import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ProjectVision from "@/components/project/ProjectVision";
import RoadmapListView from "@/components/project/RoadmapListView";
import RoadmapCalendarView from "@/components/project/RoadmapCalendarView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, LayoutGrid, Link2, X, FileDown, Pencil, Check,
  Milestone, ListTodo, CalendarDays, Lock, Unlock, ArrowLeft,
} from "lucide-react";
import { exportProjectPDF } from "@/lib/export-project-pdf";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StageRoadmap from "@/components/project/StageRoadmap";
import ProjectBudget from "@/components/project/ProjectBudget";
import ProgressChart from "@/components/project/ProgressChart";
import Timeline from "@/components/project/Timeline";
import Collaborators from "@/components/project/Collaborators";
import RoadmapLockFlow from "@/components/project/RoadmapLockFlow";
import ProjectDisputes from "@/components/project/ProjectDisputes";
import ProjectControls from "@/components/project/ProjectControls";
import RevenueSplitConfig from "@/components/revenue/RevenueSplitConfig";
import ProjectTools from "@/components/project/ProjectTools";
import DropRoomLauncher from "@/components/project/DropRoomLauncher";
import { useProjectRole } from "@/hooks/useProjectRole";
import { getHoldTier } from "@/lib/tier-matrix";

// Tier-based cap on smartboards per project. Play tier is unlimited.
const SMARTBOARD_CAP_BY_TIER: Record<string, number> = {
  spark: 2,
  bloom: 5,
  glow: 12,
  play: Infinity,
};

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canManage: canManageProject } = useProjectRole(id);

  // Tier comes from in-app $RHOZE balance (user_credits), not on-chain wallet.
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

  const { data: approvals } = useQuery({
    queryKey: ["project-approvals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_approvals" as any)
        .select("*")
        .eq("project_id", id!);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: goals } = useQuery({
    queryKey: ["project-goals", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_goals").select("*").eq("project_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contract } = useQuery({
    queryKey: ["project-contract", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_contracts").select("*").eq("project_id", id!).maybeSingle();
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

  // Linked smartboards
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

  // Smartboards are now project-scoped & team-shared. Hitting "New" spins up
  // a fresh board owned by the creator and auto-links it. No more picking
  // from a dropdown of dusty old boards — every project gets clean canvases.
  const createSmartboard = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (smartboardDetails && smartboardDetails.length >= smartboardCap) {
        throw new Error(
          `You've hit your tier's smartboard cap (${smartboardCap}) for this project. Upgrade to add more.`,
        );
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
      toast.success("Smartboard removed from project");
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

  if (!project) return <div className="text-muted-foreground">Loading...</div>;

  const availableToLink = mySmartboards?.filter((s) => !linkedIds.includes(s.id)) ?? [];
  const isPaid = project.project_type !== "collaborative";
  const isLocked = contract?.status === "active" || contract?.status === "completed";

  const startEditing = () => {
    setEditTitle(project.title);
    setEditDescription(project.description || "");
    setEditingHeader(true);
  };

  return (
    <div className="space-y-6">
      {/* Back link — projects are usually opened from the messages inbox or
          a profile, so a real back affordance saves a confused round-trip
          through the side nav. */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">

        <div className="flex-1 min-w-0">
          {editingHeader ? (
            <div className="space-y-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-display text-2xl font-bold"
                autoFocus
              />
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a project description..."
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateHeader.mutate()}
                  disabled={!editTitle.trim() || updateHeader.isPending}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingHeader(false)}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={
                "group rounded-lg p-1 -m-1 transition-colors " +
                (canManageProject ? "cursor-pointer hover:bg-muted/40" : "")
              }
              onClick={canManageProject ? startEditing : undefined}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: project.cover_color ?? "hsl(var(--primary))" }}
                />
                <h1 className="font-display text-3xl font-bold text-foreground">{project.title}</h1>
                {isLocked && (
                  <Badge variant="outline" className="gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    <Lock className="h-3 w-3" /> Locked
                  </Badge>
                )}
                <Pencil className={"h-4 w-4 text-muted-foreground transition-opacity " + (canManageProject ? "opacity-0 group-hover:opacity-100" : "hidden")} />
              </div>
              <p className="mt-1 text-muted-foreground pl-7">
                {project.description || (
                  <span className="italic text-muted-foreground/60">Click to add a description...</span>
                )}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              toast.promise(
                exportProjectPDF(
                  project as any,
                  goals,
                  approvals as any,
                  contract ? {
                    status: contract.status,
                    total_credits: contract.total_credits,
                    released_credits: contract.released_credits,
                    escrowed_credits: contract.escrowed_credits,
                  } : undefined
                ),
                {
                  loading: "Generating PDF...",
                  success: "PDF downloaded!",
                  error: "Failed to generate PDF",
                }
              );
            }}
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Progress Overview — Drop Room launcher lives in the header so a
          live collab space is always one tap away without a dedicated tab. */}
      <ProgressChart
        goals={goals}
        headerAction={
          <DropRoomLauncher projectId={id!} projectTitle={project.title} />
        }
      />

      <Tabs defaultValue="roadmap" className="w-full">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto flex-nowrap shrink-0">
          <TabsTrigger value="roadmap" className="shrink-0">Roadmap</TabsTrigger>
          <TabsTrigger value="vision" className="shrink-0">Scope</TabsTrigger>
          {isPaid && <TabsTrigger value="budget" className="shrink-0">Budget</TabsTrigger>}
          <TabsTrigger value="team" className="shrink-0">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="space-y-6">
          {/* Drop Rooms + Smartboards live above the roadmap so they're one
              click away — anyone on the project can spin up a quick collab
              space or pin a moodboard without hunting for a separate tab. */}
          <ProjectTools
            projectId={id!}
            projectTitle={project.title}
            smartboardDetails={smartboardDetails}
            onLinkSmartboard={() => setLinkDialogOpen(true)}
            onUnlinkSmartboard={(sbId: string) => unlinkSmartboard.mutate(sbId)}
          />

          <Tabs defaultValue="stages" className="w-full">
            <TabsList className="h-9">
              <TabsTrigger value="stages" className="gap-1.5 text-xs">
                <Milestone className="h-3.5 w-3.5" /> Stages
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5 text-xs">
                <ListTodo className="h-3.5 w-3.5" /> List
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5" /> Calendar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stages" className="space-y-6 mt-4">
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
                  <Timeline goals={goals} />
                  {/* Roadmap Lock Flow - only for paid projects */}
                  {isPaid && (
                    <RoadmapLockFlow
                      projectId={id!}
                      project={project}
                      goals={goals}
                      contract={contract}
                      collaborators={collaborators}
                    />
                  )}
                  {/* Project Controls - early completion */}
                  {isPaid && contract && (
                    <ProjectControls
                      projectId={id!}
                      contractId={contract.id}
                      contractStatus={contract.status}
                    />
                  )}
                  {/* Disputes */}
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

            <TabsContent value="list" className="mt-4 space-y-6">
              <RoadmapListView goals={goals} projectId={id!} />
            </TabsContent>

            <TabsContent value="calendar" className="mt-4">
              <RoadmapCalendarView goals={goals} projectId={id!} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="vision" className="space-y-6">
          <ProjectVision project={project} projectId={id!} />
        </TabsContent>

        {isPaid && (
          <TabsContent value="budget" className="space-y-6">
            <ProjectBudget project={project} goals={goals} milestones={milestones} />
            {contract && user?.id === contract.specialist_id && (
              <RevenueSplitConfig contractId={contract.id} />
            )}
          </TabsContent>
        )}

        <TabsContent value="team">
          <Collaborators projectId={id!} isCollaborative={project.project_type === "collaborative"} />
        </TabsContent>

      </Tabs>

      {/* Link Smartboard Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Link a Smartboard</DialogTitle>
          </DialogHeader>
          {availableToLink.length === 0 ? (
            <div className="text-center py-8">
              <LayoutGrid className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {mySmartboards?.length === 0
                  ? "You don't have any smartboards yet"
                  : "All your smartboards are already linked"}
              </p>
              <Link to="/smartboards">
                <Button variant="outline" className="mt-3 rounded-full" size="sm">
                  Create a Smartboard
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {availableToLink.map((board) => (
                <button
                  key={board.id}
                  onClick={() => { linkSmartboard.mutate(board.id); setLinkDialogOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted/60 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg shrink-0" style={{ background: board.cover_color || "hsl(var(--muted))" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{board.title}</p>
                    {board.description && <p className="text-xs text-muted-foreground truncate">{board.description}</p>}
                  </div>
                  <Link2 className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetailPage;
