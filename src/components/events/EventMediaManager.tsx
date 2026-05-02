import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { safeFileExt } from "@/lib/file-ext";
import ImageCropDialog from "@/components/studio/ImageCropDialog";

interface EventMediaManagerProps {
  eventId: string;
  coverUrl: string | null;
  title: string;
  onUpdate: () => void;
}

const EventMediaManager = ({ eventId, coverUrl, title, onUpdate }: EventMediaManagerProps) => {
  const { user } = useAuth();
  const coverRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const openCrop = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setCropFile(file);
    setCropOpen(true);
  };

  const uploadBlob = async (blob: Blob, path: string) => {
    const { error } = await supabase.storage
      .from("listing-media")
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw error;
    const { data } = supabase.storage.from("listing-media").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const handleCroppedBlob = async (blob: Blob) => {
    if (!user || !cropFile) return;

    setUploadingCover(true);
    try {
      const ext = safeFileExt({ name: cropFile.name, type: blob.type || cropFile.type });
      const url = await uploadBlob(blob, `${user.id}/events/${eventId}/cover.${ext}`);

      const { error } = await supabase.from("events").update({ cover_url: url }).eq("id", eventId);
      if (error) throw error;

      toast.success("Event cover updated");
      onUpdate();
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Try a different image.",
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const removeCover = async () => {
    const { error } = await supabase.from("events").update({ cover_url: null }).eq("id", eventId);
    if (error) {
      toast.error("Could not remove cover", {
        description: error.message,
      });
      return;
    }

    toast.success("Event cover removed");
    onUpdate();
  };

  return (
    <div className="surface-card p-6 space-y-4">
      <div>
        <h3 className="font-display font-semibold text-foreground mb-1">Event Media</h3>
        <p className="text-sm text-muted-foreground">
          Replace the main event photo shown across the card, detail page, and listings.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-primary" /> Cover Photo
        </Label>

        <div className="relative aspect-[16/7] overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 group">
          {coverUrl ? (
            <>
              <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => coverRef.current?.click()}
                  disabled={uploadingCover}
                >
                  <Upload className="mr-1 h-4 w-4" /> Replace
                </Button>
                <Button size="sm" variant="destructive" onClick={removeCover}>
                  <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              disabled={uploadingCover}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {uploadingCover ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-sm font-medium">Add event cover photo</span>
                  <span className="text-xs">Recommended: 1600×700, max 10MB</span>
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
            if (file) openCrop(file);
            e.target.value = "";
          }}
        />
      </div>

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        file={cropFile}
        aspect={16 / 7}
        onCropped={handleCroppedBlob}
        title="Crop cover photo"
      />
    </div>
  );
};

export default EventMediaManager;