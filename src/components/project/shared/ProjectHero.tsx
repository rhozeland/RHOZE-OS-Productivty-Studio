/**
 * Shared hero for ProjectDetailPage (owner) and ReleasePage (public).
 *
 * Full-bleed cover (min 300px), dark gradient overlay at bottom, title +
 * artist chip bottom-left, status pill bottom-right.
 *
 * Top-right:
 *   - Owner view: Build-in-Public toggle pill (writes projects.is_public).
 *   - Public view: read-only "Building in public" badge.
 *
 * Top-left (owner only, hover): Edit cover button → hidden file input that
 * uploads to listing-media/project-covers/{user_id}/{ts}.{ext} and patches
 * projects.cover_image_url.
 *
 * Placeholder cover: large + icon, "Add a cover image" centered (owner) or
 * accent gradient (public).
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { ImagePlus, Pencil, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { STATUS_META, type ProjectStatus } from "./projectStatus";

interface ProjectHeroProps {
  project: any;
  owner: { display_name?: string | null; username?: string | null; avatar_url?: string | null } | null;
  status: ProjectStatus;
  isOwner: boolean;
  /** When true, hides write affordances even if isOwner. */
  publicView?: boolean;
}

const ProjectHero = ({ project, owner, status, isOwner, publicView }: ProjectHeroProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const cover = project?.cover_image_url as string | null;
  const accent = project?.cover_color ?? "hsl(var(--primary))";
  const ownerName = owner?.display_name ?? owner?.username ?? "Artist";
  const statusMeta = STATUS_META[status];

  const togglePublic = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from("projects").update({ is_public: next }).eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Visibility updated");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update visibility"),
  });

  const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Cover must be under 8MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `project-covers/${project.user_id}/${project.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("listing-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("listing-media").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("projects")
        .update({ cover_image_url: pub.publicUrl })
        .eq("id", project.id);
      if (updErr) throw updErr;
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Cover updated");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="group relative w-full overflow-hidden rounded-none md:rounded-2xl"
      style={{ minHeight: 320 }}
    >
      {/* Cover layer */}
      {cover ? (
        <img
          src={cover}
          alt={`${project.title} cover`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${accent}, hsl(var(--background)))` }}
        />
      )}

      {/* Placeholder CTA when no cover, owner only */}
      {!cover && isOwner && !publicView && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 grid place-items-center text-white/90 hover:text-white"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-full bg-white/15 backdrop-blur grid place-items-center border border-white/30">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            </div>
            <span className="text-sm font-medium drop-shadow">Add a cover image</span>
          </div>
        </button>
      )}

      {/* Bottom gradient overlay for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

      {/* Top row: edit cover (owner, hover) + public toggle (owner) / build-in-public badge (public) */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 md:p-4">
        {isOwner && !publicView && cover ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur px-3 py-1.5 text-[11px] text-white hover:bg-black/70 border border-white/15"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
            Edit cover
          </button>
        ) : (
          <span />
        )}

        {isOwner && !publicView ? (
          <label className="inline-flex items-center gap-2 rounded-full bg-black/50 backdrop-blur px-3 py-1.5 text-[11px] text-white border border-white/15 cursor-pointer">
            <Eye className="h-3 w-3" />
            Build in public
            <Switch
              checked={!!project.is_public}
              onCheckedChange={(v) => togglePublic.mutate(v)}
              disabled={togglePublic.isPending}
              className="scale-75 -mr-1"
            />
          </label>
        ) : publicView ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur px-3 py-1.5 text-[10px] uppercase tracking-wider text-white border border-white/15">
            <Eye className="h-3 w-3" />
            Building in public
          </span>
        ) : null}
      </div>

      {/* Bottom row: title + artist + status pill */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl md:text-5xl font-bold text-white drop-shadow-md leading-tight">
              {project.title}
            </h1>
            {owner && (
              <Link
                to={`/profile/${owner.username ?? project.user_id}`}
                className="mt-2 inline-flex items-center gap-2 text-white/90 hover:text-white"
              >
                {owner.avatar_url ? (
                  <img src={owner.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover border border-white/20" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-white/20" />
                )}
                <span className="text-sm font-medium drop-shadow">{ownerName}</span>
              </Link>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1.5 self-start md:self-end rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur bg-background/70 ${statusMeta.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </span>
        </motion.div>

        {status === "live" && (
          <div className="pointer-events-none absolute right-4 bottom-16 md:right-6 md:bottom-20 hidden md:flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur px-2.5 py-1 border border-white/15">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/90 font-medium">Live</span>
          </div>
        )}

      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverPick}
      />
    </div>
  );
};

export default ProjectHero;
