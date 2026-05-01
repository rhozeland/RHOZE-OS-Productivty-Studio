/**
 * useUnderwritingRules — fetches the active platform underwriting rules
 * via the `get_active_underwriting_rules` RPC.
 *
 * The base table `capital_underwriting_rules` is restricted to admins; this
 * hook intentionally goes through a SECURITY DEFINER RPC that returns only
 * the values the seller-facing Capital advance estimator needs. Sellers
 * can read these values to compute their own preview, but cannot read or
 * modify any other column on the rules table (e.g. `updated_by`,
 * `updated_at`) and cannot reach the audit log.
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

const coerce = (row: Record<string, any>): UnderwritingRules => ({
  base_advance_ratio: Number(row.base_advance_ratio),
  provenance_bonus_max: Number(row.provenance_bonus_max),
  tenure_floor_mult: Number(row.tenure_floor_mult),
  tenure_full_months: Number(row.tenure_full_months),
  diversification_floor_per_work: Number(row.diversification_floor_per_work),
  advance_cap: Number(row.advance_cap),
  min_settled_events: Number(row.min_settled_events),
  min_anchored_works: Number(row.min_anchored_works),
  min_advance_amount: Number(row.min_advance_amount),
  score_weight_revenue: Number(row.score_weight_revenue),
  score_weight_provenance: Number(row.score_weight_provenance),
  score_weight_tenure: Number(row.score_weight_tenure),
  score_weight_anchored: Number(row.score_weight_anchored),
  revenue_score_target: Number(row.revenue_score_target),
  anchored_score_per_work: Number(row.anchored_score_per_work),
});

export const useUnderwritingRules = () => {
  return useQuery({
    queryKey: ["capital-underwriting-rules"],
    queryFn: async (): Promise<UnderwritingRules> => {
      const { data, error } = await (supabase as any).rpc(
        "get_active_underwriting_rules",
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return DEFAULT_RULES;
      return coerce(row);
    },
    staleTime: 5 * 60 * 1000,
  });
};
