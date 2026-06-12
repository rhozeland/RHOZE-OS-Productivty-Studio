import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Image as ImageIcon, Music, Video, Link as LinkIcon, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { computeContentHash } from "@/lib/content-hash";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Kind = "image" | "video" | "audio" | "link";

const accept: Record<Exclude<Kind, "link">, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
};

const AddBoardAssetDialog = ({ projectId, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("image");
  const [busy, setBusy] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setLinkUrl("");
    setLinkTitle("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const upload = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const contentHash = await computeContentHash(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/deliverables/${projectId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("flow-uploads")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("flow-uploads").getPublicUrl(path);

      const { error: insErr } = await supabase.from("project_deliverables" as any).insert({
        project_id: projectId,
        user_id: user.id,
        title: file.name,
        file_url: pub.publicUrl,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        content_hash: contentHash,
        file_uploaded_at: new Date().toISOString(),
        sort_order: 0,
      } as any);
      if (insErr) throw insErr;

      toast.success("Added to board");
      qc.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Upload failed", { description: e?.message ?? "Unknown error" });
    } finally {
      setBusy(false);
    }
  };

  const fetchLinkCover = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      const img = json?.data?.image?.url || json?.data?.logo?.url || json?.data?.screenshot?.url;
      return typeof img === "string" ? img : null;
    } catch {
      return null;
    }
  };

  const addLink = useMutation({
    mutationFn: async () => {
      if (!linkUrl.trim()) throw new Error("Add a link URL");
      const url = linkUrl.trim();
      const cover = await fetchLinkCover(url);
      const { error } = await supabase.from("project_deliverables" as any).insert({
        project_id: projectId,
        user_id: user!.id,
        title: linkTitle.trim() || url,
        file_url: url,
        file_name: linkTitle.trim() || url,
        mime_type: "text/uri-list",
        content_hash: cover ? `og:${cover}` : null,
        sort_order: 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link added");
      qc.invalidateQueries({ queryKey: ["project-deliverables", projectId] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to board</DialogTitle>
          <DialogDescription>Upload an image, video, audio clip — or paste a link.</DialogDescription>
        </DialogHeader>
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="image"><ImageIcon className="h-4 w-4 mr-1.5" />Image</TabsTrigger>
            <TabsTrigger value="video"><Video className="h-4 w-4 mr-1.5" />Video</TabsTrigger>
            <TabsTrigger value="audio"><Music className="h-4 w-4 mr-1.5" />Audio</TabsTrigger>
            <TabsTrigger value="link"><LinkIcon className="h-4 w-4 mr-1.5" />Link</TabsTrigger>
          </TabsList>

          {(["image", "video", "audio"] as const).map((k) => (
            <TabsContent key={k} value={k} className="pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-card/30 p-10 text-center transition-colors disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-7 w-7 mx-auto animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
                )}
                <p className="text-sm font-medium mt-2">
                  {busy ? "Uploading..." : `Click to upload ${k}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Or drag and drop your file</p>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={accept[k]}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
              />
            </TabsContent>
          ))}

          <TabsContent value="link" className="pt-4 space-y-3">
            <Input
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              autoFocus
            />
            <Input
              placeholder="Label (optional)"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={!linkUrl.trim() || addLink.isPending}
              onClick={() => addLink.mutate()}
            >
              {addLink.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
              Add link
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddBoardAssetDialog;
