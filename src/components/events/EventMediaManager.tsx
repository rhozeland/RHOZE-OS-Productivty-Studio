/**
 * EventMediaManager — host UI for the event's three media surfaces:
 *   1. Cover (16:9 landscape) — used on cards, list page banner, detail hero.
 *   2. Poster (3:4 portrait)  — used wherever a vertical layout is needed.
 *   3. Gallery (multi-image / video) — shown in the EventMediaCarousel below
 *      the "Going" section on the public detail page.
 */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Image as ImageIcon, Loader2, Plus, Trash2, Upload, Film } from "lucide-react";
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

type CropTarget = "cover" | "poster";

const EventMediaManager = ({ eventId, coverUrl, title, onUpdate }: EventMediaManagerProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const coverRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<CropTarget>("cover");

  // Pull current event so we can render poster preview without prop drilling
  const { data: ev } = useQuery({
    queryKey: ["event-media-source", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("events")
        .select("cover_url, cover_url_poster")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const posterUrl: string | null = ev?.cover_url_poster ?? null;
  const liveCoverUrl: string | null = ev?.cover_url ?? coverUrl;

  const { data: gallery = [] } = useQuery({
    queryKey: ["event-media-list", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("event_media")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["event-media-source", eventId] });
    qc.invalidateQueries({ queryKey: ["event-media-list", eventId] });
    qc.invalidateQueries({ queryKey: ["event-media", eventId] });
    onUpdate();
  };

  const openCrop = (file: File, target: CropTarget) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setCropFile(file);
    setCropTarget(target);
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
    const target = cropTarget;
    setBusy(target);
    try {
      const ext = safeFileExt({ name: cropFile.name, type: blob.type || cropFile.type });
      const url = await uploadBlob(blob, `${user.id}/events/${eventId}/${target}.${ext}`);
      const field = target === "cover" ? "cover_url" : "cover_url_poster";
      const { error } = await supabase.from("events").update({ [field]: url } as any).eq("id", eventId);
      if (error) throw error;
      toast.success(`${target === "cover" ? "Cover" : "Poster"} updated`);
      refresh();
    } catch (err) {
      toast.error("Upload failed", { description: err instanceof Error ? err.message : "Try a different image." });
    } finally {
      setBusy(null);
    }
  };

  const removeImage = async (target: CropTarget) => {
    const field = target === "cover" ? "cover_url" : "cover_url_poster";
    const { error } = await supabase.from("events").update({ [field]: null } as any).eq("id", eventId);
    if (error) {
      toast.error("Could not remove", { description: error.message });
      return;
    }
    toast.success(`${target === "cover" ? "Cover" : "Poster"} removed`);
    refresh();
  };

  const uploadGalleryItem = async (file: File) => {
    if (!user) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File must be under 50MB");
      return;
    }
    setBusy("gallery");
    try {
      const isVideo = file.type.startsWith("video/");
      const ext = safeFileExt({ name: file.name, type: file.type });
      const path = `${user.id}/events/${eventId}/gallery/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("listing-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("listing-media").getPublicUrl(path);
      const { error: insErr } = await (supabase as any).from("event_media").insert({
        event_id: eventId,
        uploaded_by: user.id,
        media_type: isVideo ? "video" : "image",
        url: data.publicUrl,
        sort_order: gallery.length,
      });
      if (insErr) throw insErr;
      toast.success("Added to gallery");
      refresh();
    } catch (err) {
      toast.error("Upload failed", { description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setBusy(null);
    }
  };

  const removeGalleryItem = async (id: string) => {
    const { error } = await (supabase as any).from("event_media").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete", { description: error.message });
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Cover (16:9) */}
      <div className="surface-card p-6 space-y-3">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-primary" /> Landscape cover (16:9)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Used on the events list, banners, and shared previews.
          </p>
        </div>
        <ImageSlot
          aspect="aspect-[16/9]"
          url={liveCoverUrl}
          alt={title}
          busy={busy === "cover"}
          onPick={() => coverRef.current?.click()}
          onRemove={() => removeImage("cover")}
          recommended="1600×900, max 10MB"
        />
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openCrop(f, "cover");
            e.target.value = "";
          }}
        />
      </div>

      {/* Poster (3:4) */}
      <div className="surface-card p-6 space-y-3">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4 text-primary" /> Poster (portrait)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Used on the detail page sidebar and any vertical card layout. Falls back to the landscape cover if blank.
          </p>
        </div>
        <div className="max-w-[260px]">
          <ImageSlot
            aspect="aspect-[3/4]"
            url={posterUrl}
            alt={`${title} poster`}
            busy={busy === "poster"}
            onPick={() => posterRef.current?.click()}
            onRemove={() => removeImage("poster")}
            recommended="900×1200"
          />
        </div>
        <input
          ref={posterRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openCrop(f, "poster");
            e.target.value = "";
          }}
        />
      </div>

      {/* Gallery */}
      <div className="surface-card p-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-semibold flex items-center gap-1.5">
              <Film className="h-4 w-4 text-primary" /> Gallery
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Extra images and short videos shown below "Going" on the detail page.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full gap-1.5"
            disabled={busy === "gallery"}
            onClick={() => galleryRef.current?.click()}
          >
            {busy === "gallery" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add image / video
          </Button>
        </div>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadGalleryItem(f);
            e.target.value = "";
          }}
        />
        {gallery.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No gallery items yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {gallery.map((m: any) => (
              <div key={m.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted">
                {m.media_type === "video" ? (
                  <video src={m.url} className="h-full w-full object-cover" />
                ) : (
                  <img src={m.url} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeGalleryItem(m.id)}
                  className="absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/85 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        file={cropFile}
        aspect={cropTarget === "poster" ? 3 / 4 : 16 / 9}
        onCropped={handleCroppedBlob}
        title={`Crop ${cropTarget === "poster" ? "poster" : "cover photo"}`}
      />
    </div>
  );
};

interface SlotProps {
  aspect: string;
  url: string | null;
  alt: string;
  busy: boolean;
  onPick: () => void;
  onRemove: () => void;
  recommended: string;
}

const ImageSlot = ({ aspect, url, alt, busy, onPick, onRemove, recommended }: SlotProps) => (
  <div className={`relative ${aspect} overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 group`}>
    {url ? (
      <>
        <img src={url} alt={alt} className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="sm" variant="secondary" onClick={onPick} disabled={busy}>
            <Upload className="mr-1 h-4 w-4" /> Replace
          </Button>
          <Button size="sm" variant="destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-4 w-4" /> Remove
          </Button>
        </div>
      </>
    ) : (
      <button
        type="button"
        onClick={onPick}
        disabled={busy}
        className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : (
          <>
            <ImageIcon className="h-7 w-7" />
            <span className="text-sm font-medium">Upload image</span>
            <span className="text-[11px]">{recommended}</span>
          </>
        )}
      </button>
    )}
  </div>
);

export default EventMediaManager;
