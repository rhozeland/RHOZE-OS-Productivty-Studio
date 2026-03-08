import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");

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

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        title: newTask,
        project_id: id!,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
      setNewTask("");
    },
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

  if (!project) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: project.cover_color ?? "#7c3aed" }} />
          <h1 className="font-display text-3xl font-bold text-foreground">{project.title}</h1>
        </div>
        <p className="mt-1 text-muted-foreground">{project.description || "No description"}</p>
      </div>

      <div className="surface-card p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">Tasks</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); if (newTask.trim()) addTask.mutate(); }}
          className="mb-4 flex gap-2"
        >
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newTask.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        <div className="space-y-2">
          {tasks?.map((task) => (
            <div key={task.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Checkbox
                checked={task.completed ?? false}
                onCheckedChange={(checked) => toggleTask.mutate({ taskId: task.id, completed: !!checked })}
              />
              <span className={`flex-1 text-sm ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {task.title}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTask.mutate(task.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
          {tasks?.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet</p>}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
