import { useState, useEffect, useRef } from "react";
import { safeFileExt, safeContentType } from "@/lib/file-ext";
import { FileType2, Copy, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { validateUpload, type UploadAllowlist } from "@/lib/upload-allowlist";

interface UploadFileMetaProps {
  file: File | null | undefined;
  /** Optional path preview to show alongside ext/content-type. */
  path?: string;
  className?: string;
  /** When provided, blocks the upload if file fails the allowlist. */
  allow?: UploadAllowlist;
  /** Called whenever validation re-runs so parents can disable submit buttons. */
  onValidation?: (ok: boolean, reason?: string) => void;
  /**
   * Cache-Control max-age (seconds) the upload site will pass to Supabase.
   * Defaults to 3600 — Supabase Storage's own default when none is supplied.
   */
  cacheControlSeconds?: number;
}

/**
 * Tiny inline preview that shows what we'll actually send to storage:
 *   - resolved file extension (after fallback rules)
 *   - resolved content-type
 *   - optional storage path
 *   - allowlist verdict (when `allow` is supplied)
 *
 * Helps verify uploads for files with weird/missing extensions before they hit the bucket.
 */
const UploadFileMeta = ({ file, path, className, allow, onValidation, cacheControlSeconds = 3600 }: UploadFileMetaProps) => {
  const [copied, setCopied] = useState(false);
  // Track last-reported state so we don't fire onValidation on every render.
  const lastReported = useRef<{ ok: boolean; reason?: string } | null>(null);

  const verdict = validateUpload(file, allow);

  useEffect(() => {
    if (!onValidation) return;
    const prev = lastReported.current;
    if (!prev || prev.ok !== verdict.ok || prev.reason !== verdict.reason) {
      lastReported.current = { ok: verdict.ok, reason: verdict.reason };
      onValidation(verdict.ok, verdict.reason);
    }
  }, [verdict.ok, verdict.reason, onValidation]);

  if (!file) return null;

  const ext = safeFileExt(file);
  const contentType = safeContentType(file);
  const browserType = file.type || "—";
  const sizeKb = (file.size / 1024).toFixed(1);
  const showVerdict = !!allow;
  const blocked = showVerdict && !verdict.ok;

  const handleCopy = async () => {
    const lines = [
      `file: ${file.name || "(unnamed)"}`,
      `ext: .${ext}`,
      `content-type: ${contentType}`,
      `browser-type: ${browserType}`,
      `size: ${sizeKb} KB`,
      ...(path ? [`path: ${path}`] : []),
      ...(showVerdict ? [`allowlist: ${verdict.ok ? "pass" : `BLOCKED — ${verdict.reason}`}`] : []),
    ];
    const payload = lines.join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Upload metadata copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-[11px] space-y-1 ${
        blocked
          ? "border-destructive/50 bg-destructive/5 text-destructive"
          : "border-border bg-muted/40 text-muted-foreground"
      } ${className || ""}`}
      aria-label="Resolved upload metadata"
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 font-medium ${blocked ? "text-destructive" : "text-foreground/80"}`}>
          <FileType2 className="h-3 w-3" aria-hidden="true" />
          <span>Will upload as</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 hover:bg-background hover:text-foreground transition-colors"
          aria-label="Copy resolved upload metadata to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" aria-hidden="true" />
              <span>Copy metadata</span>
            </>
          )}
        </button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
        <span className="text-muted-foreground/70">ext</span>
        <span className={blocked ? "text-destructive" : "text-foreground"}>.{ext}</span>

        <span className="text-muted-foreground/70">type</span>
        <span className={`truncate ${blocked ? "text-destructive" : "text-foreground"}`} title={contentType}>{contentType}</span>

        {browserType !== contentType && (
          <>
            <span className="text-muted-foreground/70">browser</span>
            <span className="truncate" title={browserType}>{browserType}</span>
          </>
        )}

        <span className="text-muted-foreground/70">size</span>
        <span>{sizeKb} KB</span>

        {path && (
          <>
            <span className="text-muted-foreground/70">path</span>
            <span className={`truncate ${blocked ? "text-destructive" : "text-foreground"}`} title={path}>{path}</span>
          </>
        )}
      </div>

      {showVerdict && (
        <div
          className={`mt-1.5 flex items-start gap-1.5 rounded-md px-2 py-1 ${
            blocked
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
          role={blocked ? "alert" : "status"}
        >
          {blocked ? (
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span className="leading-tight">
            {blocked ? verdict.reason : "Allowed by upload policy"}
          </span>
        </div>
      )}
    </div>
  );
};

export default UploadFileMeta;
