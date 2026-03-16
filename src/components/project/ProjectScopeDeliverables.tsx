import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  FileText,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SCOPE_CATEGORIES = [
  { value: "Sound", icon: "🎵" },
  { value: "Photo", icon: "📷" },
  { value: "Video", icon: "🎬" },
  { value: "Design", icon: "🎨" },
  { value: "Writing", icon: "✍️" },
  { value: "Mixing", icon: "🎛️" },
  { value: "Mastering", icon: "💿" },
  { value: "Branding", icon: "🏷️" },
  { value: "Web", icon: "🌐" },
  { value: "Animation", icon: "✨" },
  { value: "Consulting", icon: "💼" },
  { value: "Strategy", icon: "📊" },
];

interface Deliverable {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
}

interface ProjectScopeDeliverablesProps {
  projectId: string;
  categories: string[];
  onCategoriesChange: (categories: string[]) => void;
}

const ProjectScopeDeliverables = ({
  projectId,
  categories,
  onCategoriesChange,
}: ProjectScopeDeliverablesProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newDeliverable, setNewDeliverable] = useState("");

  // Fetch deliverables
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

  const toggleCategory = (cat: string) => {
    const updated = categories.includes(cat)
      ? categories.filter((c) => c !== cat)
      : [...categories, cat];
    onCategoriesChange(updated);
  };

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

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Scope Categories
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {SCOPE_CATEGORIES.map((cat) => {
            const active = categories.includes(cat.value);
            return (
              <button
                key={cat.value}
                onClick={() => toggleCategory(cat.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{cat.icon}</span>
                {cat.value}
              </button>
            );
          })}
        </div>
      </div>

      {/* Deliverables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
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

        {/* Progress bar */}
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

        {/* List */}
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

        {/* Add new */}
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

export default ProjectScopeDeliverables;
