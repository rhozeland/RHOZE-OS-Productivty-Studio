/**
 * StartProjectPicker — single entry point for "Start a Project" across
 * `/market`, `/home`, and `/studio`.
 *
 * Two phases:
 *   1. "pick" — Notion-style 2-card chooser: Build with AI · Empty page.
 *   2. "ai"   — Notion-style prompt sheet: textarea + music-native
 *               suggestion chips. On submit, stashes the brief in
 *               sessionStorage and routes to the new-project flow where
 *               NewProjectDialog auto-creates and AiRoadmapDraftButton
 *               auto-drafts using that brief.
 *
 * Branded to Rhozeland — uses the project's font-display, semantic tokens,
 * and todayGradient(). No search bar anywhere.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowUp,
  ArrowLeft,
  Disc3,
  FileText,
  Film,
  Mic,
  Music4,
  Radio,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthGate } from "@/components/AuthGateDialog";
import { todayGradient } from "@/lib/rhoze-gradients";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "pick" | "ai";

const SUGGESTIONS: { label: string; Icon: typeof Mic; prompt: string; tint: string }[] = [
  {
    label: "Single release",
    Icon: Music4,
    prompt: "Release my next single — recording, artwork, distribution, and a 2-week rollout plan.",
    tint: "text-rose-500",
  },
  {
    label: "EP campaign",
    Icon: Disc3,
    prompt: "Plan a 5-track EP — production schedule, cover art, lead single, and a release-week campaign.",
    tint: "text-fuchsia-500",
  },
  {
    label: "Music video",
    Icon: Film,
    prompt: "Shoot a music video for the lead single — concept, location, crew, edit, premiere.",
    tint: "text-amber-500",
  },
  {
    label: "Tour run",
    Icon: Radio,
    prompt: "Book a 6-city tour run — venues, promoters, ticketing, travel, merch table.",
    tint: "text-teal-500",
  },
  {
    label: "Studio session",
    Icon: Mic,
    prompt: "Block a studio week — engineer, sessions, vocal comps, rough mixes.",
    tint: "text-violet-500",
  },
];

const StartProjectPicker = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();
  const grad = todayGradient();

  const [phase, setPhase] = useState<Phase>("pick");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPhase("pick");
    setPrompt("");
    setSubmitting(false);
  };

  const handleOpen = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const { user } = useAuth();

  const createProject = async (opts: { aiPrompt?: string }) => {
    if (!user) return null;
    const title = opts.aiPrompt
      ? opts.aiPrompt.slice(0, 60)
      : "Untitled release";
    const coverColor = "#a855f7";
    const coverUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${coverColor}'/><stop offset='1' stop-color='#0a0a0a'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/></svg>`,
    )}`;
    const { data, error } = await (supabase.rpc as any)("create_project_with_owner", {
      _title: title,
      _description: opts.aiPrompt ?? "",
      _vision: opts.aiPrompt ?? "",
      _scope_of_work: null,
      _project_type: "collaborative",
      _status: "active",
      _cover_color: coverColor,
      _cover_image_url: coverUrl,
    });
    if (error) {
      toast.error(error.message ?? "Could not create project.");
      return null;
    }
    const project = Array.isArray(data) ? data[0] : data;
    return project?.id as string | undefined;
  };

  const goToBlank = async () => {
    if (!requireAuth("post")) return;
    try { sessionStorage.removeItem("startProjectMode"); } catch { /* ignore */ }
    try { sessionStorage.removeItem("startProjectAiPrompt"); } catch { /* ignore */ }
    setSubmitting(true);
    const id = await createProject({});
    setSubmitting(false);
    if (!id) return;
    handleOpen(false);
    toast.success("Project created.");
    navigate(`/projects/${id}`);
  };

  const goToAi = () => {
    if (!requireAuth("post")) return;
    setPhase("ai");
  };

  const submitAi = async () => {
    const text = prompt.trim();
    if (text.length < 6) return;
    setSubmitting(true);
    try {
      sessionStorage.setItem("startProjectMode", "ai");
      sessionStorage.setItem("startProjectAiPrompt", text);
    } catch { /* ignore */ }
    const id = await createProject({ aiPrompt: text });
    setSubmitting(false);
    if (!id) return;
    handleOpen(false);
    toast.success("Project created — drafting your roadmap…");
    navigate(`/projects/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitAi();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-xl border-border/70 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
        {phase === "pick" && (
          <div className="p-6 sm:p-8 space-y-4">
            <DialogTitle className="font-display text-2xl tracking-tight">
              Start a Project
            </DialogTitle>
            <p className="text-sm text-muted-foreground -mt-2">
              Pick how you'd like to begin. You can edit everything later.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 mt-4">
              {/* Build with AI */}
              <button
                type="button"
                onClick={goToAi}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-5 text-left transition-all hover:border-foreground/40 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div
                  className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: grad.halo }}
                />
                <div
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                  style={{ background: grad.text }}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="relative mt-3 font-display text-base font-semibold text-foreground">
                  Build with AI
                </p>
                <p className="relative mt-1 text-xs text-muted-foreground leading-relaxed">
                  Tell Rhozeland what you're making — get a roadmap with milestones, timeline, budget.
                </p>
              </button>

              {/* Empty page */}
              <button
                type="button"
                onClick={goToBlank}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-5 text-left transition-all hover:border-foreground/40 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="relative mt-3 font-display text-base font-semibold text-foreground">
                  Empty page
                </p>
                <p className="relative mt-1 text-xs text-muted-foreground leading-relaxed">
                  Start blank. You'll fill in the brief, milestones, and team yourself.
                </p>
              </button>
            </div>
          </div>
        )}

        {phase === "ai" && (
          <div className="relative p-6 sm:p-10">
            {/* Subtle Rhozeland halo behind the prompt card */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{ background: grad.surface }}
            />

            <button
              type="button"
              onClick={() => setPhase("pick")}
              className="relative inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            <div className="relative flex flex-col items-center text-center mt-6 mb-6">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-white shadow-md"
                style={{ background: grad.text }}
              >
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogTitle className="font-display text-2xl sm:text-3xl tracking-tight mt-4">
                What release do you want to build?
              </DialogTitle>
            </div>

            <div className="relative rounded-2xl border-2 border-foreground/20 focus-within:border-foreground/60 bg-background/80 backdrop-blur-sm transition-colors shadow-sm">
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="e.g. Drop a 4-track EP in 8 weeks, shoot a video for the single, plan a release party in Lagos."
                rows={4}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-12 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitAi}
                disabled={prompt.trim().length < 6 || submitting}
                aria-label="Generate roadmap"
                className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>

            {/* Suggestion chips */}
            <div className="relative mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(({ label, Icon, prompt: p, tint }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background hover:border-foreground/40 transition-all"
                >
                  <Icon className={`h-3.5 w-3.5 ${tint}`} />
                  {label}
                </button>
              ))}
            </div>

            <p className="relative mt-5 text-center text-[11px] text-muted-foreground/70">
              Press ⌘+Enter to generate.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StartProjectPicker;
