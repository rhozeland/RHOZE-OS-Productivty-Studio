import { useState } from "react";
import { safeFileExt, safeContentType } from "@/lib/file-ext";
import { FileType2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface UploadFileMetaProps {
  file: File | null | undefined;
  /** Optional path preview to show alongside ext/content-type. */
  path?: string;
  className?: string;
}

/**
 * Tiny inline preview that shows what we'll actually send to storage:
 *   - resolved file extension (after fallback rules)
 *   - resolved content-type
 *   - optional storage path
 *
 * Helps verify uploads for files with weird/missing extensions before they hit the bucket.
 */
const UploadFileMeta = ({ file, path, className }: UploadFileMetaProps) => {
  if (!file) return null;

  const ext = safeFileExt(file);
  const contentType = safeContentType(file);
  const browserType = file.type || "—";
  const sizeKb = (file.size / 1024).toFixed(1);

  return (
    <div
      className={`mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground space-y-1 ${className || ""}`}
      aria-label="Resolved upload metadata"
    >
      <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
        <FileType2 className="h-3 w-3" aria-hidden="true" />
        <span>Will upload as</span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono">
        <span className="text-muted-foreground/70">ext</span>
        <span className="text-foreground">.{ext}</span>

        <span className="text-muted-foreground/70">type</span>
        <span className="text-foreground truncate" title={contentType}>{contentType}</span>

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
            <span className="text-foreground truncate" title={path}>{path}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default UploadFileMeta;
