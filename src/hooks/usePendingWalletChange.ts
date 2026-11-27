import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const PENDING_WALLET_CHANGE_QUERY_KEY = "wallet-change-pending";

export type PendingWalletChange = {
  id: string;
  requestedWallet: string;
  createdAt: string;
};

/**
 * The signed-in user's wallet change request that is waiting for an admin,
 * or null. A user has at most one (wallet_change_requests_one_pending_key).
 */
export function usePendingWalletChange({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [PENDING_WALLET_CHANGE_QUERY_KEY, user?.id],
    enabled: !!user && enabled,
    queryFn: async (): Promise<PendingWalletChange | null> => {
      const { data, error } = await supabase
        .from("wallet_change_requests")
        .select("id, requested_wallet, created_at")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            id: data.id,
            requestedWallet: data.requested_wallet,
            createdAt: data.created_at,
          }
        : null;
    },
  });
}
