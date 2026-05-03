/**
 * Buddies hooks — friend-style mutual connections.
 *
 * - `useBuddies()`: current user's accepted buddies, joined with their
 *   active notes (via the `list_my_buddies` RPC).
 * - `useBuddyStatus(otherUserId)`: relationship between current user and
 *   another user (`none | pending_out | pending_in | accepted`), plus
 *   request / accept / unfriend mutations.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Buddy {
  buddy_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  note_body: string | null;
  note_expires_at: string | null;
  buddied_at: string;
}

export type BuddyStatus =
  | "none"
  | "pending_out" // current user sent the request
  | "pending_in"  // current user received the request
  | "accepted"
  | "blocked";

export function useBuddies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-buddies", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Buddy[]> => {
      const { data, error } = await supabase.rpc("list_my_buddies" as any);
      if (error) throw error;
      return (data ?? []) as Buddy[];
    },
    staleTime: 30_000,
  });
}

export function useBuddyStatus(otherUserId: string | null | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["buddy-status", user?.id, otherUserId],
    enabled: !!user && !!otherUserId && user!.id !== otherUserId,
    queryFn: async (): Promise<{ status: BuddyStatus; rowId: string | null }> => {
      const { data, error } = await supabase
        .from("user_buddies" as any)
        .select("id, requester_id, addressee_id, status")
        .or(
          `and(requester_id.eq.${user!.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user!.id})`
        )
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return { status: "none", rowId: null };
      const row = data as any;
      if (row.status === "blocked") return { status: "blocked", rowId: row.id };
      if (row.status === "accepted") return { status: "accepted", rowId: row.id };
      // pending
      const isOut = row.requester_id === user!.id;
      return { status: isOut ? "pending_out" : "pending_in", rowId: row.id };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["buddy-status", user?.id, otherUserId] });
    qc.invalidateQueries({ queryKey: ["my-buddies", user?.id] });
  };

  const request = useMutation({
    mutationFn: async () => {
      if (!user || !otherUserId) throw new Error("Sign in to add a buddy.");
      const { error } = await supabase.from("user_buddies" as any).insert({
        requester_id: user.id,
        addressee_id: otherUserId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const rowId = query.data?.rowId;
      if (!rowId) throw new Error("No pending request to accept.");
      const { error } = await supabase
        .from("user_buddies" as any)
        .update({ status: "accepted" })
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () => {
      const rowId = query.data?.rowId;
      if (!rowId) return;
      const { error } = await supabase
        .from("user_buddies" as any)
        .delete()
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    status: query.data?.status ?? "none",
    isLoading: query.isLoading,
    request,
    accept,
    remove,
  };
}
