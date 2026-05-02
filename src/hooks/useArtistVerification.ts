/**
 * useArtistVerification — small reactive hook that returns the current
 * user's Verified Artist status. Cached per session via React Query.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VerificationStatus = "none" | "pending" | "verified" | "revoked";

export function useArtistVerification(userId?: string | null) {
  return useQuery({
    queryKey: ["artist-verification-status", userId ?? null],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ status: VerificationStatus; verified: boolean }> => {
      if (!userId) return { status: "none", verified: false };
      const { data, error } = await supabase
        .from("profiles")
        .select("verification_status")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const status = (data?.verification_status as VerificationStatus) ?? "none";
      return { status, verified: status === "verified" };
    },
  });
}
