/**
 * useCreatorTokens — reads all approved pump.fun tokens a creator has linked.
 *
 * v11 Pillar 8: a single creator can now link multiple coins (primary +
 * release tokens). Backed by the `creator_tokens` table; the primary row
 * mirrors back to `profiles.token_*` via DB trigger for back-compat with
 * surfaces that still read off the profile column (TokenDiscoveryChip,
 * CoinsInMotionLane, etc.).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CreatorToken {
  id: string;
  user_id: string;
  mint_address: string;
  ticker: string;
  name: string | null;
  is_primary: boolean;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export const useCreatorTokens = (userId: string | null | undefined, opts?: { includePending?: boolean }) => {
  const includePending = opts?.includePending ?? false;
  return useQuery<CreatorToken[]>({
    queryKey: ["creator-tokens", userId, includePending],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return [];
      let q = supabase
        .from("creator_tokens")
        .select("*")
        .eq("user_id", userId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (!includePending) q = q.eq("status", "approved");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CreatorToken[];
    },
  });
};
