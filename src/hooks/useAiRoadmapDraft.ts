import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DraftedMilestone {
  title: string;
  deliverables: string;
  suggested_amount: number;
  est_days: number;
}

export interface DraftRoadmapInput {
  projectName: string;
  totalBudget: number;
  brief?: { what?: string; when?: string; vibe?: string };
  clientProfile?: { name?: string; archetype?: string | null; bio?: string | null };
  specialistProfile?: {
    name?: string;
    archetype?: string | null;
    bio?: string | null;
    roles?: string[] | null;
  };
}

/**
 * useAiRoadmapDraft — calls the Gemini-backed `draft-project-roadmap` edge
 * function and returns 3–5 structured milestones for the project workspace.
 */
export const useAiRoadmapDraft = () => {
  return useMutation<DraftedMilestone[], Error, DraftRoadmapInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("draft-project-roadmap", {
        body: input,
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return ((data as any)?.milestones ?? []) as DraftedMilestone[];
    },
  });
};
