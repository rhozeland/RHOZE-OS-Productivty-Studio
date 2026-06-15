/**
 * AnnouncementComposerDialog — global "post an update" composer.
 *
 * Mirrors the inline composer in <AnnouncementsTab /> but as a dialog so it
 * can be opened from anywhere (top-nav + Post menu, profile, etc).
 * Inserts into `artist_announcements` AND mirrors to `flow_items` so the
 * update shows up on the author's profile Updates tab AND in Flow.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ImagePlus, Link as LinkIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const MAX_LEN = 500;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AnnouncementComposerDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setBody(""); setLinkUrl(""); setShowLink(false); setImageUrl(null);
  };

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
      const link = showLink && linkUrl.trim() ? linkUrl.trim() : null;
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

      // Mirror to Flow so fans see it in the feed
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
      qc.invalidateQueries({ queryKey: ["artist-announcements"] });
      qc.invalidateQueries({ queryKey: ["flow-items"] });
      reset();
      onOpenChange(false);
      toast.success("Posted — your subscribers were notified and it's live in Flow.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post an update</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="Drop an update — dropping Friday? new track? share it with your fans…"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
            rows={4}
            className="resize-none text-base"
            autoFocus
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

          {showLink && (
            <Input
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="h-9 text-sm"
            />
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1">
              <label className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-muted cursor-pointer">
                {uploading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
                />
              </label>
              <button
                type="button"
                onClick={() => setShowLink((v) => !v)}
                className={`inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-muted ${showLink ? "text-foreground" : "text-muted-foreground"}`}
                aria-label="Add link"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              <span className="text-[11px] text-muted-foreground ml-2">{body.length}/{MAX_LEN}</span>
            </div>
            <Button
              onClick={() => post.mutate()}
              disabled={!body.trim() || post.isPending || uploading}
              className="rounded-full px-5"
            >
              {post.isPending ? "Posting…" : "Post update"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementComposerDialog;
