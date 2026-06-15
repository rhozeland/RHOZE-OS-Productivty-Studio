import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Megaphone, Link as LinkIcon, ImagePlus, Loader2, Trash2, X, ExternalLink,
  Pin, PinOff, Pencil, Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  id: string;
  user_id: string;
  body: string;
  image_url: string | null;
  link_url: string | null;
  published_at: string;
  is_pinned: boolean;
}

const MAX_LEN = 500;

const AnnouncementsTab = ({ userId, isOwnProfile }: { userId: string; isOwnProfile: boolean }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["artist-announcements", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_announcements" as any)
        .select("*")
        .eq("user_id", userId)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Announcement[];
    },
  });

  const handleImage = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/announcement-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("flow-uploads")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("flow-uploads").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const post = useMutation({
    mutationFn: async () => {
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Say something first");
      if (trimmed.length > MAX_LEN) throw new Error(`Max ${MAX_LEN} characters`);
      const link = linkUrl.trim() || null;
      if (link && !/^https?:\/\//i.test(link)) {
        throw new Error("Link must start with http(s)://");
      }
      const { error } = await supabase.from("artist_announcements" as any).insert({
        user_id: user!.id,
        body: trimmed,
        image_url: imageUrl,
        link_url: link,
      });
      if (error) throw error;

      const titleSource = trimmed.split("\n")[0] || trimmed;
      const title = titleSource.length > 80 ? titleSource.slice(0, 77) + "…" : titleSource;
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user!.id)
        .maybeSingle();
      await supabase.from("flow_items").insert({
        user_id: user!.id,
        title,
        description: trimmed,
        content_type: imageUrl ? "image" : "text",
        file_url: imageUrl,
        link_url: link,
        category: imageUrl ? "photo" : "writing",
        tags: ["announcement"],
        creator_name: prof?.display_name || prof?.username || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artist-announcements", userId] });
      qc.invalidateQueries({ queryKey: ["flow-items"] });
      setBody(""); setLinkUrl(""); setImageUrl(null);
      toast.success("Posted — your subscribers were notified.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editSave = useMutation({
    mutationFn: async () => {
      const trimmed = editBody.trim();
      if (!trimmed) throw new Error("Body required");
      if (trimmed.length > MAX_LEN) throw new Error(`Max ${MAX_LEN} characters`);
      const { error } = await supabase
        .from("artist_announcements" as any)
        .update({ body: trimmed, updated_at: new Date().toISOString() })
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artist-announcements", userId] });
      qc.invalidateQueries({ queryKey: ["pinned-announcement", userId] });
      setEditingId(null);
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("set_pinned_announcement", { _announcement_id: id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artist-announcements", userId] });
      qc.invalidateQueries({ queryKey: ["pinned-announcement", userId] });
      toast.success("Pinned to your profile");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unpin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("unpin_announcement", { _announcement_id: id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artist-announcements", userId] });
      qc.invalidateQueries({ queryKey: ["pinned-announcement", userId] });
      toast.success("Unpinned");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("artist_announcements" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artist-announcements", userId] });
      qc.invalidateQueries({ queryKey: ["pinned-announcement", userId] });
      toast.success("Removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      {isOwnProfile && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <Textarea
            placeholder="Drop an update — what's coming Friday? new track? a vibe? share it with your fans…"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
            rows={3}
            className="resize-none border-0 bg-transparent focus-visible:ring-0 px-0 text-base"
          />

          {imageUrl && (
            <div className="relative">
              <img src={imageUrl} alt="" className="w-full max-h-64 object-cover rounded-lg border border-border" />
              <Button
                type="button" variant="secondary" size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => setImageUrl(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {linkUrl !== null && linkUrl !== "" && (
            <Input
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="h-8 text-xs"
            />
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1">
              <label className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
                />
              </label>
              <button
                type="button"
                onClick={() => setLinkUrl(linkUrl ? "" : " ")}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted text-muted-foreground"
                aria-label="Add link"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              <span className="text-[11px] text-muted-foreground ml-2">{body.length}/{MAX_LEN}</span>
            </div>
            <Button
              size="sm"
              onClick={() => post.mutate()}
              disabled={!body.trim() || post.isPending || uploading}
              className="rounded-full px-5"
            >
              {post.isPending ? "Posting…" : "Post update"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No updates yet"
          description={isOwnProfile
            ? "Share what you're working on. Your subscribers will get notified instantly."
            : "Follow or subscribe to get notified when this artist posts an update."}
          size="sm"
        />
      ) : (
        <ol className="space-y-3">
          {items.map((a) => {
            const isEditing = editingId === a.id;
            return (
              <li
                key={a.id}
                className={`group rounded-2xl border bg-card overflow-hidden transition-colors ${
                  a.is_pinned ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border"
                }`}
              >
                <div className="p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {a.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                          <Pin className="h-3 w-3" /> Pinned
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.published_at), { addSuffix: true })}
                      </span>
                    </div>
                    {isOwnProfile && !isEditing && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7"
                          title={a.is_pinned ? "Unpin" : "Pin to profile"}
                          onClick={() => (a.is_pinned ? unpin.mutate(a.id) : pin.mutate(a.id))}
                          disabled={pin.isPending || unpin.isPending}
                        >
                          {a.is_pinned
                            ? <PinOff className="h-3.5 w-3.5 text-muted-foreground" />
                            : <Pin className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7"
                          title="Edit"
                          onClick={() => { setEditingId(a.id); setEditBody(a.body); }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7"
                          title="Delete"
                          onClick={() => { if (confirm("Delete this update?")) remove.mutate(a.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value.slice(0, MAX_LEN))}
                        rows={3}
                        className="resize-none text-[15px]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[11px] text-muted-foreground mr-auto">{editBody.length}/{MAX_LEN}</span>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => editSave.mutate()}
                          disabled={editSave.isPending || !editBody.trim()}
                          className="rounded-full"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          {editSave.isPending ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">{a.body}</p>
                      {a.link_url && (
                        <a
                          href={a.link_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate max-w-[260px]">{a.link_url}</span>
                        </a>
                      )}
                    </>
                  )}
                </div>
                {a.image_url && (
                  <img src={a.image_url} alt="" className="w-full object-cover max-h-[520px] border-t border-border" />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default AnnouncementsTab;
