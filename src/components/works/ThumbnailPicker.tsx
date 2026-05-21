/**
 * ThumbnailPicker — YouTube-style thumbnail chooser for video/audio uploads.
 *
 * Video files:
 *   Captures 3 frames from the video at ~15%, 50%, 85% of duration via a
 *   hidden <video> + <canvas>. Creator picks one, or hits "Regenerate" to
 *   re-sample at fresh random offsets.
 *
 * Audio files:
 *   No frames to grab, so we render 3 deterministic abstract cover designs
 *   (gradient + soundwave pattern + title text) onto a canvas. Regenerate
 *   reshuffles the palette/seed.
 *
 * Output: a JPEG/PNG Blob handed back via onPick(blob, kind). Parent uploads
 * it to storage and stores the public URL on works.thumbnail_url.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, RefreshCw, Check, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Kind = "video" | "audio";

interface Props {
  file: File | null;
  kind: Kind;
  title?: string;
  onPick: (blob: Blob | null) => void;
}

const W = 1280;
const H = 720;

// ── Audio cover palettes (HSL → hex done at draw time via canvas) ───────
const PALETTES: Array<[string, string, string]> = [
  ["#ff6b9d", "#fec5e5", "#a78bfa"],
  ["#34d399", "#a7f3d0", "#0ea5e9"],
  ["#fbbf24", "#fcd34d", "#fb7185"],
  ["#60a5fa", "#a5b4fc", "#f472b6"],
  ["#f97316", "#fde68a", "#e11d48"],
  ["#22d3ee", "#67e8f9", "#8b5cf6"],
];

const ThumbnailPicker = ({ file, kind, title, onPick }: Props) => {
  const [frames, setFrames] = useState<string[]>([]);
  const [blobs, setBlobs] = useState<Blob[]>([]);
  const [selected, setSelected] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Build offsets for video sampling — 3 evenly distributed points,
  // jittered slightly on regenerate so the user gets fresh frames.
  const buildOffsets = useCallback((duration: number, s: number): number[] => {
    if (!isFinite(duration) || duration <= 0) return [0.5, 1, 1.5];
    const base = [0.15, 0.5, 0.85];
    // Deterministic jitter based on seed
    const jitter = (i: number) => {
      const r = Math.sin(s * 9301 + i * 49297) * 233280;
      return ((r - Math.floor(r)) - 0.5) * 0.15; // ±7.5%
    };
    return base.map((b, i) => {
      const t = Math.max(0.05, Math.min(0.97, b + (s === 0 ? 0 : jitter(i))));
      return Math.min(duration - 0.1, Math.max(0, duration * t));
    });
  }, []);

  // ── Video frame extraction ────────────────────────────────────────────
  const extractVideoFrames = useCallback(async (f: File, s: number) => {
    setBusy(true);
    setError(null);
    try {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(f);
      objectUrlRef.current = url;

      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not read video"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2D context");

      const offsets = buildOffsets(video.duration, s);
      const newFrames: string[] = [];
      const newBlobs: Blob[] = [];

      for (const t of offsets) {
        await new Promise<void>((resolve, reject) => {
          const handler = () => {
            video.removeEventListener("seeked", handler);
            resolve();
          };
          video.addEventListener("seeked", handler);
          video.currentTime = t;
          setTimeout(() => reject(new Error("Seek timeout")), 5000);
        });

        // Cover-fit draw
        const vw = video.videoWidth || W;
        const vh = video.videoHeight || H;
        const scale = Math.max(W / vw, H / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(video, dx, dy, dw, dh);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85),
        );
        newFrames.push(dataUrl);
        newBlobs.push(blob);
      }

      setFrames(newFrames);
      setBlobs(newBlobs);
      setSelected(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract frames");
      setFrames([]);
      setBlobs([]);
    } finally {
      setBusy(false);
    }
  }, [buildOffsets]);

  // ── Audio cover generation ────────────────────────────────────────────
  const generateAudioCovers = useCallback(async (s: number, titleText: string) => {
    setBusy(true);
    setError(null);
    try {
      const newFrames: string[] = [];
      const newBlobs: Blob[] = [];

      for (let i = 0; i < 3; i++) {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;

        const palette = PALETTES[(s + i) % PALETTES.length];
        const [c1, c2, c3] = palette;

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, c1);
        grad.addColorStop(0.5, c2);
        grad.addColorStop(1, c3);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Soft radial glow
        const rg = ctx.createRadialGradient(W * 0.3, H * 0.3, 50, W * 0.3, H * 0.3, 600);
        rg.addColorStop(0, "rgba(255,255,255,0.35)");
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);

        // Waveform bars across the middle — deterministic per (seed,i)
        const barCount = 64;
        const barW = W / barCount;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let b = 0; b < barCount; b++) {
          const r = Math.sin((s * 13 + i * 7 + b) * 1.7) * 0.5 + 0.5;
          const h = 40 + r * (H * 0.45);
          const x = b * barW + barW * 0.2;
          const y = (H - h) / 2;
          ctx.fillRect(x, y, barW * 0.6, h);
        }

        // Title overlay
        const text = (titleText || "Untitled").slice(0, 40);
        ctx.font = "700 88px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 24;
        ctx.fillText(text, 64, H - 88);
        ctx.shadowBlur = 0;

        newFrames.push(canvas.toDataURL("image/jpeg", 0.9));
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((bl) => resolve(bl!), "image/jpeg", 0.9),
        );
        newBlobs.push(blob);
      }

      setFrames(newFrames);
      setBlobs(newBlobs);
      setSelected(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build covers");
    } finally {
      setBusy(false);
    }
  }, []);

  // Generate on file/seed/kind change
  useEffect(() => {
    if (!file) {
      setFrames([]);
      setBlobs([]);
      onPick(null);
      return;
    }
    if (kind === "video") {
      extractVideoFrames(file, seed);
    } else {
      generateAudioCovers(seed, title || file.name);
    }
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, kind, seed]);

  // Push selection up
  useEffect(() => {
    if (blobs[selected]) onPick(blobs[selected]);
    else onPick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobs, selected]);

  if (!file) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5 text-primary" />
          Thumbnail
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setSeed((s) => s + 1)}
          disabled={busy}
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
      </div>

      {busy && frames.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-dashed border-border p-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {kind === "video" ? "Capturing frames…" : "Designing covers…"}
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {frames.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition-all ${
                selected === i
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              <img src={src} alt={`Thumbnail option ${i + 1}`} className="h-full w-full object-cover" />
              {selected === i && (
                <span className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Tap a frame to pick it, or hit Regenerate for fresh options.
      </p>
    </div>
  );
};

export default ThumbnailPicker;
