/**
 * StartProjectPicker — Notion-style 2-card chooser shown when the user
 * clicks "Start a Project" in Connect. Lets them either build with AI
 * (auto-drafted roadmap on the new project) or start from an empty page
 * and fill everything in manually.
 *
 * No search bar — just the two options, on-brand.
 */
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileText, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthGate } from "@/components/AuthGateDialog";
import { todayGradient } from "@/lib/rhoze-gradients";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StartProjectPicker = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();
  const grad = todayGradient();

  const choose = (mode: "ai" | "blank") => {
    if (!requireAuth("post")) return;
    try {
      if (mode === "ai") sessionStorage.setItem("startProjectMode", "ai");
      else sessionStorage.removeItem("startProjectMode");
    } catch { /* ignore */ }
    onOpenChange(false);
    navigate("/messages?tab=projects&new=1");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-border/70 bg-card/95 backdrop-blur-xl p-6 sm:p-8">
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
            onClick={() => choose("ai")}
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
              Name it and Rhozeland drafts a full roadmap — milestones, timeline, budget split.
            </p>
          </button>

          {/* Empty page */}
          <button
            type="button"
            onClick={() => choose("blank")}
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
      </DialogContent>
    </Dialog>
  );
};

export default StartProjectPicker;
