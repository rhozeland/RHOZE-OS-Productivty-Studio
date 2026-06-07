/**
 * Editor-only side rail mirrored opposite the public SupportPanel.
 * Lets the artist jump to the public release page and share/copy its URL.
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
}

const EditorSideRail = ({ isPublic, publicSlug, projectTitle, cheerCount = 0 }: Props) => {
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

  return (
    <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-3xl font-display font-bold tabular-nums">{cheerCount}</div>
          <div className="text-xs text-muted-foreground">{cheerCount === 1 ? "supporter" : "supporters"}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${isPublic ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
          {isPublic ? "Public" : "Private"}
        </span>
      </div>

      {isPublic && releaseUrl ? (
        <>
          <Button asChild size="lg" className="w-full gap-2 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white font-semibold hover:opacity-95 shadow-lg shadow-rose-500/20">
            <Link to={`/release/${publicSlug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              View public page
            </Link>
          </Button>
          <p className="text-[11px] text-muted-foreground text-center leading-snug">
            Share the public release so fans can support, comment, and follow milestones live.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={shareNative} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Copy link
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[12px] text-muted-foreground leading-snug">
          Toggle <span className="font-medium text-foreground">Build in public</span> on the cover to share this release with fans.
        </p>
      )}
    </div>
  );
};

export default EditorSideRail;
