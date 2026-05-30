/**
 * useTokenGateAccess — Pillar 2.
 *
 * Reads the caller's active (non-expired) `creator_token_grants` row for a
 * given creator. Returns { hasAccess, grant, isLoading }.
 *
 * Used by <SubscriberLock /> to OR in token-holder access alongside the
 * existing subscriber check.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTokenGateAccess(creatorId: string | null | undefined) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["token-gate-access", user?.id, creatorId],
    enabled: !!user?.id && !!creatorId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_token_grants")
        .select("id, balance, expires_at, mint_address, wallet_address")
        .eq("user_id", user!.id)
        .eq("creator_id", creatorId!)
        .gt("expires_at", new Date().toISOString())
        .gt("balance", 0)
        .maybeSingle();
      if (error && (error as any).code !== "PGRST116") throw error;
      return data ?? null;
    },
  });

  return {
    hasAccess: !!query.data,
    grant: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
