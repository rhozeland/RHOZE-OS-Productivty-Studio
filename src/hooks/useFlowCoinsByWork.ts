/**
 * useFlowCoinsByCreator — shared lookup that maps `creator_id → { id, ticker }`
 * for any active coin_launches (profile coins) belonging to those creators.
 *
 * As of the profile-only coin pivot, coins are bound to a creator's profile
 * (not to a single work). This hook surfaces a "$TICKER" speculate pill on
 * any Flow card whose uploader has launched a profile coin.
 *
 * The legacy `useFlowCoinsByWork` export is kept (no-op style) so older
 * call-sites compile during the transition; new code should use
 * `useFlowCoinsByCreator`.
 *
 * The query is keyed on the *sorted* id list so the cache stays stable
 * across re-renders that hand in the same set in a different order.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FlowCoinSummary = {
  id: string;
  ticker: string;
  status: string;
};

export const useFlowCoinsByCreator = (
  creatorIds: Array<string | null | undefined>,
) => {
  const cleaned = Array.from(
    new Set(creatorIds.filter((id): id is string => !!id)),
  ).sort();

  return useQuery({
    queryKey: ["flow-coins-by-creator", cleaned],
    queryFn: async (): Promise<Map<string, FlowCoinSummary>> => {
      if (cleaned.length === 0) return new Map();
      const { data, error } = await supabase
        .from("coin_launches")
        .select("id, ticker, status, creator_id, work_id, created_at")
        .in("creator_id", cleaned)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, FlowCoinSummary>();
      // Prefer profile coins (work_id IS NULL) over work-bound legacy coins.
      // The order is "newest first"; we only set the first occurrence per
      // creator, with profile coins taking precedence on a tie.
      const profileFirst = [...(data ?? [])].sort((a, b) => {
        const aIsProfile = a.work_id == null ? 0 : 1;
        const bIsProfile = b.work_id == null ? 0 : 1;
        return aIsProfile - bIsProfile;
      });
      for (const row of profileFirst) {
        const cid = row.creator_id as string | null;
        if (!cid || map.has(cid)) continue;
        map.set(cid, {
          id: row.id as string,
          ticker: row.ticker as string,
          status: row.status as string,
        });
      }
      return map;
    },
    enabled: cleaned.length > 0,
    staleTime: 30_000,
  });
};

/** @deprecated Use useFlowCoinsByCreator. Kept as a thin shim returning empty. */
export const useFlowCoinsByWork = (_workIds: Array<string | null | undefined>) => {
  return useQuery({
    queryKey: ["flow-coins-by-work-noop"],
    queryFn: async () => new Map<string, FlowCoinSummary>(),
    enabled: false,
    staleTime: Infinity,
  });
};
