import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  ImagePlus,
  Link2,
  Trash2,
  Pencil,
  GripVertical,
  ExternalLink,
  StickyNote,
  Upload,
  Loader2,
} from "lucide-react";
import { uploadAndGetUrl, resolveStorageUrl } from "@/lib/storage-utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MoodboardItem {
  id: string;
  project_id: string;
  user_id: string;
  kind: "image" | "link";
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  link_url: string | null;
  title: string | null;
  note: string | null;
  position: number;
  created_at: string;
}

interface Props {
  projectId: string;
  canManage: boolean;
}

const ProjectMoodboard = ({ projectId, canManage }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [editing, setEditing] = useState<MoodboardItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["moodboard", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moodboard_items")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as MoodboardItem[];
    },
  });

  // Resolve signed URLs for images
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        items
          .filter((it) => it.kind === "image" && it.file_url && !resolved[it.id])
          .map(async (it) => {
            const url = await resolveStorageUrl(it.file_url!);
            next[it.id] = url;
          })
      );
      if (!cancelled && Object.keys(next).length) {
        setResolved((p) => ({ ...p, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!user || !canManage) return;
    setUploading(true);
    try {
      const list = Array.from(files);
      const maxPos = items.reduce((m, it) => Math.max(m, it.position), -1);
      let pos = maxPos + 1;
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: only image files supported here`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: max 10MB`);
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${projectId}/${Date.now()}-${safe}`;
        const { url, error } = await uploadAndGetUrl("moodboard", path, file);
        if (error || !url) {
          toast.error(error || "Upload failed");
          continue;
        }
        const { error: insErr } = await supabase.from("moodboard_items").insert({
          project_id: projectId,
          user_id: user.id,
          kind: "image",
          file_url: url,
          file_name: file.name,
          file_type: file.type,
          position: pos++,
        });
        if (insErr) toast.error(insErr.message);
      }
      qc.invalidateQueries({ queryKey: ["moodboard", projectId] });
    } finally {
      setUploading(false);
    }
  };

  const addLink = async () => {
    if (!user || !canManage) return;
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      toast.error("Enter a URL");
      return;
    }
    let normalized = trimmed;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      // Validate
      new URL(normalized);
    } catch {
      toast.error("Invalid URL");
      return;
    }
    const maxPos = items.reduce((m, it) => Math.max(m, it.position), -1);
    const { error } = await supabase.from("moodboard_items").insert({
      project_id: projectId,
      user_id: user.id,
      kind: "link",
      link_url: normalized,
      title: linkTitle.trim() || null,
      note: linkNote.trim() || null,
      position: maxPos + 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link added");
    setLinkDialogOpen(false);
    setLinkUrl("");
    setLinkTitle("");
    setLinkNote("");
    qc.invalidateQueries({ queryKey: ["moodboard", projectId] });
  };

  const deleteItem = async (item: MoodboardItem) => {
    const { error } = await supabase.from("moodboard_items").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Best-effort delete the storage object too
    if (item.kind === "image" && item.file_url) {
      const m = item.file_url.match(/\/(?:public|sign)\/moodboard\/([^?]+)/);
      if (m?.[1]) {
        await supabase.storage.from("moodboard").remove([decodeURIComponent(m[1])]);
      }
    }
    qc.invalidateQueries({ queryKey: ["moodboard", projectId] });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("moodboard_items")
      .update({ title: editTitle.trim() || null, note: editNote.trim() || null })
      .eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["moodboard", projectId] });
  };

  const reorderMutation = useMutation({
    mutationFn: async (ordered: MoodboardItem[]) => {
      // Update each row with its new position
      await Promise.all(
        ordered.map((it, i) =>
          supabase.from("moodboard_items").update({ position: i }).eq("id", it.id)
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moodboard", projectId] });
    },
    onError: (e: any) => toast.error(e?.message || "Reorder failed"),
  });

  const handleReorder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const sorted = [...items].sort((a, b) => a.position - b.position);
    const sIdx = sorted.findIndex((i) => i.id === sourceId);
    const tIdx = sorted.findIndex((i) => i.id === targetId);
    if (sIdx === -1 || tIdx === -1) return;
    const [moved] = sorted.splice(sIdx, 1);
    sorted.splice(tIdx, 0, moved);
    // Optimistic
    qc.setQueryData(["moodboard", projectId], sorted.map((it, i) => ({ ...it, position: i })));
    reorderMutation.mutate(sorted);
  };

  // Drop zone for files anywhere in the board
  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setDropZoneActive(false);
    if (!canManage) return;
    if (e.dataTransfer.files?.length) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-1.5 h-4 w-4" />
            )}
            Upload images
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLinkDialogOpen(true)}>
            <Link2 className="mr-1.5 h-4 w-4" /> Add link
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Drag tiles to rearrange · drop files anywhere to upload
          </span>
        </div>
      )}

      <div
        onDragOver={(e) => {
          if (!canManage) return;
          if (Array.from(e.dataTransfer.types).includes("Files")) {
            e.preventDefault();
            setDropZoneActive(true);
          }
        }}
        onDragLeave={(e) => {
          // Only deactivate when leaving the container itself
          if (e.currentTarget === e.target) setDropZoneActive(false);
        }}
        onDrop={handleDropFiles}
        className={cn(
          "rounded-2xl border border-dashed border-border/60 p-3 transition-colors min-h-[200px]",
          dropZoneActive && "border-primary/60 bg-primary/5"
        )}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">Your moodboard is empty</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {canManage
                ? "Drop images here, or add a link to start collecting references."
                : "The owner hasn't added any references yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <AnimatePresence>
              {items.map((item) => {
                const isOver = dragOverId === item.id && dragId !== item.id;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18 }}
                    draggable={canManage}
                    onDragStart={(e) => {
                      if (!canManage) return;
                      // @ts-ignore — DataTransfer exists on native event
                      (e as any).dataTransfer?.setData?.("text/plain", item.id);
                      setDragId(item.id);
                    }}
                    onDragOver={(e) => {
                      if (!canManage || !dragId) return;
                      e.preventDefault();
                      setDragOverId(item.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverId === item.id) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!canManage || !dragId) return;
                      handleReorder(dragId, item.id);
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    className={cn(
                      "group relative",
                      canManage && "cursor-grab active:cursor-grabbing",
                      isOver && "ring-2 ring-primary rounded-xl"
                    )}
                  >
                    <Card className="overflow-hidden p-0 border-border/60 hover:border-border transition-colors">
                      {/* Visual */}
                      <div className="relative aspect-square bg-muted/50">
                        {item.kind === "image" ? (
                          resolved[item.id] ? (
                            <img
                              src={resolved[item.id]}
                              alt={item.title || item.file_name || "moodboard image"}
                              className="absolute inset-0 h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )
                        ) : (
                          <a
                            href={item.link_url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center hover:bg-muted/70 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background border border-border/60">
                              <Link2 className="h-4 w-4 text-foreground" />
                            </div>
                            <p className="text-xs font-medium text-foreground line-clamp-2">
                              {item.title || item.link_url}
                            </p>
                            {item.title && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1">
                                {(() => {
                                  try {
                                    return new URL(item.link_url!).hostname;
                                  } catch {
                                    return item.link_url;
                                  }
                                })()}
                              </p>
                            )}
                          </a>
                        )}

                        {/* Drag handle + actions */}
                        {canManage && (
                          <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-background/80 backdrop-blur border border-border/60">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </div>
                        )}
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.kind === "link" && (
                            <a
                              href={item.link_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-background/80 backdrop-blur border border-border/60 hover:bg-background"
                              aria-label="Open link"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setEditing(item);
                                  setEditTitle(item.title || "");
                                  setEditNote(item.note || "");
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-background/80 backdrop-blur border border-border/60 hover:bg-background"
                                aria-label="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteItem(item)}
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-background/80 backdrop-blur border border-border/60 hover:bg-destructive hover:text-destructive-foreground"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>

                        {item.note && (
                          <Badge
                            variant="secondary"
                            className="absolute bottom-1.5 left-1.5 gap-1 text-[10px]"
                          >
                            <StickyNote className="h-3 w-3" />
                            note
                          </Badge>
                        )}
                      </div>

                      {/* Footer */}
                      {(item.title || item.note) && (
                        <div className="p-2.5 space-y-1">
                          {item.title && (
                            <p className="text-xs font-medium text-foreground line-clamp-1">
                              {item.title}
                            </p>
                          )}
                          {item.note && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {item.note}
                            </p>
                          )}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add link dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add a link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">URL</label>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Title (optional)</label>
              <Input
                placeholder="What is this?"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Note (optional)</label>
              <Textarea
                placeholder="Why does this inspire the project?"
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addLink}>Add link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Title</label>
              <Input
                placeholder={editing?.kind === "link" ? "Link title" : "Image caption"}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Note</label>
              <Textarea
                placeholder="Add a note about this reference..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectMoodboard;
