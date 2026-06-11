import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, MoreHorizontal, Trash2, Users, User, Calendar, CheckCircle2, Clock, Sparkles, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fetchCreatorContext } from "@/lib/creator-context";
import { composeMilestoneDescription, chainMilestoneDates, type DraftedMilestone } from "@/hooks/useAiRoadmapDraft";

const COLORS = ["#7c3aed", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];

const statusConfig: Record<string, { icon: typeof Clock; label: string; className: string }> = {
  active: { icon: Clock, label: "In Progress", className: "bg-primary/10 text-primary" },
  completed: { icon: CheckCircle2, label: "Completed", className: "bg-emerald-500/10 text-emerald-500" },
  paused: { icon: Clock, label: "Paused", className: "bg-amber-500/10 text-amber-500" },
};

const ProjectsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverColor, setCoverColor] = useState(COLORS[0]);
  const [projectType, setProjectType] = useState<"paid" | "collaborative">("paid");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [generatingTitle, setGeneratingTitle] = useState(false);

  const regenerateTitle = async () => {
    const promptText = description.trim();
    if (promptText.length < 3) {
      toast.error("Write a brief first so AI has something to work with.");
      return;
    }
    setGeneratingTitle(true);
    try {
      const { data: gen, error: genErr } = await supabase.functions.invoke(
        "generate-project-title",
        { body: { prompt: promptText } },
      );
      if (genErr) throw genErr;
      const next = (gen as any)?.title?.trim();
      if (!next) throw new Error("AI returned an empty title");
      setTitle(next);
      toast.success("New title drafted");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate a title");
    } finally {
      setGeneratingTitle(false);
    }
  };

  const { data: projects, isLoading } = useQuery({
    queryKey: ["my-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch collaborator counts per project
  const { data: collabCounts } = useQuery({
    queryKey: ["project-collab-counts"],
    queryFn: async () => {
      if (!projects?.length) return {};
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("project_id")
        .in("project_id", projects.map((p) => p.id));
      if (error) return {};
      const counts: Record<string, number> = {};
      data.forEach((c) => { counts[c.project_id] = (counts[c.project_id] || 0) + 1; });
      return counts;
    },
    enabled: !!projects?.length,
  });

  // Milestone progress per project
  const { data: goalStats } = useQuery({
    queryKey: ["project-goal-stats", projects?.map((p) => p.id).join(",")],
    queryFn: async () => {
      if (!projects?.length) return {} as Record<string, { total: number; done: number }>;
      const { data, error } = await supabase
        .from("project_goals" as any)
        .select("project_id,status")
        .in("project_id", projects.map((p) => p.id));
      if (error) return {};
      const stats: Record<string, { total: number; done: number }> = {};
      (data as any[]).forEach((g) => {
        const s = stats[g.project_id] ?? { total: 0, done: 0 };
        s.total += 1;
        if (["approved", "completed", "done", "shipped"].includes(g.status)) s.done += 1;
        stats[g.project_id] = s;
      });
      return stats;
    },
    enabled: !!projects?.length,
  });

  const createProject = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be signed in to create a project.");
      const promptText = description.trim();
      if (!title.trim() && !promptText) {
        throw new Error("Tell us what you're working on.");
      }

      // Auto-generate a punchy title from the prompt when the user didn't type one.
      let finalTitle = title.trim();
      if (!finalTitle) {
        try {
          const { data: gen, error: genErr } = await supabase.functions.invoke(
            "generate-project-title",
            { body: { prompt: promptText } },
          );
          if (genErr) throw genErr;
          finalTitle = (gen as any)?.title?.trim() || "";
        } catch {
          // Never reuse the raw prompt as the title — fall back to a neutral placeholder.
          finalTitle = "Untitled Project";
        }
        if (!finalTitle) finalTitle = "Untitled Project";
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          title: finalTitle,
          description: promptText || null,
          cover_color: coverColor,
          user_id: user.id,
          project_type: projectType,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    // Optimistic update so the new project appears instantly without a refresh
    onSuccess: async (newProject) => {
      queryClient.setQueryData(["projects"], (old: any[] | undefined) =>
        old ? [newProject, ...old] : [newProject]
      );
      queryClient.invalidateQueries({ queryKey: ["my-projects", user?.id] });
      setOpen(false);
      setTitle("");
      setDescription("");
      toast.success(`"${newProject.title}" created`);

      // v11 Pillar 5: auto-fire AI roadmap draft enriched with the creator's
      // profile + recent works + linked coin so the milestones feel hand-crafted
      // to their style. Background — failure here doesn't surface as an error.
      try {
        const toastId = toast.loading("✨ Drafting your roadmap — reading your works…");
        const specialistCtx = await fetchCreatorContext(user!.id, "Creator");
        const tokenize_intent = !!specialistCtx.token_mint;

        const { data: drafted, error: draftErr } = await supabase.functions.invoke(
          "draft-project-roadmap",
          {
            body: {
              projectName: newProject.title,
              totalBudget: 0,
              tokenize_intent,
              release_type: "other",
              brief: { what: newProject.description ?? undefined },
              specialistProfile: specialistCtx,
            },
          },
        );
        if (draftErr) throw draftErr;
        const milestones = ((drafted as any)?.milestones ?? []) as DraftedMilestone[];
        if (milestones.length) {
          const dates = chainMilestoneDates(milestones);
          const rows = milestones.map((m, i) => ({
            project_id: newProject.id,
            user_id: user!.id,
            title: m.title,
            description: composeMilestoneDescription(m),
            budget_amount: m.suggested_amount,
            sort_order: i,
            parent_id: null,
            stage_date_start: dates[i].stage_date_start,
            stage_date_end: dates[i].stage_date_end,
            due_date: dates[i].due_date,
          })) as any;
          await supabase.from("project_goals" as any).insert(rows);
        }
        toast.success("Roadmap ready — review it on your project page.", { id: toastId });
      } catch {
        // Silent — owner can still click "Draft with AI" inside the project.
      }
    },
    onError: (e: any) => {
      console.error("Create project failed:", e);
      toast.error(e?.message || "Could not create project. Please try again.");
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-projects", user?.id] });
      toast.success("Project deleted");
      setDeleteTarget(null);
    },
  });

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 20 } },
  };

  return (
    <div className="space-y-8">
      {/* Hero Header with blue gradient */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl"
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(210,90%,50%)] via-[hsl(220,80%,60%)] to-[hsl(240,70%,55%)]" />
        {/* Decorative blobs */}
        <div
          className="absolute -top-16 -right-16 w-[300px] h-[300px] rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, hsl(200,100%,75%), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-[250px] h-[250px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(260,80%,70%), transparent 70%)" }}
        />
        <div className="absolute inset-0 grid-overlay opacity-[0.06]" />

        <div className="relative z-10 px-8 py-10 md:px-10 md:py-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-[10px] font-body font-semibold text-white/60 uppercase tracking-[0.25em] mb-2">
              Workspace
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              My Projects
            </h1>
            <p className="text-sm text-white/70 mt-1 max-w-md font-body">
              Every project you've created — manage milestones, collaborators, and progress in one place.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm shadow-lg">
                <Plus className="h-4 w-4" />New Project
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createProject.mutate(); }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  What are you working on?
                </label>
                <Textarea
                  placeholder="e.g. I want to drop a 4-track EP about late-night drives this summer…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  AI will draft a title and a roadmap from this. You can rename it anytime.
                </p>
              </div>
              <details className="text-xs" open={!!title}>
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Set a custom title (optional)
                </summary>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Project title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={regenerateTitle}
                    disabled={generatingTitle || description.trim().length < 3}
                    title="Regenerate title with AI"
                    className="shrink-0 gap-1.5"
                  >
                    {generatingTitle ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {title ? "Regenerate" : "Generate"}
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Leave blank to let AI name it automatically on create.
                </p>
              </details>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Project Type</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProjectType("paid")}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${projectType === "paid" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
                  >
                    <p className="text-sm font-semibold text-foreground">Paid</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Budget, milestones & client roles</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectType("collaborative")}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${projectType === "collaborative" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
                  >
                    <p className="text-sm font-semibold text-foreground">Collaborative</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Free project, equal collaborators</p>
                  </button>
                </div>
              </div>
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
      </motion.div>

      {/* Stats bar */}
      {projects && projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-4 flex-wrap"
        >
          {[
            { label: "Total", value: projects.length, icon: Sparkles },
            { label: "Active", value: projects.filter(p => p.status === "active").length, icon: Clock },
            { label: "Completed", value: projects.filter(p => p.status === "completed").length, icon: CheckCircle2 },
            { label: "Collaborative", value: projects.filter(p => p.project_type === "collaborative").length, icon: Users },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
              <stat.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-bold text-foreground">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card h-56 animate-pulse" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <p className="text-foreground text-lg font-medium">Start your first project</p>
          <p className="text-muted-foreground/80 text-sm mt-1 max-w-xs">
            Projects let you organize work, set milestones, invite collaborators, and track progress.
          </p>
          <Button
            onClick={() => setOpen(true)}
            className="mt-6 rounded-full gap-2"
            size="lg"
          >
            <Sparkles className="h-4 w-4" />
            Create your first project
          </Button>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {projects?.map((project) => {
            const collabs = collabCounts?.[project.id] || 0;
            const isSolo = project.project_type !== "collaborative" && collabs === 0;
            const cfg = statusConfig[project.status] || statusConfig.active;
            const StatusIcon = cfg.icon;
            const stats = goalStats?.[project.id];
            const total = stats?.total ?? 0;
            const done = stats?.done ?? 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const accent = project.cover_color ?? "#7c3aed";
            const initial = (project.title || "?").trim().charAt(0).toUpperCase();

            return (
              <motion.div key={project.id} variants={cardVariants} layout>
                <Link to={`/projects/${project.id}`} className="group block">
                  <div className="relative overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-foreground/20 hover:shadow-[0_8px_30px_-12px_hsl(var(--foreground)/0.15)]">
                    {/* Hover glow tinted with the project's accent */}
                    <div
                      className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30"
                      style={{ backgroundColor: accent }}
                    />

                    <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
                      {/* Avatar circle */}
                      <div
                        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-display font-bold text-white shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                        }}
                      >
                        {initial}
                        <span
                          className="absolute -inset-1 -z-10 rounded-2xl opacity-30 blur-md"
                          style={{ backgroundColor: accent }}
                        />
                      </div>

                      {/* Title + description */}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {project.title}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {project.description || (project.project_type === "collaborative" ? "Collaboration" : "Solo project")}
                        </p>
                      </div>

                      {/* Meta pills */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          {isSolo ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                          {isSolo ? "Solo" : `${collabs + 1}`}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${cfg.className}`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        {project.project_type === "paid" ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Collab
                          </span>
                        )}
                        <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(project.created_at), "MMM d")}
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="flex w-full items-center gap-3 sm:w-48">
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${accent}, ${accent}aa)`,
                            }}
                          />
                        </div>
                        <span className="w-10 shrink-0 text-right font-display text-sm font-semibold tabular-nums text-foreground">
                          {pct}%
                        </span>
                      </div>

                      {/* Kebab */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              setDeleteTarget({ id: project.id, title: project.title });
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project and all its associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteProject.mutate(deleteTarget.id)}
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectsPage;
