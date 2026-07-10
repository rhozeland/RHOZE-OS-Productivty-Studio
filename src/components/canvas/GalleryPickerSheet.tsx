/**
 * GalleryPickerSheet — lets the user pull existing works / flow uploads
 * onto the canvas without re-uploading.
 */
import { useEffect, useState } from "react";
import { Music4, Film, Image as ImageIcon, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Item {
  id: string;
  name: string;
  url: string;
  mime: string;
  thumbnail_url?: string | null;
  source: "work" | "flow";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: Item) => void;
}

const iconFor = (mime: string) => {
  if (mime.startsWith("audio/")) return Music4;
  if (mime.startsWith("video/")) return Film;
  return ImageIcon;
};

const GalleryPickerSheet = ({ open, onOpenChange, onPick }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const [worksRes, flowRes] = await Promise.all([
        supabase.from("works").select("id,title,file_url,mime_type,cover_url").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24),
        supabase.from("flow_items").select("id,title,media_url,media_type,thumbnail_url").eq("user_id", user.id).order("created_at", { ascending: false }).limit(24),
      ]);
      const mapped: Item[] = [];
      for (const w of (worksRes.data ?? []) as any[]) {
        if (!w.file_url) continue;
        mapped.push({
          id: `w-${w.id}`,
          name: w.title ?? "Untitled",
          url: w.file_url,
          mime: w.mime_type ?? "application/octet-stream",
          thumbnail_url: w.cover_url,
          source: "work",
        });
      }
      for (const f of (flowRes.data ?? []) as any[]) {
        if (!f.media_url) continue;
        const mime = f.media_type === "audio" ? "audio/mpeg" : f.media_type === "video" ? "video/mp4" : "image/jpeg";
        mapped.push({
          id: `f-${f.id}`,
          name: f.title ?? "Flow post",
          url: f.media_url,
          mime,
          thumbnail_url: f.thumbnail_url,
          source: "flow",
        });
      }
      setItems(mapped);
      setLoading(false);
    })();
  }, [open, user]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">From your gallery</SheetTitle>
          <p className="text-xs text-muted-foreground">Tap anything to drop it on the canvas.</p>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {loading && (
            <div className="col-span-2 flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="col-span-2 text-center text-xs text-muted-foreground py-10">
              No uploads yet. Post a work first — it'll show up here.
            </p>
          )}
          {items.map((it) => {
            const Icon = iconFor(it.mime);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => { onPick(it); onOpenChange(false); }}
                className="group text-left rounded-lg border border-border bg-card hover:border-foreground/40 hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <div className="aspect-square w-full bg-muted flex items-center justify-center overflow-hidden">
                  {it.thumbnail_url ? (
                    <img src={it.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs text-foreground truncate">{it.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.source}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GalleryPickerSheet;
