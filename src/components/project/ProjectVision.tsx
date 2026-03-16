import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  FileText,
  Clock,
  Tags,
  User,
  Pencil,
  Check,
  X,
  Plus,
  Layers,
  Trash2,
  CheckCircle2,
  LayoutGrid,
  Link2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  vision?: string | null;
  scope_of_work?: string | null;
  runtime_notes?: string | null;
  categories?: string[] | null;
  client_name?: string | null;
  project_type?: string | null;
}

interface Deliverable {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
}

interface ProjectVisionProps {
  project: Project;
  projectId: string;
  smartboardDetails?: any[] | null;
  linkedIds?: string[];
  onLinkSmartboard?: () => void;
  onUnlinkSmartboard?: (id: string) => void;
}

const PROJECT_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "recording", label: "Recording Session" },
  { value: "mixing", label: "Mixing / Mastering" },
  { value: "production", label: "Full Production" },
  { value: "design", label: "Design Project" },
  { value: "photo", label: "Photography" },
  { value: "video", label: "Video / Film" },
  { value: "branding", label: "Branding" },
  { value: "consulting", label: "Consulting" },
  { value: "custom", label: "Custom" },
];

const CATEGORY_SUGGESTIONS = [
  "Sound", "Photo", "Video", "Design", "Writing",
  "Mixing", "Mastering", "Branding", "Web", "Print",
  "Animation", "Consulting", "Strategy",
];

const ProjectVision = ({ project, projectId }: ProjectVisionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [newDeliverable, setNewDeliverable] = useState("");

  const [vision, setVision] = useState(project.vision || "");
  const [scope, setScope] = useState(project.scope_of_work || "");
  const [runtime, setRuntime] = useState(project.runtime_notes || "");
  const [categories, setCategories] = useState<string[]>(project.categories || []);
  const [clientName, setClientName] = useState(project.client_name || "");
  const [projectType, setProjectType] = useState(project.project_type || "standard");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    setVision(project.vision || "");
    setScope(project.scope_of_work || "");
    setRuntime(project.runtime_notes || "");
    setCategories(project.categories || []);
    setClientName(project.client_name || "");
    setProjectType(project.project_type || "standard");
  }, [project]);

  // Deliverables
  const { data: deliverables = [] } = useQuery({
    queryKey: ["project-deliverables", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_deliverables" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as Deliverable[];
    },
  });

  const addDeliverable = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase.from("project_deliverables" as any).insert({
        project_id: projectId,
        user_id: user!.id,
        title,
        sort_order: deliverables.length,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
      setNewDeliverable("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDeliverable = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from("project_deliverables" as any)
        .update({ completed, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
    },
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_deliverables" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
    },
  });

  const completedCount = deliverables.filter((d) => d.completed).length;
  const totalCount = deliverables.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const addCategory = (cat: string) => {
    const trimmed = cat.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
    }
    setNewCategory("");
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const saveVision = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({
          vision,
          scope_of_work: scope,
          runtime_notes: runtime,
          categories,
          client_name: clientName || null,
          project_type: projectType,
        } as any)
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      setEditing(false);
      toast.success("Vision & scope updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelEdit = () => {
    setEditing(false);
    setVision(project.vision || "");
    setScope(project.scope_of_work || "");
    setRuntime(project.runtime_notes || "");
    setCategories(project.categories || []);
    setClientName(project.client_name || "");
    setProjectType(project.project_type || "standard");
  };

  const hasContent = vision || scope || runtime || categories.length > 0 || clientName;

  const sectionClass = "rounded-xl border border-border bg-muted/20 p-4 space-y-2";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Vision & Scope</h2>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={() => saveVision.mutate()} disabled={saveVision.isPending}>
              <Check className="mr-1 h-3.5 w-3.5" />
              {saveVision.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-5">
          {/* Project Type & Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Project Type
              </label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Client Name
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Alex Parker"
              />
            </div>
          </div>

          {/* Vision */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Vision / Creative Direction
            </label>
            <Textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              placeholder="Describe the creative vision, goals, and desired outcome of this project..."
              rows={4}
            />
          </div>

          {/* Scope of Work */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Scope of Work
            </label>
            <Textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Outline what's included — deliverables, revisions, what's in/out of scope..."
              rows={4}
            />
          </div>

          {/* Runtime / Timeline Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Runtime & Timeline Notes
            </label>
            <Textarea
              value={runtime}
              onChange={(e) => setRuntime(e.target.value)}
              placeholder="Session lengths, turnaround times, deadlines, availability windows..."
              rows={3}
            />
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Categories / Disciplines
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/10"
                  onClick={() => removeCategory(cat)}
                >
                  {cat}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Add category..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory(newCategory);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addCategory(newCategory)}
                disabled={!newCategory.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_SUGGESTIONS.filter((c) => !categories.includes(c)).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => addCategory(cat)}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  + {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {!hasContent ? (
            <div
              className="surface-card flex flex-col items-center justify-center py-12 cursor-pointer hover:border-primary/30 transition-colors border-2 border-dashed border-border rounded-xl"
              onClick={() => setEditing(true)}
            >
              <Eye className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No vision or scope defined yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click to add project details, scope of work, and timeline info
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick info bar */}
              <div className="flex flex-wrap items-center gap-3">
                {projectType && projectType !== "standard" && (
                  <Badge variant="outline" className="gap-1.5">
                    <Layers className="h-3 w-3" />
                    {PROJECT_TYPES.find((t) => t.value === projectType)?.label || projectType}
                  </Badge>
                )}
                {clientName && (
                  <Badge variant="outline" className="gap-1.5">
                    <User className="h-3 w-3" />
                    {clientName}
                  </Badge>
                )}
                {categories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>

              {vision && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={sectionClass}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Vision
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {vision}
                  </p>
                </motion.div>
              )}

              {scope && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={sectionClass}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Scope of Work
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {scope}
                  </p>
                </motion.div>
              )}

              {runtime && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={sectionClass}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Runtime & Timeline
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {runtime}
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </>
      )}

      {/* Deliverables Checklist */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Deliverables
            </h3>
          </div>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount} complete ({progressPct}%)
            </span>
          )}
        </div>

        {totalCount > 0 && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        )}

        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {deliverables.map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors"
              >
                <Checkbox
                  checked={d.completed}
                  onCheckedChange={(checked) =>
                    toggleDeliverable.mutate({ id: d.id, completed: !!checked })
                  }
                />
                <span
                  className={cn(
                    "flex-1 text-sm transition-all",
                    d.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  )}
                >
                  {d.title}
                </span>
                <button
                  onClick={() => deleteDeliverable.mutate(d.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newDeliverable.trim()) addDeliverable.mutate(newDeliverable.trim());
          }}
          className="flex gap-2"
        >
          <Input
            value={newDeliverable}
            onChange={(e) => setNewDeliverable(e.target.value)}
            placeholder="Add deliverable (e.g. Final master audio files)"
            className="flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            disabled={!newDeliverable.trim() || addDeliverable.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ProjectVision;
