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
      className="group relative w-full overflow-hidden rounded-xl md:rounded-2xl"
      style={{ minHeight: 160 }}
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
          className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-[11px] text-white hover:bg-white/25 border border-white/25"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
          Add cover
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
      <div className="absolute inset-x-0 bottom-0 z-10 p-3 md:p-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-row items-end justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl md:text-2xl font-bold text-white drop-shadow-md leading-tight truncate">
              {project.title}
            </h1>
            {owner && (
              <Link
                to={`/profile/${owner.username ?? project.user_id}`}
                className="mt-1 inline-flex items-center gap-1.5 text-white/90 hover:text-white"
              >
                {owner.avatar_url ? (
                  <img src={owner.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover border border-white/20" />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-white/20" />
                )}
                <span className="text-xs font-medium drop-shadow">{ownerName}</span>
              </Link>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1.5 self-end rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur bg-background/70 ${statusMeta.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </span>
        </motion.div>


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
