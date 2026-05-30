/**
 * StreamComposer — Pillar 6 rewrite.
 *
 * Single intent: **Post Work**. Three media chips (Audio · Visual · Photo)
 * deeplink to the canonical upload flow at `/settings#provenance` with a
 * `?upload=<kind>` query param so the file picker opens pre-filtered.
 *
 * The previous "Update/note + Event + Space + Prediction" pill collection
 * has been removed — those flows live in the global `<PostMenuButton />`
 * (events/spaces) and aren't appropriate for the public Feed surface.
 */
import { useNavigate } from "react-router-dom";
import { useAuthGate } from "@/components/AuthGateDialog";
import { Headphones, Film, Image as ImageIcon, ArrowRight } from "lucide-react";

type WorkKind = "music" | "video" | "photo";

const KINDS: { key: WorkKind; label: string; hint: string; Icon: typeof Headphones }[] = [
  { key: "music", label: "Music", hint: "Track, demo, voice memo",    Icon: Headphones },
  { key: "video", label: "Video", hint: "Performance, motion, BTS",   Icon: Film },
  { key: "photo", label: "Photo", hint: "Cover art, press, stills",   Icon: ImageIcon },
];


interface Props {
  /** Optional: kept for backward compat with HubPage props. Unused. */
  defaultType?: string;
  defaultCategory?: string;
}

const StreamComposer = (_: Props = {}) => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();

  const handlePick = (kind: WorkKind) => {
    if (!requireAuth("Sign up to post your work.")) return;
    // v11 Pillar 7 — Share to Flow is the single upload surface. Vibe pre-selected.
    navigate(`/flow?share=1&vibe=${kind}`);
  };


  return (
    <div
      id="discover-composer"
      className="rounded-3xl border border-border bg-card/80 backdrop-blur-sm p-4 sm:p-5 scroll-mt-20"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-display text-sm font-semibold text-foreground">
          Post a work
        </h2>
        <p className="text-[11px] text-muted-foreground hidden sm:block">
          Hashed in your browser · optional on-chain anchor
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KINDS.map(({ key, label, hint, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePick(key)}
            className="group flex flex-col items-start gap-1.5 rounded-2xl border border-border bg-muted/30 px-3 py-3 text-left transition-all hover:border-foreground/30 hover:bg-muted/60"
          >
            <div className="flex w-full items-center justify-between">
              <Icon className="h-4 w-4 text-foreground" />
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {hint}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StreamComposer;
