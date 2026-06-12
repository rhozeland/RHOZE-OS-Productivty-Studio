/**
 * Editor support rail. Two layouts:
 *   - vertical (default): legacy side-rail card.
 *   - horizontal: compact bar that sits above the tabs.
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  isPublic: boolean;
  publicSlug?: string | null;
  projectTitle: string;
  cheerCount?: number;
  stagesComplete?: number;
  stagesTotal?: number;
  orientation?: "vertical" | "horizontal";
}

const EditorSideRail = ({
  isPublic,
  publicSlug,
  projectTitle,
  cheerCount = 0,
  stagesComplete = 0,
  stagesTotal = 0,
  orientation = "vertical",
}: Props) => {
  const releaseUrl = publicSlug ? `${typeof window !== "undefined" ? window.location.origin : ""}/release/${publicSlug}` : null;

  const copyLink = async () => {
    if (!releaseUrl) return;
    await navigator.clipboard.writeText(releaseUrl);
    toast.success("Release link copied");
  };

  const shareNative = async () => {
    if (!releaseUrl) return;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: projectTitle, url: releaseUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  };

  const pct = stagesTotal > 0 ? Math.round((stagesComplete / stagesTotal) * 100) : 0;

  if (orientation === "horizontal") {
    return (
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-3 flex flex-wrap items-center gap-3">
        {/* Supporters block */}
        <div className="flex items-center gap-2 pr-3 border-r border-border/60">
          <div className="text-2xl font-display font-bold tabular-nums leading-none bg-gradient-to-br from-rose-500 via-fuchsia-500 to-amber-400 bg-clip-text text-transparent">
            {cheerCount}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium leading-tight">
            {cheerCount === 1 ? "supporter" : "supporters"}
          </div>
          <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium ${isPublic ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
            {isPublic ? "Public" : "Private"}
          </span>
        </div>

        {/* Stage progress */}
        {stagesTotal > 0 && (
          <div className="flex items-center gap-2 min-w-[160px] flex-1 max-w-xs pr-3 border-r border-border/60">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Stages</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{stagesComplete}/{stagesTotal} · {pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Public actions */}
        <div className="flex items-center gap-2 ml-auto">
          {isPublic && releaseUrl ? (
            <>
              <Button asChild size="sm" className="gap-1.5 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white text-xs font-semibold hover:opacity-95 h-8">
                <Link to={`/release/${publicSlug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  View public page
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-snug max-w-[280px]">
              Toggle <span className="font-medium text-foreground">Build in public</span> on the cover to share.
            </p>
          )}
        </div>
      </div>
    );
  }

  const StageProgress = () =>
    stagesTotal > 0 ? (
      <div className="pt-3 mt-1 border-t border-border/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Stage progress
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {stagesComplete} of {stagesTotal} stages complete
        </p>
      </div>
    ) : null;

  return (
    <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <div className="text-2xl font-display font-bold tabular-nums leading-none bg-gradient-to-br from-rose-500 via-fuchsia-500 to-amber-400 bg-clip-text text-transparent">
            {cheerCount}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {cheerCount === 1 ? "supporter" : "supporters"}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium ${isPublic ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
          {isPublic ? "Public" : "Private"}
        </span>
      </div>
      {isPublic && releaseUrl ? (
        <>
          <Button asChild size="sm" className="w-full gap-1.5 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white text-xs font-semibold hover:opacity-95">
            <Link to={`/release/${publicSlug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              View public page
            </Link>
          </Button>
          <div className="flex items-center justify-center gap-1.5">
            <Button variant="outline" size="icon" onClick={shareNative} className="h-7 w-7" title="Share" aria-label="Share">
              <Share2 className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" onClick={copyLink} className="h-7 w-7" title="Copy link" aria-label="Copy link">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <StageProgress />
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Toggle <span className="font-medium text-foreground">Build in public</span> on the cover to share.
          </p>
          <StageProgress />
        </>
      )}
    </div>
  );
};

export default EditorSideRail;
