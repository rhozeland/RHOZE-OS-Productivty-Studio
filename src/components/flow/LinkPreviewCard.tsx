import { ChevronRight, ExternalLink, Loader2, Image as ImageIcon } from "lucide-react";
import { useLinkMetadata } from "@/hooks/useLinkMetadata";
import { useState } from "react";

interface LinkPreviewCardProps {
  url: string;
  /** When true, fetch metadata. Set false if a specialized renderer already handles this URL (yt/vimeo/image). */
  enabled?: boolean;
}

/**
 * Rich link preview used inside the Flow share dialog.
 * Falls back to a clean URL chip while loading or if metadata can't be retrieved.
 */
const LinkPreviewCard = ({ url, enabled = true }: LinkPreviewCardProps) => {
  const { data, loading, error } = useLinkMetadata(url, enabled);
  const [imgFailed, setImgFailed] = useState(false);

  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  if (!enabled) return null;

  // Loading skeleton
  if (loading && !data) {
    return (
      <div className="flex items-center gap-3 p-4 bg-background border-t border-border" aria-busy="true">
        <div className="h-12 w-12 rounded-lg bg-muted animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
        </div>
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
      </div>
    );
  }

  // Rich preview (with image)
  if (data && (data.title || data.image || data.description)) {
    const showImage = !!data.image && !imgFailed;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="block bg-background hover:bg-muted/40 transition-colors"
      >
        {showImage && (
          <div className="relative w-full max-h-56 overflow-hidden bg-muted">
            <img
              src={data.image!}
              alt={data.title || host}
              className="w-full max-h-56 object-cover"
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
          </div>
        )}
        <div className="flex items-start gap-3 p-4">
          {!showImage && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              {data.favicon ? (
                <img
                  src={data.favicon}
                  alt=""
                  className="h-5 w-5"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              {data.favicon && showImage && (
                <img
                  src={data.favicon}
                  alt=""
                  className="h-3.5 w-3.5"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <p className="text-[11px] text-muted-foreground font-body uppercase tracking-wider truncate">
                {data.siteName || host}
              </p>
            </div>
            {data.title && (
              <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                {data.title}
              </p>
            )}
            {data.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                {data.description}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        </div>
      </a>
    );
  }

  // Error or empty — minimal fallback
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-3 p-4 bg-background hover:bg-muted/50 transition-colors"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
        <ExternalLink className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">
          {error ? "Preview unavailable" : "External link"}
        </p>
        <p className="text-sm font-medium text-foreground truncate">{url}</p>
      </div>
    </a>
  );
};

export default LinkPreviewCard;
