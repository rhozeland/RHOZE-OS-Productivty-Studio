import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, LayoutGrid, Link2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StageRoadmap from "@/components/project/StageRoadmap";
import ProjectBudget from "@/components/project/ProjectBudget";
import ProgressChart from "@/components/project/ProgressChart";
import Timeline from "@/components/project/Timeline";
import Collaborators from "@/components/project/Collaborators";
import MilestoneTracker from "@/components/project/MilestoneTracker";

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("project_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({ title: newTask, project_id: id!, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["project-tasks", id] }); setNewTask(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({ completed }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", id] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", id] }),
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

  if (!project) return <div className="text-muted-foreground">Loading...</div>;

  const availableToLink = mySmartboards?.filter((s) => !linkedIds.includes(s.id)) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: project.cover_color ?? "#7c3aed" }} />
          <h1 className="font-display text-3xl font-bold text-foreground">{project.title}</h1>
        </div>
        <p className="mt-1 text-muted-foreground">{project.description || "No description"}</p>
      </div>

      {/* Progress Overview */}
      <ProgressChart goals={goals} tasks={tasks} />

      <Tabs defaultValue="roadmap" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          {contract && <TabsTrigger value="milestones">Milestones</TabsTrigger>}
          <TabsTrigger value="smartboards">Smartboards</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <StageRoadmap goals={goals} projectId={id!} />
            </div>
            <div className="space-y-6">
              <ProjectBudget project={project} goals={goals} />
              <Timeline goals={goals} />
            </div>
          </div>
        </TabsContent>

        {contract && (
          <TabsContent value="milestones">
            <MilestoneTracker contractId={contract.id} />
          </TabsContent>
        )}

        <TabsContent value="tasks">
          <div className="surface-card p-6">
            <h2 className="mb-4 font-display text-lg font-semibold text-foreground">Tasks</h2>
            <form onSubmit={(e) => { e.preventDefault(); if (newTask.trim()) addTask.mutate(); }} className="mb-4 flex gap-2">
              <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task..." className="flex-1" />
              <Button type="submit" size="icon" disabled={!newTask.trim()}><Plus className="h-4 w-4" /></Button>
            </form>
            <div className="space-y-2">
              {tasks?.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <Checkbox checked={task.completed ?? false} onCheckedChange={(checked) => toggleTask.mutate({ taskId: task.id, completed: !!checked })} />
                  <span className={`flex-1 text-sm ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.title}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTask.mutate(task.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
              {tasks?.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet</p>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="smartboards">
          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-semibold text-foreground">Linked Smartboards</h2>
              </div>
              <Button variant="outline" onClick={() => setLinkDialogOpen(true)} className="gap-1.5">
                <Link2 className="h-4 w-4" /> Link Smartboard
              </Button>
            </div>

            {(!smartboardDetails || smartboardDetails.length === 0) ? (
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setLinkDialogOpen(true)}
              >
                <LayoutGrid className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No smartboards linked yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Link your smartboards as project resources</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {smartboardDetails.map((board, i) => (
                  <motion.div
                    key={board.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="group relative overflow-hidden rounded-xl border border-border bg-card hover:shadow-md transition-all"
                  >
                    <Link to={`/smartboards/${board.id}`} className="block p-4">
                      <div
                        className="mb-3 h-20 rounded-lg"
                        style={{ background: board.cover_color || "hsl(var(--muted))" }}
                      />
                      <h3 className="font-display font-semibold text-foreground text-sm truncate">{board.title}</h3>
                      {board.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{board.description}</p>
                      )}
                    </Link>
                    <button
                      onClick={() => unlinkSmartboard.mutate(board.id)}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
                <div
                  className="flex items-center justify-center rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/40 transition-colors min-h-[140px]"
                  onClick={() => setLinkDialogOpen(true)}
                >
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="team">
          <Collaborators projectId={id!} />
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
