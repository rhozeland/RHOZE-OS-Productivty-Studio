import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon,
  Film,
  Loader2,
  X,
  Plus,
} from "lucide-react";

interface StudioMediaManagerProps {
  studioId: string;
  coverImageUrl: string | null;
  galleryUrls: string[] | null;
  videoUrl?: string | null;
  onUpdate: () => void;
}

const StudioMediaManager = ({
  studioId,
  coverImageUrl,
  galleryUrls,
  videoUrl,
  onUpdate,
}: StudioMediaManagerProps) => {
  const { user } = useAuth();
  const coverRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [videoInput, setVideoInput] = useState(videoUrl || "");
  const [savingVideo, setSavingVideo] = useState(false);

  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage
      .from("studio-media")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("studio-media").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const handleCoverUpload = async (file: File) => {
    if (!user || file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop();
      const url = await uploadFile(file, `${studioId}/cover.${ext}`);
      await supabase
        .from("studios")
        .update({ cover_image_url: url })
        .eq("id", studioId);
      toast.success("Cover image updated!");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryUpload = async (files: FileList) => {
    if (!user) return;
    setUploadingGallery(true);
    try {
      const existing = galleryUrls || [];
      const newUrls: string[] = [];
      for (let i = 0; i < Math.min(files.length, 12 - existing.length); i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) continue;
        const ext = file.name.split(".").pop();
        const url = await uploadFile(
          file,
          `${studioId}/gallery/${Date.now()}-${i}.${ext}`
        );
        newUrls.push(url);
      }
      const updated = [...existing, ...newUrls];
      await supabase
        .from("studios")
        .update({ gallery_urls: updated })
        .eq("id", studioId);
      toast.success(`${newUrls.length} photo(s) added!`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = async (index: number) => {
    const updated = (galleryUrls || []).filter((_, i) => i !== index);
    await supabase
      .from("studios")
      .update({ gallery_urls: updated })
      .eq("id", studioId);
    toast.success("Photo removed");
    onUpdate();
  };

  const removeCover = async () => {
    await supabase
      .from("studios")
      .update({ cover_image_url: null })
      .eq("id", studioId);
    toast.success("Cover image removed");
    onUpdate();
  };

  // Video is stored in the studio description as a JSON field or we can add a column
  // For now, let's use an embed URL approach stored in studio rules temporarily
  // Actually, studios don't have a video_url column - we'll store it in gallery_urls with a prefix
  const handleSaveVideo = async () => {
    setSavingVideo(true);
    try {
      // Store video URL in gallery_urls with a [VIDEO] prefix
      const existing = (galleryUrls || []).filter((u) => !u.startsWith("[VIDEO]"));
      const updated = videoInput.trim()
        ? [...existing, `[VIDEO]${videoInput.trim()}`]
        : existing;
      await supabase
        .from("studios")
        .update({ gallery_urls: updated })
        .eq("id", studioId);
      toast.success("Video link saved!");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingVideo(false);
    }
  };

  const currentVideo = (galleryUrls || [])
    .find((u) => u.startsWith("[VIDEO]"))
    ?.replace("[VIDEO]", "");
  const photos = (galleryUrls || []).filter((u) => !u.startsWith("[VIDEO]"));

  return (
    <div className="surface-card p-6 space-y-6">
      <div>
        <h3 className="font-display font-semibold text-foreground mb-1">
          Studio Media
        </h3>
        <p className="text-sm text-muted-foreground">
          Upload a cover image, gallery photos, and a video embed.
        </p>
      </div>

      {/* Cover Image */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-primary" /> Cover Image
        </Label>
        <div className="relative aspect-[2/1] rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden group">
          {coverImageUrl ? (
            <>
              <img
                src={coverImageUrl}
                alt="Cover"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => coverRef.current?.click()}
                  disabled={uploadingCover}
                >
                  <Upload className="h-4 w-4 mr-1" /> Replace
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={removeCover}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              </div>
            </>
          ) : (
            <button
              onClick={() => coverRef.current?.click()}
              disabled={uploadingCover}
              className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {uploadingCover ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-sm font-medium">
                    Click to upload cover image
                  </span>
                  <span className="text-xs">Recommended: 1200×600, max 10MB</span>
                </>
              )}
            </button>
          )}
        </div>
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCoverUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Gallery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 text-primary" /> Gallery Photos
            <span className="text-xs text-muted-foreground font-normal">
              ({photos.length}/12)
            </span>
          </Label>
          {photos.length < 12 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => galleryRef.current?.click()}
              disabled={uploadingGallery}
              className="gap-1.5"
            >
              {uploadingGallery ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Photos
            </Button>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-lg overflow-hidden group border border-border"
            >
              <img
                src={url}
                alt={`Gallery ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeGalleryImage(i)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length === 0 && !uploadingGallery && (
            <button
              onClick={() => galleryRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs mt-1">Add</span>
            </button>
          )}
        </div>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleGalleryUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Video Embed */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5">
          <Film className="h-4 w-4 text-primary" /> Video Embed
        </Label>
        <div className="flex gap-2">
          <Input
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="YouTube or Vimeo embed URL..."
            className="flex-1"
          />
          <Button
            onClick={handleSaveVideo}
            disabled={savingVideo}
            size="sm"
          >
            {savingVideo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
        {(currentVideo || videoInput) && (
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <iframe
              src={currentVideo || videoInput}
              className="w-full h-full"
              allowFullScreen
              title="Studio video"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioMediaManager;
