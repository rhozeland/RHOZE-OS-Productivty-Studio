/**
 * useCreatorTokenMetrics — read-only on-chain metrics for a creator's coin.
 *
 * Tries pump.fun frontend API first (covers pre-migration coins with holders +
 * market cap), then falls back to Birdeye public price endpoint, then Jupiter
 * Lite as a last resort. Adds a 7d price polyline pulled from Birdeye's
 * public history endpoint.
 *
 * Designed for the v10.3 Support sheet "Trade" tab — never used to execute
 * trades; we're a discovery overlay only.
 */
import { useQuery } from "@tanstack/react-query";

export interface CreatorTokenMetrics {
  priceUsd: number | null;
  change24h: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  holderCount: number | null;
  topHolderPct: number | null;
  sparkline7d: number[];
  /** Wallet that originally deployed the mint on pump.fun — deeplinks the
   *  creator into their own pump.fun rewards dashboard (Pillar 3). */
  creatorWallet: string | null;
  /** Cumulative USD volume reported by pump.fun. Used to estimate the
   *  creator-rewards stream (~0.05% of every trade routes to the mint
   *  creator). */
  volumeUsd: number | null;
  source: string;
  fetchedAt: number;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};

async function fetchPumpFun(mint: string): Promise<Partial<CreatorTokenMetrics>> {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`);
    if (!res.ok) return {};
    const j = await res.json();
    return {
      marketCapUsd: num(j?.usd_market_cap),
      holderCount: num(j?.num_holders ?? j?.holder_count),
      // pump.fun returns virtual reserves pre-migration; use sol reserves * sol price ≈ liquidity proxy
      liquidityUsd: num(j?.virtual_sol_reserves) != null && num(j?.virtual_token_reserves) != null
        ? (num(j?.virtual_sol_reserves)! / 1e9) * 150 // rough SOL≈$150 fallback
        : null,
      source: "pump.fun",
    };
  } catch {
    return {};
  }
}

async function fetchBirdeyePrice(mint: string): Promise<Partial<CreatorTokenMetrics>> {
  try {
    // Birdeye's public price endpoint allows unauthenticated CORS for SOL chain.
    const res = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${mint}`,
      { headers: { "x-chain": "solana" } },
    );
    if (!res.ok) return {};
    const j = await res.json();
    const v = j?.data;
    return {
      priceUsd: num(v?.value),
      change24h: num(v?.priceChange24h),
      liquidityUsd: num(v?.liquidity),
      source: "Birdeye",
    };
  } catch {
    return {};
  }
}

async function fetchJupiterPrice(mint: string): Promise<Partial<CreatorTokenMetrics>> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`);
    if (!res.ok) return {};
    const j = await res.json();
    return { priceUsd: num(j?.[mint]?.usdPrice), source: "Jupiter" };
  } catch {
    return {};
  }
}

async function fetchSparkline(mint: string): Promise<number[]> {
  try {
    // 7-day, 4h candles from Birdeye public endpoint
    const now = Math.floor(Date.now() / 1000);
    const from = now - 60 * 60 * 24 * 7;
    const res = await fetch(
      `https://public-api.birdeye.so/defi/history_price?address=${mint}&address_type=token&type=4H&time_from=${from}&time_to=${now}`,
      { headers: { "x-chain": "solana" } },
    );
    if (!res.ok) return [];
    const j = await res.json();
    const items: any[] = j?.data?.items ?? [];
    return items.map((it) => Number(it?.value)).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

export const useCreatorTokenMetrics = (mint: string | null | undefined) => {
  return useQuery<CreatorTokenMetrics | null>({
    queryKey: ["creator-token-metrics", mint],
    enabled: !!mint,
    staleTime: 60_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!mint) return null;
      const [pump, birdeye, sparkline] = await Promise.all([
        fetchPumpFun(mint),
        fetchBirdeyePrice(mint),
        fetchSparkline(mint),
      ]);
      let merged: Partial<CreatorTokenMetrics> = { ...pump, ...birdeye };
      if (merged.priceUsd == null) {
        const jup = await fetchJupiterPrice(mint);
        merged = { ...merged, ...jup };
      }
      return {
        priceUsd: merged.priceUsd ?? null,
        change24h: merged.change24h ?? null,
        marketCapUsd: merged.marketCapUsd ?? null,
        liquidityUsd: merged.liquidityUsd ?? null,
        holderCount: merged.holderCount ?? null,
        topHolderPct: null, // not available from these public endpoints; reserved for future
        sparkline7d: sparkline,
        source: merged.source ?? "—",
        fetchedAt: Date.now(),
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
