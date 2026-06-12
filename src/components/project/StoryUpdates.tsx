import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Lock,
  ImagePlus,
  Loader2,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StoryUpdate {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  body: string | null;
  phase: string | null;
  image_url: string | null;
  is_public: boolean;
  created_at: string;
}

interface Props {
  projectId: string;
  canManage?: boolean;
  /** When true, this user is the Lead Artist (project owner) and may post
   *  public updates. Collaborators can only post internal team notes. */
  isOwner?: boolean;
}

const safeContentType = (f: File) => f.type || "application/octet-stream";

const StoryUpdates = ({ projectId, canManage, isOwner = true }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Collaborators are forced to private; lead artist defaults to public.
  const [isPublic, setIsPublic] = useState(isOwner);
  const [uploading, setUploading] = useState(false);


  const { data: updates = [], isLoading } = useQuery({
    queryKey: ["project-story-updates", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_story_updates" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StoryUpdate[];
    },
  });

  const resetForm = () => {
    setTitle("");
    setBody("");
    setPhase("");
    setImageUrl(null);
    setIsPublic(true);
    setEditingId(null);
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (u: StoryUpdate) => {
    setEditingId(u.id);
    setTitle(u.title);
    setBody(u.body ?? "");
    setPhase(u.phase ?? "");
    setImageUrl(u.image_url);
    setIsPublic(u.is_public);
    setOpen(true);
  };

  const handleImage = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/story-${projectId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("flow-uploads")
        .upload(path, file, { contentType: safeContentType(file), upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("flow-uploads").getPublicUrl(path);
      setImageUrl(pub.publicUrl);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: title.trim(),
        body: body.trim() || null,
        phase: phase.trim() || null,
        image_url: imageUrl,
        is_public: isPublic,
      };
      if (editingId) {
        const { error } = await supabase
          .from("project_story_updates" as any)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_story_updates" as any)
          .insert({ ...payload, project_id: projectId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-story-updates", projectId] });
      setOpen(false);
      resetForm();
      toast.success(editingId ? "Update saved" : "Update posted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_story_updates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-story-updates", projectId] });
      toast.success("Update removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add update
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit update" : "New update"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) save.mutate();
              }}
              className="space-y-4"
            >
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
              <Input
                placeholder="Phase (e.g. Production, Mix, Release) — optional"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
              />
              <Textarea
                placeholder="What happened? Share the story…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
              />

              {imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Update"
                    className="w-full rounded-lg border border-border object-cover max-h-60"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => setImageUrl(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {uploading ? "Uploading…" : "Add image (optional)"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImage(f);
                    }}
                  />
                </label>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  {isPublic ? (
                    <span className="text-foreground">Public update</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" /> Private — team only
                    </span>
                  )}
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!title.trim() || save.isPending || uploading}
              >
                {save.isPending ? "Saving…" : editingId ? "Save changes" : "Post update"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : updates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <p className="text-sm text-muted-foreground">No updates yet.</p>
          {canManage && (
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Share what you're working on so supporters stay close.
            </p>
          )}
        </div>
      ) : (
        <ol className="space-y-5">
          <AnimatePresence initial={false}>
            {updates.map((u) => {
              const isAuthor = u.user_id === user?.id;
              return (
                <motion.li
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="group rounded-2xl border border-border bg-card overflow-hidden"
                >
                  <div className="p-5 md:p-6 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{format(new Date(u.created_at), "MMM d, yyyy")}</span>
                        {!u.is_public && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" /> Private
                          </span>
                        )}
                      </div>
                      {(isAuthor || canManage) && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isAuthor && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(u)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => remove.mutate(u.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg md:text-xl font-semibold leading-snug text-foreground">
                        {u.title}
                      </h3>
                      {u.phase && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          {u.phase}
                        </Badge>
                      )}
                    </div>

                    {u.body && (
                      <p className="text-sm md:text-[15px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {u.body}
                      </p>
                    )}
                  </div>

                  {u.image_url && (
                    <img
                      src={u.image_url}
                      alt={u.title}
                      className="w-full object-cover max-h-[520px] border-t border-border"
                    />
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
};

export default StoryUpdates;
