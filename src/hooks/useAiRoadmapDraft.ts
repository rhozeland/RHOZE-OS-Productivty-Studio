import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecentWork {
  title?: string;
  kind?: string | null;
  description?: string | null;
  mime_type?: string | null;
}

export interface DraftedMilestone {
  title: string;
  deliverables: string;
  suggested_amount: number;
  est_days: number;
  marketing_strategy?: string;
  target_metric?: { name: string; value: string };
}

export interface ProfileContext {
  name?: string;
  archetype?: string | null;
  bio?: string | null;
  roles?: string[] | null;
  region?: string | null;
  followers?: number | null;
  token_ticker?: string | null;
  token_mint?: string | null;
  recent_works?: RecentWork[];
}

export interface DraftRoadmapInput {
  projectName: string;
  totalBudget: number;
  tokenize_intent?: boolean;
  release_type?: "single" | "ep" | "album" | "visual" | "merch" | "tour" | "other";
  target_window?: string;
  brief?: { what?: string; when?: string; vibe?: string };
  clientProfile?: ProfileContext;
  specialistProfile?: ProfileContext;
}

/**
 * useAiRoadmapDraft — calls the Gemini-backed `draft-project-roadmap` edge
 * function. Pillar 5: input now carries recent_works + linked-token context
 * so the AI tailors marketing strategy + target metrics to the artist.
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

/**
 * Helper — format a drafted milestone's marketing strategy + target metric
 * into a human-readable description string. Used by both auto-draft on
 * project create and the in-workspace "Draft with AI" button so the rich
 * AI output survives even though `project_goals` has no dedicated columns.
 */
export const composeMilestoneDescription = (m: DraftedMilestone): string => {
  const parts: string[] = [m.deliverables.trim()];
  if (m.marketing_strategy?.trim()) {
    parts.push(`\n\n🎯 Strategy — ${m.marketing_strategy.trim()}`);
  }
  if (m.target_metric?.name && m.target_metric?.value) {
    parts.push(`\n📈 Target — ${m.target_metric.name}: ${m.target_metric.value}`);
  }
  return parts.join("");
};
