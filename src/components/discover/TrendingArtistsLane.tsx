/**
 * TrendingArtistsLane — v10.2: retired.
 *
 * Rhozeland no longer operates the simulated launchpad, and the trending
 * score depended on `coin_swap_ledger` / `coin_holdings`. The replacement
 * is a new <TrendingTokensLane /> that reads from `profiles.token_mint_address`
 * + live Jupiter/Dexscreener prices (lands in the next loop).
 *
 * Kept as a null-returning component so existing imports keep compiling
 * during the rip-out, until callers are removed.
 */
import type { RegionMarket } from "@/lib/regions";

interface TrendingArtistsLaneProps {
  marketFilter?: RegionMarket | "All";
}

const TrendingArtistsLane = (_: TrendingArtistsLaneProps) => null;

export default TrendingArtistsLane;
