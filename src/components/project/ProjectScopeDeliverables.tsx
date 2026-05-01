import { useState, useRef } from "react";
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
  Upload,
  Fingerprint,
  Loader2,
  ExternalLink,
  X,
  ShieldCheck,
  Anchor,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { computeContentHash, formatFileSize, shortHash } from "@/lib/content-hash";

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
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  content_hash: string | null;
  file_uploaded_at: string | null;
  solana_signature: string | null;
  anchored_at: string | null;
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
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

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

  /**
   * Per-row file upload. Hashes the file in the browser with SHA-256,
   * uploads to the `flow-uploads` bucket under <uid>/deliverables/...,
   * then patches the deliverable row with file metadata + content_hash so
   * we have a verifiable fingerprint of every project file we host.
   */
  const uploadFileForDeliverable = async (deliverableId: string, file: File) => {
    if (!user) return;
    setUploadingId(deliverableId);
    try {
      const contentHash = await computeContentHash(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/deliverables/${projectId}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("flow-uploads")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
      if (uploadErr) throw uploadErr;
      const { data: pub } = supabase.storage.from("flow-uploads").getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from("project_deliverables" as any)
        .update({
          file_url: pub.publicUrl,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
          content_hash: contentHash,
          file_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", deliverableId);
      if (updateErr) throw updateErr;

      toast.success("File attached", {
        description: `Fingerprint sha256:${shortHash(contentHash)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
    } catch (err: any) {
      toast.error("Upload failed", { description: err?.message ?? "Unknown error" });
    } finally {
      setUploadingId(null);
    }
  };

  const clearFile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_deliverables" as any)
        .update({
          file_url: null,
          file_name: null,
          mime_type: null,
          file_size: null,
          content_hash: null,
          file_uploaded_at: null,
          updated_at: new Date().toISOString(),
        } as any)
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
            {deliverables.map((d) => {
              const isUploading = uploadingId === d.id;
              const hasFile = !!d.file_url;
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
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

                    {/* Hidden file input — one per row */}
                    <input
                      ref={(el) => (fileInputsRef.current[d.id] = el)}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFileForDeliverable(d.id, f);
                        e.target.value = "";
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputsRef.current[d.id]?.click()}
                      disabled={isUploading}
                      title={hasFile ? "Replace file" : "Attach & fingerprint file"}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteDeliverable.mutate(d.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Attached file row: name + sha256 + actions */}
                  {hasFile && (
                    <div className="ml-9 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <a
                        href={d.file_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-foreground truncate max-w-[220px]"
                        title={d.file_name ?? undefined}
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{d.file_name}</span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                      {d.file_size != null && (
                        <span>{formatFileSize(d.file_size)}</span>
                      )}
                      {d.content_hash && (
                        <span
                          className="inline-flex items-center gap-1 font-mono select-all"
                          title={`sha256:${d.content_hash}`}
                        >
                          <Fingerprint className="h-3 w-3" />
                          sha256:{shortHash(d.content_hash)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => clearFile.mutate(d.id)}
                        className="inline-flex items-center gap-0.5 hover:text-destructive transition-colors"
                        title="Remove file (does not delete from storage)"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
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
