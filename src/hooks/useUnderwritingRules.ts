/**
 * useUnderwritingRules — fetches the active platform underwriting rules
 * from `capital_underwriting_rules` (single-row table). Used by the
 * Capital scoring panel so admin edits flow through without a redeploy.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnderwritingRules {
  base_advance_ratio: number;
  provenance_bonus_max: number;
  tenure_floor_mult: number;
  tenure_full_months: number;
  diversification_floor_per_work: number;
  advance_cap: number;
  min_settled_events: number;
  min_anchored_works: number;
  min_advance_amount: number;
  score_weight_revenue: number;
  score_weight_provenance: number;
  score_weight_tenure: number;
  score_weight_anchored: number;
  revenue_score_target: number;
  anchored_score_per_work: number;
}

export const DEFAULT_RULES: UnderwritingRules = {
  base_advance_ratio: 0.6,
  provenance_bonus_max: 0.25,
  tenure_floor_mult: 0.5,
  tenure_full_months: 6,
  diversification_floor_per_work: 25,
  advance_cap: 25000,
  min_settled_events: 1,
  min_anchored_works: 1,
  min_advance_amount: 50,
  score_weight_revenue: 40,
  score_weight_provenance: 25,
  score_weight_tenure: 20,
  score_weight_anchored: 15,
  revenue_score_target: 5000,
  anchored_score_per_work: 5,
};

export const useUnderwritingRules = () => {
  return useQuery({
    queryKey: ["capital-underwriting-rules"],
    queryFn: async (): Promise<UnderwritingRules> => {
      const { data, error } = await (supabase as any)
        .from("capital_underwriting_rules")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_RULES;
      return {
        base_advance_ratio: Number(data.base_advance_ratio),
        provenance_bonus_max: Number(data.provenance_bonus_max),
        tenure_floor_mult: Number(data.tenure_floor_mult),
        tenure_full_months: Number(data.tenure_full_months),
        diversification_floor_per_work: Number(data.diversification_floor_per_work),
        advance_cap: Number(data.advance_cap),
        min_settled_events: Number(data.min_settled_events),
        min_anchored_works: Number(data.min_anchored_works),
        min_advance_amount: Number(data.min_advance_amount),
        score_weight_revenue: Number(data.score_weight_revenue),
        score_weight_provenance: Number(data.score_weight_provenance),
        score_weight_tenure: Number(data.score_weight_tenure),
        score_weight_anchored: Number(data.score_weight_anchored),
        revenue_score_target: Number(data.revenue_score_target),
        anchored_score_per_work: Number(data.anchored_score_per_work),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
};
