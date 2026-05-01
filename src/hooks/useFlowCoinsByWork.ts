/**
 * useFlowCoinsByWork — shared lookup that maps `work_id → { id, ticker }`
 * for any coin_launches that already exist for the given works.
 *
 * Used by Flow surfaces (cards, browse grid) to render a "$TICKER" pill
 * and a "Speculate" affordance whenever a Flow item points at a Verified
 * IP that has been launched on the bonding curve. Only `live` and
 * `graduated` launches are surfaced — cancelled launches are hidden.
 *
 * The query is keyed on the *sorted* list of work_ids so the cache stays
 * stable across re-renders that hand in the same set in a different order.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FlowCoinSummary = {
  id: string;
  ticker: string;
  status: string;
};

export const useFlowCoinsByWork = (workIds: Array<string | null | undefined>) => {
  const cleaned = Array.from(
    new Set(workIds.filter((id): id is string => !!id)),
  ).sort();

  return useQuery({
    queryKey: ["flow-coins-by-work", cleaned],
    queryFn: async (): Promise<Map<string, FlowCoinSummary>> => {
      if (cleaned.length === 0) return new Map();
      const { data, error } = await supabase
        .from("coin_launches")
        .select("id, ticker, status, work_id")
        .in("work_id", cleaned)
        .neq("status", "cancelled");
      if (error) throw error;
      const map = new Map<string, FlowCoinSummary>();
      for (const row of data ?? []) {
        if (row.work_id) {
          map.set(row.work_id as string, {
            id: row.id as string,
            ticker: row.ticker as string,
            status: row.status as string,
          });
        }
      }
      return map;
    },
    enabled: cleaned.length > 0,
    staleTime: 30_000,
  });
};
