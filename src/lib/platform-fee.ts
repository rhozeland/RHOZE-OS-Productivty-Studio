/**
 * Tier-based platform fee. Mirror of public.get_platform_fee_bps() in the DB.
 *
 * Spark / Bloom (< 25M $RHOZE held)  → 15%
 * Glow         (25M – 49M)            → 10%
 * Play         (50M+)                 →  7%
 *
 * No community reserve — host keeps 100% minus the platform fee.
 */
import type { TierId } from "@/lib/tier-matrix";

export const PLATFORM_FEE_BY_TIER: Record<TierId, number> = {
  spark: 0.15,
  bloom: 0.15,
  glow: 0.10,
  play: 0.07,
};

export function getPlatformFee(tier: TierId): number {
  return PLATFORM_FEE_BY_TIER[tier] ?? 0.15;
}

export function getPlatformFeeFromBalance(balance: number): number {
  if (balance >= 50_000_000) return 0.07;
  if (balance >= 25_000_000) return 0.10;
  return 0.15;
}

export function formatFeePct(fee: number): string {
  return `${Math.round(fee * 100)}%`;
}

/** Tier-fee summary used in copy across event/booking/marketplace surfaces. */
export const FEE_TIER_SUMMARY = "Spark/Bloom 15% · Glow 10% · Play 7%";
