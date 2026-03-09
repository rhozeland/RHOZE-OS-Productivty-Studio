import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Upload, Image, X } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import GoalsList from "@/components/project/GoalsList";
import ProgressChart from "@/components/project/ProgressChart";
import Timeline from "@/components/project/Timeline";
import Collaborators from "@/components/project/Collaborators";
import MilestoneTracker from "@/components/project/MilestoneTracker";

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: moodboardItems } = useQuery({
    queryKey: ["moodboard", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("moodboard_items").select("*").eq("project_id", id!).order("created_at", { ascending: false });
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} is too large (max 20MB)`); continue; }
        const fileExt = file.name.split(".").pop();
        const filePath = `${user.id}/${id}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("moodboard").upload(filePath, file);
        if (uploadError) { toast.error(`Failed to upload ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("moodboard").getPublicUrl(filePath);
        const { error: dbError } = await supabase.from("moodboard_items").insert({ project_id: id!, user_id: user.id, file_url: urlData.publicUrl, file_name: file.name, file_type: file.type });
        if (dbError) toast.error(`Failed to save ${file.name}`);
      }
      queryClient.invalidateQueries({ queryKey: ["moodboard", id] });
      toast.success("Files uploaded!");
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const deleteMoodboardItem = useMutation({
    mutationFn: async (item: { id: string; file_url: string }) => {
      const url = new URL(item.file_url);
      const pathParts = url.pathname.split("/storage/v1/object/public/moodboard/");
      if (pathParts[1]) await supabase.storage.from("moodboard").remove([decodeURIComponent(pathParts[1])]);
      const { error } = await supabase.from("moodboard_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["moodboard", id] }); toast.success("Removed"); },
  });

  if (!project) return <div className="text-muted-foreground">Loading...</div>;

  const isImage = (type: string | null) => type?.startsWith("image/");

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
          <TabsTrigger value="moodboard">Moodboard</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <GoalsList goals={goals} projectId={id!} />
            <Timeline goals={goals} />
          </div>
        </TabsContent>

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

        <TabsContent value="moodboard">
          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="h-5 w-5 text-accent" />
                <h2 className="font-display text-lg font-semibold text-foreground">Moodboard</h2>
              </div>
              <div>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="mr-2 h-4 w-4" />{uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
            {(!moodboardItems || moodboardItems.length === 0) ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drop images or click to upload</p>
                <p className="mt-1 text-xs text-muted-foreground">Supports images, videos, PDFs (max 20MB)</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {moodboardItems.map((item, i) => (
                  <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                    {isImage(item.file_type) ? (
                      <img src={item.file_url} alt={item.file_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-3">
                        <Image className="mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-center text-xs text-muted-foreground truncate w-full">{item.file_name}</p>
                      </div>
                    )}
                    <button onClick={() => deleteMoodboardItem.mutate({ id: item.id, file_url: item.file_url })} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
                <div className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors" onClick={() => fileInputRef.current?.click()}>
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
    </div>
  );
};

export default ProjectDetailPage;
