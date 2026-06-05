/**
 * AiRoadmapDraftButton — entry point for drafting a roadmap on a fresh project.
 *
 * v11 Pillar 8 update: voice mic moved out of this surface — by the time
 * a project exists, the brief is locked. Voice intake now lives on the
 * <ProposalSheet /> summary field (where the brief is actually authored).
 * This button is now purely an AI re-draft from existing project context,
 * plus a Concierge handoff banner on success.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiRoadmapDraft, composeMilestoneDescription, chainMilestoneDates, type DraftedMilestone } from "@/hooks/useAiRoadmapDraft";
import { fetchCreatorContext } from "@/lib/creator-context";
import { ConciergeIntakeSheet } from "@/components/concierge/ConciergeIntakeSheet";
import { trackConciergeCta } from "@/lib/concierge-analytics";
import { todayGradient } from "@/lib/rhoze-gradients";

interface Props {
  projectId: string;
  projectTitle: string;
  totalBudget: number;
  clientId?: string | null;
  specialistId?: string | null;
  existingGoalCount: number;
}

const PROGRESS_STEPS = [
  "Reading your brief…",
  "Pulling your recent work and style…",
  "Drafting milestones…",
  "Budgeting each stage…",
  "Mapping marketing strategy…",
  "Finalising your roadmap…",
];

export const AiRoadmapDraftButton = ({
  projectId,
  projectTitle,
  totalBudget,
  clientId,
  specialistId,
  existingGoalCount,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const draft = useAiRoadmapDraft();
  const grad = todayGradient();

  const [busy, setBusy] = useState(false);
  const [showConcierge, setShowConcierge] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [doneMilestones, setDoneMilestones] = useState<DraftedMilestone[] | null>(null);
  const autoFiredRef = useRef(false);


  const generate = useMutation({
    mutationFn: async () => {
      setBusy(true);
      const [clientCtx, specialistCtx] = await Promise.all([
        fetchCreatorContext(clientId, "Client"),
        fetchCreatorContext(specialistId, "Creator"),
      ]);

      const tokenize_intent = !!specialistCtx.token_mint;

      // v11 Pillar 9 — if the project was created from the StartProjectPicker
      // "Build with AI" prompt, pass that brief through so the roadmap is
      // tailored to what the user actually described.
      let briefText: string | null = null;
      try { briefText = sessionStorage.getItem("startProjectAiPrompt"); } catch { /* ignore */ }

      const milestones = await draft.mutateAsync({
        projectName: projectTitle,
        totalBudget,
        tokenize_intent,
        release_type: "other",
        brief: briefText ? { what: briefText } : undefined,
        clientProfile: clientCtx,
        specialistProfile: specialistCtx,
      });

      if (!milestones.length) throw new Error("No milestones returned");

      const dates = chainMilestoneDates(milestones);
      const rows = milestones.map((m, i) => ({
        project_id: projectId,
        user_id: user!.id,
        title: m.title,
        description: composeMilestoneDescription(m),
        budget_amount: m.suggested_amount,
        sort_order: existingGoalCount + i,
        parent_id: null,
        stage_date_start: dates[i].stage_date_start,
        stage_date_end: dates[i].stage_date_end,
        due_date: dates[i].due_date,
      })) as any;
      const { error } = await supabase.from("project_goals" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-goals", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Roadmap drafted — edit anything you want.");
      setShowConcierge(true);
      trackConciergeCta("impression", { projectId, source: "ai-draft-button" });
      try { sessionStorage.removeItem("startProjectAiPrompt"); } catch { /* ignore */ }
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Couldn't draft roadmap");
      try { sessionStorage.removeItem("startProjectAiPrompt"); } catch { /* ignore */ }
    },
    onSettled: () => setBusy(false),
  });

  const isWorking = busy || generate.isPending;

  // Auto-fire once when the project was created via "Build with AI" picker.
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (existingGoalCount > 0) return;
    if (!user?.id) return;
    let mode: string | null = null;
    try { mode = sessionStorage.getItem("startProjectMode"); } catch { /* ignore */ }
    if (mode !== "ai") return;
    autoFiredRef.current = true;
    try { sessionStorage.removeItem("startProjectMode"); } catch { /* ignore */ }
    generate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, existingGoalCount]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {existingGoalCount > 0 ? "Want more milestones?" : "Empty roadmap?"}
          </p>
          <p className="text-xs text-muted-foreground">
            Draft milestones from the project brief — edit freely after.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isWorking}
            onClick={() => generate.mutate()}
          >
            {isWorking
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Wand2 className="h-3.5 w-3.5" />}
            {existingGoalCount > 0 ? "Suggest more" : "Draft a roadmap"}
          </Button>
        </div>
      </div>

      {showConcierge && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Want our A&amp;R team to run this with you?
              </p>
              <p className="text-xs text-muted-foreground">
                Rhozeland A&amp;R / Artist Development takes the draft, refines the milestones, and project-manages the release end-to-end.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                trackConciergeCta("dismissed", { projectId, source: "ai-draft-button" });
                setShowConcierge(false);
              }}
            >
              Not now
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                trackConciergeCta("intake", { projectId, source: "ai-draft-button" });
                setConciergeOpen(true);
              }}
            >
              Book a call
            </Button>
          </div>
        </div>
      )}

      <ConciergeIntakeSheet open={conciergeOpen} onOpenChange={setConciergeOpen} />
    </div>
  );
};

export default AiRoadmapDraftButton;
