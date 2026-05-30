/**
 * AiRoadmapDraftButton — entry point for drafting a roadmap on a fresh project.
 *
 * v11 Pillar 8 update: voice mic moved out of this surface — by the time
 * a project exists, the brief is locked. Voice intake now lives on the
 * <ProposalSheet /> summary field (where the brief is actually authored).
 * This button is now purely an AI re-draft from existing project context,
 * plus a Concierge handoff banner on success.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiRoadmapDraft, composeMilestoneDescription } from "@/hooks/useAiRoadmapDraft";
import { fetchCreatorContext } from "@/lib/creator-context";
import { ConciergeIntakeSheet } from "@/components/concierge/ConciergeIntakeSheet";
import { trackConciergeCta } from "@/lib/concierge-analytics";

interface Props {
  projectId: string;
  projectTitle: string;
  totalBudget: number;
  clientId?: string | null;
  specialistId?: string | null;
  existingGoalCount: number;
}

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

  const [busy, setBusy] = useState(false);
  const [showConcierge, setShowConcierge] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);

  const generate = useMutation({
    mutationFn: async () => {
      setBusy(true);
      const [clientCtx, specialistCtx] = await Promise.all([
        fetchCreatorContext(clientId, "Client"),
        fetchCreatorContext(specialistId, "Creator"),
      ]);

      const tokenize_intent = !!specialistCtx.token_mint;

      const milestones = await draft.mutateAsync({
        projectName: projectTitle,
        totalBudget,
        tokenize_intent,
        release_type: "other",
        clientProfile: clientCtx,
        specialistProfile: specialistCtx,
      });

      if (!milestones.length) throw new Error("No milestones returned");

      const rows = milestones.map((m, i) => ({
        project_id: projectId,
        user_id: user!.id,
        title: m.title,
        description: composeMilestoneDescription(m),
        budget_amount: m.suggested_amount,
        sort_order: existingGoalCount + i,
        parent_id: null,
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
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't draft roadmap"),
    onSettled: () => setBusy(false),
  });

  const isWorking = busy || generate.isPending;

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
