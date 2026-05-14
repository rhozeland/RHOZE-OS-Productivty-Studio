/**
 * StreamComposer — the v7 "Drop" composer at the top of /stream.
 *
 * One inline surface offering all post types. Text-style posts (a quick
 * thought + optional link/image) submit inline against `flow_items` so
 * they appear immediately in the Conversations lane. Richer types
 * (offering, opportunity, event, space, work, project) navigate to their
 * existing canonical creation surfaces — we don't re-implement those
 * flows here, we just put a single front door on top of them.
 *
 * Lane-aware: the active lane sets the default selected type, so the
 * primary action button reads naturally ("Drop" on Conversations,
 * "Post Offering" on Offerings, etc.).
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { Button } from "@/components/ui/button";
import {
  Flame,
  CalendarDays,
  Building2,
  Shield,
  TrendingUp,
  Plus,
} from "lucide-react";
import NoteComposer from "@/components/notes/NoteComposer";
import { useToast } from "@/hooks/use-toast";

export type StreamPostType =
  | "text"
  | "event"
  | "space"
  | "work"
  | "prediction";

interface TypeMeta {
  key: StreamPostType;
  label: string;
  icon: typeof Flame;
  /** Inline composer (text) vs. navigates to canonical creation page */
  inline: boolean;
  /** Where to navigate for non-inline types */
  href?: string;
  /** CTA copy when this type is selected */
  cta: string;
  /** Optional helper line shown when this type is active */
  hint?: string;
  /** Soft-coming-soon — shows a toast instead of navigating. */
  comingSoon?: boolean;
}

const TYPES: TypeMeta[] = [
  { key: "text",       label: "Update",     icon: Flame,        inline: true,  cta: "Leave a note" },
  { key: "work",       label: "Work",       icon: Shield,       inline: false, href: "/settings#verification",       cta: "Anchor Work",
    hint: "Upload a finished piece — gets content-hashed and shown on your profile." },
  { key: "event",      label: "Event",      icon: CalendarDays, inline: false, href: "/spaces/events/new",           cta: "Host Event" },
  { key: "space",      label: "Space",      icon: Building2,    inline: false, href: "/studios/apply",               cta: "List Space" },
  { key: "prediction", label: "Prediction", icon: TrendingUp,   inline: false, cta: "New market",
    hint: "Create a YES/NO market on a creator's next move. Coming soon.",
    comingSoon: true },
];

interface Props {
  /** Active lane in Stream — drives the default selected type. */
  defaultType?: StreamPostType;
  /** Optional category to tag inline posts with (e.g. "music"). */
  defaultCategory?: string;
}

const StreamComposer = ({ defaultType = "text", defaultCategory }: Props) => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [type, setType] = useState<StreamPostType>(defaultType);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // Re-sync default when lane changes (HubPage drives this).
  useEffect(() => setType(defaultType), [defaultType]);

  const meta = TYPES.find((t) => t.key === type)!;
  const Icon = meta.icon;

  // Update no longer writes to flow_items — it opens the Notes composer.
  // Kept the mutation shell removed; createDrop is unused now.

  const handlePrimary = () => {
    if (!requireAuth("Sign up to leave a note.")) return;
    if (type === "text") {
      setNoteOpen(true);
      return;
    }
    if (meta.href) navigate(meta.href);
  };

  return (
    <div id="discover-composer" className="rounded-3xl border border-border bg-card/80 backdrop-blur-sm p-4 sm:p-5 space-y-3 scroll-mt-20">
      {/* Type pills */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {TYPES.map((t) => {
          const active = type === t.key;
          const TIcon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setType(t.key);
                if (t.inline) {
                  setExpanded(true);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                } else {
                  setExpanded(false);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-pressed={active}
            >
              <TIcon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Primary action row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground hidden sm:block">
          {type === "text"
            ? "Leave a 60-word note — disappears in 24h, shows on your profile + DMs."
            : meta.hint ?? `Opens the full ${meta.label.toLowerCase()} flow.`}
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            onClick={handlePrimary}
            className="rounded-full gap-1.5"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" />
            {meta.cta}
          </Button>
        </div>
      </div>

      <NoteComposer open={noteOpen} onOpenChange={setNoteOpen} />
    </div>
  );
};

export default StreamComposer;
