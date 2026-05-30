/**
 * AiRoadmapDraftButton — "Draft a roadmap" entry point at the top of an empty
 * project roadmap.
 *
 * v11 Pillar 6: copy no longer brands this as "AI-powered" — the
 * intelligence is implicit, the button just gets you suggested milestones to
 * edit. (Backing model is still the music-native draft-project-roadmap fn.)
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiRoadmapDraft, composeMilestoneDescription } from "@/hooks/useAiRoadmapDraft";
import { fetchCreatorContext } from "@/lib/creator-context";

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
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't draft roadmap"),
    onSettled: () => setBusy(false),
  });

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-2"
      disabled={busy || generate.isPending}
      onClick={() => generate.mutate()}
    >
      {busy || generate.isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Wand2 className="h-3.5 w-3.5" />}
      {existingGoalCount > 0 ? "Suggest more milestones" : "Draft a roadmap"}
    </Button>
  );
};

export default AiRoadmapDraftButton;
