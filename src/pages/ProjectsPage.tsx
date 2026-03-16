import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

const COLORS = ["#7c3aed", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];

const ProjectsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState(COLORS[0]);
  const [projectType, setProjectType] = useState<"paid" | "collaborative">("paid");

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({
        title,
        description,
        cover_color: coverColor,
        user_id: user!.id,
        project_type: projectType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      toast.success("Project created!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground">Manage your creative projects</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createProject.mutate(); }} className="space-y-4">
              <Input placeholder="Project title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCoverColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${coverColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface-card h-48 animate-pulse" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground">No projects yet. Start creating!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/projects/${project.id}`} className="block">
                <div className="surface-card overflow-hidden transition-all hover:border-primary/30 hover:glow-primary">
                  <div className="h-2" style={{ backgroundColor: project.cover_color ?? "#7c3aed" }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold text-foreground truncate">{project.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{project.description || "No description"}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.preventDefault(); deleteProject.mutate(project.id); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                        {project.status}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
