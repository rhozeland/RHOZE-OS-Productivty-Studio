/**
 * useSubscriberRelationships — given a list of partner user_ids, returns
 * a Map<partnerId, "subscriber" | "subscribed-to" | null> indicating the
 * active subscription relationship between the current user and each partner.
 *
 *   "subscriber"    → that partner is subscribed to ME (I'm the creator)
 *   "subscribed-to" → I'm subscribed to that partner (I'm the fan)
 *   null            → no active subscription either way
 *
 * "Active" follows Stripe's cancel-at-period-end rule: status === 'active'.
 * Used by the Messages inbox to badge gated conversations.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type SubRelation = "subscriber" | "subscribed-to" | null;

export function useSubscriberRelationships(partnerIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sub-relationships", user?.id, [...partnerIds].sort().join(",")],
    enabled: !!user && partnerIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, SubRelation>> => {
      const map = new Map<string, SubRelation>();
      if (!user) return map;

      const [incoming, outgoing] = await Promise.all([
        // Partner → me  (partner is my subscriber)
        supabase
          .from("creator_subscriptions")
          .select("subscriber_id")
          .eq("creator_id", user.id)
          .eq("status", "active")
          .in("subscriber_id", partnerIds),
        // Me → partner  (I'm subscribed to them)
        supabase
          .from("creator_subscriptions")
          .select("creator_id")
          .eq("subscriber_id", user.id)
          .eq("status", "active")
          .in("creator_id", partnerIds),
      ]);

      for (const row of incoming.data ?? []) map.set(row.subscriber_id, "subscriber");
      for (const row of outgoing.data ?? []) {
        // If already marked as subscriber (mutual), keep "subscriber" (more relevant to creator).
        if (!map.has(row.creator_id)) map.set(row.creator_id, "subscribed-to");
      }
      return map;
    },
  });
}
