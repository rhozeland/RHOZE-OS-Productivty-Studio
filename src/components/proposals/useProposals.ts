/**
 * useProposals — fetches unsigned (live) and recently signed/declined
 * project proposals where the current user is either party.
 *
 * Drives the "Proposals" group at the top of the Projects inbox list.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ProposalRow = {
  id: string;
  title: string;
  summary: string | null;
  status: "draft" | "awaiting_creator" | "awaiting_client" | "signed" | "declined" | "expired";
  created_by: string;
  client_id: string;
  specialist_id: string;
  budget_credits: number;
  currency: string;
  client_signed_at: string | null;
  specialist_signed_at: string | null;
  contract_id: string | null;
  source_listing_id: string | null;
  updated_at: string;
};

export function useProposals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-proposals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_proposals")
        .select("*")
        .or(`client_id.eq.${user!.id},specialist_id.eq.${user!.id}`)
        .in("status", ["draft", "awaiting_creator", "awaiting_client"])
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ProposalRow[];
    },
  });
}

/** Returns whose turn it is for the given proposal from the viewer's perspective. */
export function proposalTurn(p: ProposalRow, myUserId: string): "you" | "them" | "both" {
  if (p.status === "draft") return "you";
  if (p.status === "awaiting_client") return myUserId === p.client_id ? "you" : "them";
  if (p.status === "awaiting_creator") return myUserId === p.specialist_id ? "you" : "them";
  return "both";
}
