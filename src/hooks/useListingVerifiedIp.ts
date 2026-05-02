/**
 * useListingVerifiedIp — bulk lookup of "Verified IP" proof for marketplace
 * listings. Given a list of listing IDs, returns a Map keyed by listing_id
 * with the FIRST anchored work's signature (so the badge can deep-link to
 * Solana explorer) and a count of total anchored attachments.
 *
 * Used by:
 *   - MarketplacePage (passes hasVerifiedIp prop to <ListingCard />)
 *   - ExploreCreatorsPage (renders inline badge on guest creator grid)
 *
 * Why a hook (not inline): the same join — work_attachments → works filtered
 * by `solana_signature IS NOT NULL` — is reused on every listing surface.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ListingVerifiedIp {
  signature: string;
  count: number;
}

export const useListingVerifiedIp = (listingIds: string[]) => {
  return useQuery({
    queryKey: ["listing-verified-ip", listingIds.slice().sort()],
    enabled: listingIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, ListingVerifiedIp>> => {
      const { data, error } = await supabase
        .from("work_attachments")
        .select("target_id, works:works(solana_signature, anchored_at)")
        .eq("target_type", "listing")
        .in("target_id", listingIds);

      if (error) throw error;

      const map = new Map<string, ListingVerifiedIp>();
      (data ?? []).forEach((row: any) => {
        const sig: string | null = row.works?.solana_signature ?? null;
        if (!sig) return;
        const existing = map.get(row.target_id);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(row.target_id, { signature: sig, count: 1 });
        }
      });
      return map;
    },
  });
};
