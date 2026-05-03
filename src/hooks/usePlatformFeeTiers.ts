/**
 * usePlatformFeeTiers — live tier-fee config from `platform_fee_tiers`.
 * Falls back to the hard-coded defaults if the table read fails so checkout
 * surfaces never break.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlatformFeeTier = {
  tier_id: "spark" | "bloom" | "glow" | "play" | string;
  label: string;
  min_balance: number;
  fee_bps: number;
  sort_order: number;
};

export const DEFAULT_FEE_TIERS: PlatformFeeTier[] = [
  { tier_id: "spark", label: "Spark", min_balance: 0,         fee_bps: 1500, sort_order: 0 },
  { tier_id: "bloom", label: "Bloom", min_balance: 1_000_000, fee_bps: 1500, sort_order: 1 },
  { tier_id: "glow",  label: "Glow",  min_balance: 25_000_000, fee_bps: 1000, sort_order: 2 },
  { tier_id: "play",  label: "Play",  min_balance: 50_000_000, fee_bps: 700,  sort_order: 3 },
];

export function usePlatformFeeTiers() {
  return useQuery({
    queryKey: ["platform-fee-tiers"],
    queryFn: async (): Promise<PlatformFeeTier[]> => {
      const { data, error } = await (supabase as any)
        .from("platform_fee_tiers")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error || !data?.length) return DEFAULT_FEE_TIERS;
      return data as PlatformFeeTier[];
    },
    staleTime: 60_000,
  });
}

/** Resolve fee (0–1) for a given $RHOZE balance from a tier list. */
export function feeForBalance(balance: number, tiers: PlatformFeeTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.min_balance - a.min_balance);
  const hit = sorted.find((t) => balance >= t.min_balance);
  return (hit?.fee_bps ?? 1500) / 10000;
}
