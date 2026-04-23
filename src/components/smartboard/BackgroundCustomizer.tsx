import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetUrl } from "@/lib/storage-utils";
import { buildSmartboardFilePath, SMARTBOARD_BUCKET } from "@/lib/smartboard-paths";
import UploadFileMeta from "@/components/upload/UploadFileMeta";
import { IMAGE_ALLOWLIST, validateUpload } from "@/lib/upload-allowlist";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Paintbrush, ImageIcon, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PRESET_COLORS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
  "linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%)",
  "#ffffff",
  "#f5f5f5",
  "#1a1a1a",
  "#0f172a",
];

interface BackgroundCustomizerProps {
  boardId: string;
  currentColor: string | null;
  currentUrl: string | null;
  currentBlur: number;
  currentOpacity: number;
  onUpdate: () => void;
}

const BackgroundCustomizer = ({
  boardId,
  currentColor,
  currentUrl,
  currentBlur,
  currentOpacity,
  onUpdate,
}: BackgroundCustomizerProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(currentColor || "");
  const [imageUrl, setImageUrl] = useState(currentUrl || "");
  const [blur, setBlur] = useState(currentBlur);
  const [opacity, setOpacity] = useState(currentOpacity);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPath, setPendingPath] = useState<string>("");
  const [uploadOk, setUploadOk] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const { error } = await supabase
      .from("smartboards")
      .update({
        background_color: color || null,
        background_url: imageUrl || null,
        background_blur: blur,
        background_opacity: opacity,
      })
      .eq("id", boardId);
    if (error) { toast.error(error.message); return; }
    onUpdate();
    setOpen(false);
    toast.success("Background updated!");
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    const previousImageUrl = imageUrl;
    setUploading(true);
    try {
      await runUploadWithRollback({
        file,
        previousImageUrl,
        buildPath: (f) => buildSmartboardFilePath(boardId, user.id, f, { kind: "bg" }),
        validate: (f) => validateUpload(f, IMAGE_ALLOWLIST),
        upload: async (path, f) => {
          const { url, error } = await uploadAndGetUrl(SMARTBOARD_BUCKET, path, f);
          return { url, error };
        },
        setPendingFile,
        setPendingPath,
        setUploadOk,
        setImageUrl,
        resetFileInput: () => {
          if (fileRef.current) fileRef.current.value = "";
        },
        notifyError: (msg) => toast.error(msg),
      });
    } finally {
      setUploading(false);
    }
  };

  const clearBackground = async () => {
    setColor("");
    setImageUrl("");
    setBlur(0);
    setOpacity(100);
    setPendingFile(null);
    setPendingPath("");
    setUploadOk(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Background"
        >
          <Paintbrush className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Board Background</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Preview */}
          <div
            className={`h-28 rounded-xl border border-border overflow-hidden relative ${
              !imageUrl && color?.includes("gradient") ? "animated-gradient" : ""
            }`}
            style={{
              background: imageUrl ? undefined : (color || "hsl(var(--muted))"),
            }}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt="bg preview"
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  filter: `blur(${blur}px)`,
                  opacity: opacity / 100,
                }}
              />
            )}
          </div>

          {/* Color presets */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Colors & Gradients</p>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setImageUrl(""); }}
                  className={`h-8 w-full rounded-lg border-2 transition-all ${
                    c.includes("gradient") ? "animated-gradient" : ""
                  } ${
                    color === c ? "border-primary scale-110" : "border-transparent hover:scale-105"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Custom color */}
          <Input
            placeholder="Custom CSS color or gradient..."
            value={color}
            onChange={(e) => { setColor(e.target.value); setImageUrl(""); }}
          />

          {/* Image upload */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Background Image</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-1 h-3.5 w-3.5" />
                {uploading ? "Uploading..." : "Upload"}
              </Button>
              {imageUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setImageUrl("")}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
            {!imageUrl && (
              <Input
                placeholder="Or paste image URL..."
                className="mt-2"
                onChange={(e) => { setImageUrl(e.target.value); setColor(""); }}
              />
            )}
            {pendingFile && (
              <UploadFileMeta
                file={pendingFile}
                path={pendingPath}
                allow={IMAGE_ALLOWLIST}
                onValidation={(ok) => setUploadOk(ok)}
              />
            )}
          </div>

          {/* Blur & Opacity */}
          {imageUrl && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Blur</span>
                  <span>{blur}px</span>
                </div>
                <Slider value={[blur]} onValueChange={([v]) => setBlur(v)} min={0} max={30} step={1} />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Opacity</span>
                  <span>{opacity}%</span>
                </div>
                <Slider value={[opacity]} onValueChange={([v]) => setOpacity(v)} min={10} max={100} step={5} />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full" onClick={clearBackground}>
              Clear
            </Button>
            <Button
              className="flex-1 rounded-full"
              onClick={save}
              disabled={!!pendingFile && uploadOk === false}
            >
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BackgroundCustomizer;
