/**
 * useCanDm — checks whether the current viewer is allowed to DM a given
 * receiver under the receiver's "Subscribers-only DMs" preference (v10).
 *
 * Returns { canDm, gated, loading } where:
 *  - `gated`  → receiver has opted in to subscribers-only DMs
 *  - `canDm`  → viewer is allowed to send (self, opt-out, or active sub)
 *  - if not authed, treat as "cannot DM" so callers fall back to auth gate
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCanDm(receiverId: string | null | undefined) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["can-dm", user?.id ?? "anon", receiverId],
    enabled: !!receiverId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!receiverId) return { canDm: false, gated: false };

      // Receiver's opt-in (public profile column)
      const { data: prof } = await supabase
        .from("profiles")
        .select("dm_subscribers_only")
        .eq("id", receiverId)
        .maybeSingle();
      const gated = !!prof?.dm_subscribers_only;

      if (!user) return { canDm: false, gated };
      if (user.id === receiverId) return { canDm: true, gated };
      if (!gated) return { canDm: true, gated };

      const { data: allowed } = await supabase.rpc("can_dm", {
        _sender_id: user.id,
        _receiver_id: receiverId,
      });
      return { canDm: allowed === true, gated };
    },
  });

  return {
    canDm: data?.canDm ?? false,
    gated: data?.gated ?? false,
    loading: isLoading,
  };
}
