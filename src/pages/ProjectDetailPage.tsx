import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, LayoutGrid, Link2, X, FileDown, Pencil, Check, Milestone, ListTodo } from "lucide-react";
import { exportProjectPDF } from "@/lib/export-project-pdf";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StageRoadmap from "@/components/project/StageRoadmap";
import ProjectBudget from "@/components/project/ProjectBudget";
import ProgressChart from "@/components/project/ProgressChart";
import Timeline from "@/components/project/Timeline";
import Collaborators from "@/components/project/Collaborators";
import MilestoneTracker from "@/components/project/MilestoneTracker";
import ProjectApproval from "@/components/project/ProjectApproval";

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
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

  // All user's smartboards for linking
  const { data: mySmartboards } = useQuery({
    queryKey: ["my-smartboards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("smartboards").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && linkDialogOpen,
  });


  const linkSmartboard = useMutation({
    mutationFn: async (smartboardId: string) => {
      const { error } = await supabase.from("project_smartboards" as any).insert({
        project_id: id!, smartboard_id: smartboardId, linked_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-smartboards", id] });
      toast.success("Smartboard linked!");
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
      toast.success("Smartboard unlinked");
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

  const startEditing = () => {
    setEditTitle(project.title);
    setEditDescription(project.description || "");
    setEditingHeader(true);
  };

  return (
    <div className="space-y-6">
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
              className="group cursor-pointer rounded-lg p-1 -m-1 hover:bg-muted/40 transition-colors"
              onClick={startEditing}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: project.cover_color ?? "hsl(var(--primary))" }}
                />
                <h1 className="font-display text-3xl font-bold text-foreground">{project.title}</h1>
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="mt-1 text-muted-foreground pl-7">
                {project.description || (
                  <span className="italic text-muted-foreground/60">Click to add a description...</span>
                )}
              </p>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => {
            toast.promise(exportProjectPDF(project as any, goals, approvals as any), {
              loading: "Generating PDF...",
              success: "PDF downloaded!",
              error: "Failed to generate PDF",
            });
          }}
        >
          <FileDown className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Progress Overview */}
      <ProgressChart goals={goals} />

      <Tabs defaultValue="roadmap" className="w-full">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="vision">Scope</TabsTrigger>
          {project.project_type !== "collaborative" && (
            <TabsTrigger value="budget">Budget</TabsTrigger>
          )}
          
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="space-y-4">
          <Tabs defaultValue="stages" className="w-full">
            <TabsList className="h-9">
              <TabsTrigger value="stages" className="gap-1.5 text-xs">
                <Milestone className="h-3.5 w-3.5" /> Stages
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5 text-xs">
                <ListTodo className="h-3.5 w-3.5" /> List
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
                    isCollaborative={project.project_type === "collaborative"}
                  />
                </div>
                <div>
                  <Timeline goals={goals} />
                </div>
              </div>
              <RoadmapCalendarView goals={goals} projectId={id!} />
            </TabsContent>

            <TabsContent value="list" className="mt-4 space-y-6">
              <RoadmapListView goals={goals} projectId={id!} />
              <RoadmapCalendarView goals={goals} projectId={id!} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="vision">
          <ProjectVision
            project={project}
            projectId={id!}
            smartboardDetails={smartboardDetails}
            linkedIds={linkedIds}
            onLinkSmartboard={() => setLinkDialogOpen(true)}
            onUnlinkSmartboard={(sbId: string) => unlinkSmartboard.mutate(sbId)}
          />
        </TabsContent>

        {project.project_type !== "collaborative" && (
          <TabsContent value="budget">
            <ProjectBudget project={project} goals={goals} />
          </TabsContent>
        )}

        {project.project_type !== "collaborative" && contract && (
          <TabsContent value="milestones">
            <MilestoneTracker contractId={contract.id} />
          </TabsContent>
        )}


        <TabsContent value="approval">
          <ProjectApproval
            projectId={id!}
            projectTitle={project.title}
            clientName={(project as any).client_name}
          />
        </TabsContent>


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
