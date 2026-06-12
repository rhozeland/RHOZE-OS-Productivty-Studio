/**
 * ProjectFeaturedVisual — the official "headline" media for a project.
 *
 * Separate from the mood Board. Owner can upload a file (audio/video/image)
 * OR paste an external link (YouTube, Vimeo, SoundCloud, etc.). On the public
 * release page, the video auto-plays muted/looped so fans land on the work.
 */
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Link as LinkIcon, X, Music, Video as VideoIcon, Image as ImageIcon, ExternalLink, Play } from "lucide-react";

interface Props {
  projectId: string;
  featuredUrl?: string | null;
  featuredExternalUrl?: string | null;
  featuredMime?: string | null;
  featuredTitle?: string | null;
  canManage: boolean;
  /** Public release rendering: autoplay video, hide owner controls. */
  publicView?: boolean;
}

const ytId = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
};

const vimeoId = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const m = u.pathname.match(/\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
};

const ProjectFeaturedVisual = ({
  projectId,
  featuredUrl,
  featuredExternalUrl,
  featuredMime,
  featuredTitle,
  canManage,
  publicView = false,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState(featuredExternalUrl ?? "");
  const [uploading, setUploading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["release"] });
  };

  const saveLink = useMutation({
    mutationFn: async (url: string) => {
      const clean = url.trim() || null;
      const { error } = await supabase
        .from("projects")
        .update({ featured_visual_external_url: clean })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link saved");
      setLinkOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error("Couldn't save link", { description: e?.message }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({
          featured_visual_url: null,
          featured_visual_external_url: null,
          featured_visual_mime: null,
          featured_visual_title: null,
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visual cleared");
      invalidate();
    },
  });

  const onPickFile = () => fileRef.current?.click();

  const handleFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/featured-visual/${projectId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("flow-uploads")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("flow-uploads").getPublicUrl(path);
      const { error } = await supabase
        .from("projects")
        .update({
          featured_visual_url: pub.publicUrl,
          featured_visual_mime: file.type || null,
          featured_visual_title: file.name,
        })
        .eq("id", projectId);
      if (error) throw error;
      toast.success("Visual uploaded");
      invalidate();
    } catch (e: any) {
      toast.error("Upload failed", { description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const mime = (featuredMime ?? "").toLowerCase();
  const kind: "video" | "audio" | "image" | null =
    mime.startsWith("video/") ? "video"
    : mime.startsWith("audio/") ? "audio"
    : mime.startsWith("image/") ? "image"
    : null;

  const yt = featuredExternalUrl ? ytId(featuredExternalUrl) : null;
  const vm = featuredExternalUrl ? vimeoId(featuredExternalUrl) : null;

  const hasUpload = !!featuredUrl;
  const hasExternal = !!featuredExternalUrl;
  const hasAny = hasUpload || hasExternal;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-amber-600 dark:text-amber-300 flex items-center gap-1.5">
            {kind === "video" || yt || vm ? <VideoIcon className="h-3 w-3" />
              : kind === "audio" ? <Music className="h-3 w-3" />
              : <ImageIcon className="h-3 w-3" />}
            Visual
          </div>
          {featuredTitle && <span className="text-xs text-muted-foreground truncate max-w-[260px]">{featuredTitle}</span>}
        </div>
        {!publicView && canManage && hasAny && (
          <button
            onClick={() => clearAll.mutate()}
            className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
            disabled={clearAll.isPending}
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <div className="px-5 pb-5">
        {/* Primary media slot */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/95 border border-border">
          {hasUpload && kind === "video" ? (
            <video
              src={featuredUrl!}
              controls={!publicView}
              autoPlay={publicView}
              muted={publicView}
              loop={publicView}
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          ) : hasUpload && kind === "audio" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-amber-500/20 via-rose-500/15 to-fuchsia-500/20 p-6">
              <Music className="h-10 w-10 text-white/80" />
              <p className="text-sm font-medium text-white text-center line-clamp-2">{featuredTitle ?? "Audio"}</p>
              <audio src={featuredUrl!} controls autoPlay={publicView} className="w-full max-w-md" />
            </div>
          ) : hasUpload && kind === "image" ? (
            <img src={featuredUrl!} alt={featuredTitle ?? "Project visual"} className="w-full h-full object-contain bg-black" />
          ) : yt ? (
            <iframe
              src={`https://www.youtube.com/embed/${yt}?autoplay=${publicView ? 1 : 0}&mute=${publicView ? 1 : 0}&rel=0`}
              title="YouTube"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          ) : vm ? (
            <iframe
              src={`https://player.vimeo.com/video/${vm}?autoplay=${publicView ? 1 : 0}&muted=${publicView ? 1 : 0}`}
              title="Vimeo"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          ) : hasExternal ? (
            <a
              href={featuredExternalUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-white"
            >
              <Play className="h-12 w-12" />
              <span className="text-sm font-medium">Open link</span>
              <span className="text-[11px] opacity-80 truncate max-w-[80%]">{featuredExternalUrl}</span>
            </a>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 bg-gradient-to-br from-muted/40 to-card p-6">
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No visual yet.</p>
              {!publicView && canManage && (
                <p className="text-[11px] text-muted-foreground/70">Upload an audio/video/image, or paste a link.</p>
              )}
            </div>
          )}
        </div>

        {/* External link badge (when uploaded file is primary but external also set) */}
        {hasUpload && hasExternal && (
          <a
            href={featuredExternalUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <ExternalLink className="h-3 w-3" />
            Also on {(() => { try { return new URL(featuredExternalUrl!).hostname.replace("www.", ""); } catch { return "the web"; } })()}
          </a>
        )}

        {/* Owner controls */}
        {!publicView && canManage && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,video/*,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="outline" onClick={onPickFile} disabled={uploading} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Uploading…" : hasUpload ? "Replace file" : "Upload file"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLinkOpen((v) => !v)} className="gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" />
                {hasExternal ? "Edit link" : "Add external link"}
              </Button>
            </div>
            {linkOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveLink.mutate(linkUrl);
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" disabled={saveLink.isPending}>Save</Button>
              </form>
            )}
            <p className="text-[10.5px] text-muted-foreground">
              YouTube / Vimeo links embed automatically. Music videos play right on the public page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectFeaturedVisual;
