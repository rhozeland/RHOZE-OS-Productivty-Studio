import { useQuery } from "@tanstack/react-query";

/**
 * Live on-chain $RHOZE market price (USD per token).
 *
 * Fetches from DexScreener (no API key, CORS-friendly). The displayed USD
 * equivalent of a user's in-app $RHOZE balance now tracks the *real* token
 * price instead of the fixed 100:1 platform top-up rate, so we don't
 * mislead users into thinking 100k credits = $1000.
 *
 * Note: the in-app top-up rate (100 $RHOZE per $1) is the price the
 * platform charges to MINT credits, not what the token is worth on the
 * open market. Those are intentionally different — top-up pricing stays
 * untouched; only the "≈ $USD" display next to a holder's balance uses
 * the live market rate.
 */
const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";

export interface RhozeMarketPrice {
  /** USD per 1 $RHOZE token. */
  priceUsd: number;
  /** Best pair we found, or null if DexScreener returned nothing. */
  pairAddress: string | null;
  /** Source label for UI ("Pump.fun", "Raydium", etc). */
  source: string | null;
}

export const useRhozeMarketPrice = () => {
  return useQuery<RhozeMarketPrice>({
    queryKey: ["rhoze-market-price", RHOZE_MINT],
    queryFn: async () => {
      // 1) Jupiter Lite price API — pump.fun-aware, returns a price even
      //    before a token has migrated to Raydium. This is our primary
      //    source. DexScreener often returns `pairs: null` for low-liquidity
      //    pump.fun tokens, which left users staring at "Market price
      //    loading…" forever.
      try {
        const res = await fetch(
          `https://lite-api.jup.ag/price/v3?ids=${RHOZE_MINT}`
        );
        if (res.ok) {
          const json = await res.json();
          const entry = json?.[RHOZE_MINT];
          const price = Number(entry?.usdPrice);
          if (Number.isFinite(price) && price > 0) {
            return {
              priceUsd: price,
              pairAddress: null,
              source: entry?.launchpad ?? "Jupiter",
            };
          }
        }
      } catch {
        // fall through to DexScreener
      }

      // 2) DexScreener fallback — used once $RHOZE has live trading pairs.
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${RHOZE_MINT}`
        );
        if (res.ok) {
          const json = await res.json();
          const pairs: any[] = Array.isArray(json?.pairs) ? json.pairs : [];
          const best = pairs
            .filter((p) => p?.priceUsd && Number(p.priceUsd) > 0)
            .sort(
              (a, b) =>
                (Number(b?.liquidity?.usd) || 0) -
                (Number(a?.liquidity?.usd) || 0)
            )[0];
          if (best) {
            return {
              priceUsd: Number(best.priceUsd),
              pairAddress: best.pairAddress ?? null,
              source: best.dexId ?? "DexScreener",
            };
          }
        }
      } catch {
        // fall through
      }

      return { priceUsd: 0, pairAddress: null, source: null };
    },
    staleTime: 60_000, // refresh every minute
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
};

/** Format a USD value with sensible precision for very small token prices. */
export const formatRhozeUsd = (usd: number): string => {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd >= 1) return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  if (usd >= 0.0001) return `$${usd.toFixed(4)}`;
  return `$${usd.toExponential(2)}`;
};
