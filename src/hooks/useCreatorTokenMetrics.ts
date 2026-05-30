/**
 * useCreatorTokenMetrics — read-only on-chain metrics for a creator's coin.
 *
 * v11 Pillar 8.1 — calls the `creator-token-metrics` edge function which
 * proxies pump.fun + Birdeye server-side (browser CORS made the direct
 * calls fail silently for most users). Returns market cap, ATH, holders,
 * 24h price change, volume, creator wallet, and a 7d sparkline.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CreatorTokenMetrics {
  priceUsd: number | null;
  change24h: number | null;
  marketCapUsd: number | null;
  holderCount: number | null;
  sparkline7d: number[];
  athMarketCapUsd: number | null;
  athChangePct: number | null;
  creatorWallet: string | null;
  volumeUsd: number | null;
  /** @deprecated — no longer surfaced in UI. Always null. */
  liquidityUsd: number | null;
  /** @deprecated — no longer surfaced in UI. Always null. */
  topHolderPct: number | null;
  source: string;
  fetchedAt: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const useCreatorTokenMetrics = (mint: string | null | undefined) => {
  return useQuery<CreatorTokenMetrics | null>({
    queryKey: ["creator-token-metrics", mint],
    enabled: !!mint,
    staleTime: 60_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!mint) return null;
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/creator-token-metrics?mint=${encodeURIComponent(mint)}`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
      );
      if (!res.ok) throw new Error(`token-metrics ${res.status}`);
      const j = await res.json();
      return {
        priceUsd: j.priceUsd ?? null,
        change24h: j.change24h ?? null,
        marketCapUsd: j.marketCapUsd ?? null,
        holderCount: j.holderCount ?? null,
        sparkline7d: Array.isArray(j.sparkline7d) ? j.sparkline7d : [],
        athMarketCapUsd: j.athMarketCapUsd ?? null,
        athChangePct: j.athChangePct ?? null,
        creatorWallet: j.creatorWallet ?? null,
        volumeUsd: j.volumeUsd ?? null,
        liquidityUsd: null,
        topHolderPct: null,
        source: j.source ?? "—",
        fetchedAt: j.fetchedAt ?? Date.now(),
      };
    },
  });
};

export const fmtUsdCompact = (n: number | null): string => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n > 0) return `$${n.toExponential(2)}`;
  return "$0";
};

export const fmtCount = (n: number | null): string => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
};
