/**
 * AiCopilotDock — floating bottom-right dock. Runs `draft-project-roadmap`
 * against the currently selected cards and inserts milestone cards.
 */
import { useState } from "react";
import { Sparkles, X, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useAiRoadmapDraft, chainMilestoneDates, composeMilestoneDescription, PHASE_LABELS } from "@/hooks/useAiRoadmapDraft";
import { fetchCreatorContext } from "@/lib/creator-context";
import { useAuth } from "@/contexts/AuthContext";
import type { CanvasCard, CanvasLane } from "@/hooks/useCanvasCards";
import { todayGradient } from "@/lib/rhoze-gradients";

interface Props {
  projectName: string;
  selectedCards: CanvasCard[];
  onInsertMilestones: (cards: Array<{ lane: CanvasLane; payload: Record<string, any> }>) => Promise<void>;
  onInsertSticky: (text: string) => Promise<void>;
}

const AiCopilotDock = ({ projectName, selectedCards, onInsertMilestones, onInsertSticky }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const draft = useAiRoadmapDraft();
  const grad = todayGradient();

  const draftRollout = async () => {
    if (!user) return;
    const context = await fetchCreatorContext(user.id).catch(() => undefined);
    const brief = [
      prompt.trim(),
      selectedCards.length
        ? `Selected assets:\n${selectedCards.map((c) => `- ${c.kind}: ${c.payload?.name ?? c.payload?.title ?? c.payload?.text ?? "untitled"}`).join("\n")}`
        : "",
    ].filter(Boolean).join("\n\n");

    try {
      const milestones = await draft.mutateAsync({
        projectName: projectName || "Untitled release",
        totalBudget: 0,
        brief: { what: brief || `Draft a rollout for "${projectName}".` },
        clientProfile: context ?? undefined,
      });
      if (!milestones.length) {
        toast.error("AI didn't return any milestones — try adding more detail.");
        return;
      }
      const dates = chainMilestoneDates(milestones);
      const nodes = milestones.map((m, i) => ({
        lane: "in_progress" as CanvasLane,
        payload: {
          title: m.title,
          phase: m.phase,
          phase_label: m.phase ? PHASE_LABELS[m.phase] : undefined,
          description: composeMilestoneDescription(m),
          start: dates[i]?.stage_date_start,
          end: dates[i]?.stage_date_end,
        },
      }));
      await onInsertMilestones(nodes);
      toast.success(`Added ${nodes.length} milestone${nodes.length === 1 ? "" : "s"} to the board.`);
      setPrompt("");
    } catch (e: any) {
      toast.error(e?.message ?? "AI is unavailable right now.");
    }
  };

  const summarize = async () => {
    if (!selectedCards.length) {
      toast.info("Select a few cards first, then hit Summarize.");
      return;
    }
    const summary = selectedCards
      .map((c) => `• [${c.kind}] ${c.payload?.name ?? c.payload?.title ?? c.payload?.text ?? "untitled"}`)
      .join("\n");
    await onInsertSticky(`Summary\n${summary}`);
    toast.success("Summary added as a note.");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:scale-105 active:scale-95 transition-transform bg-[length:200%_200%] animate-gradient-shift"
        style={{ backgroundImage: `linear-gradient(120deg, hsl(${grad.stops[0]}), hsl(${grad.stops[1]}), hsl(${grad.stops[2]}), hsl(${grad.stops[0]}))` }}
      >
        <Sparkles className="h-4 w-4" />
        AI
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[22rem] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-white shadow-sm"
          style={{ background: grad.text }}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <p className="text-sm font-semibold flex-1">AI Copilot</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          {selectedCards.length
            ? `Acting on ${selectedCards.length} selected card${selectedCards.length === 1 ? "" : "s"}.`
            : "Nothing selected — will draft from the whole release."}
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Optional: add extra direction, e.g. 'aim for a 6-week rollout, focus on Lagos.'"
          className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-xs focus:outline-none focus:border-foreground/40"
        />
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={draftRollout}
            disabled={draft.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-3 py-2 text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {draft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Draft a rollout
          </button>
          <button
            type="button"
            onClick={summarize}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
          >
            Summarize selection as a note
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiCopilotDock;
