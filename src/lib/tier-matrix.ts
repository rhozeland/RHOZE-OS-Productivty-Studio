/**
 * tier-matrix.ts — single source of truth for v7 tier eligibility + perks.
 *
 * Tiers can be unlocked TWO ways:
 *  1. Holding $RHOZE (long-term alignment)
 *  2. Ecosystem activity (posts, projects, listings, events, bookings)
 *
 * Effective tier = max(holdTier, activityTier, subscriptionTier).
 *
 * Used by CreatorPassCard (live status) and RewardsPage (public matrix).
 */

export type TierId = "spark" | "bloom" | "glow" | "play";

export interface TierActivityReqs {
  /** Verified IP works posted (any-of threshold) */
  posts?: number;
  /** Projects completed (paid or collab) */
  projects?: number;
  /** Listings published (offerings or requests) */
  listings?: number;
  /** Spaces / events hosted */
  events?: number;
  /** Successful interactions: bookings, support sent + received, milestones */
  interactions?: number;
}

export interface TierRow {
  id: TierId;
  label: string;
  /** $RHOZE balance threshold (min) */
  hold: number;
  /** Pretty hold copy (e.g. "1M–24M") */
  holdLabel: string;
  /** Any-of activity requirements */
  activity: TierActivityReqs;
  /** Short benefit blurbs */
  benefits: string[];
  /**
   * Coin drops a user can launch per rolling 30 days at this tier.
   * `null` = unlimited.
   */
  coinDropsPerMonth: number | null;
  gradient: string;
  glowColor: string;
}

export const TIERS: TierRow[] = [
  {
    id: "spark",
    label: "Spark",
    hold: 0,
    holdLabel: "0+",
    activity: {},
    benefits: [
      "1× reward multiplier",
      "Standard marketplace fees",
      "1 coin drop / 30 days",
    ],
    coinDropsPerMonth: 1,
    gradient: "linear-gradient(135deg, hsl(205 75% 65%), hsl(220 55% 42%))",
    glowColor: "hsl(210, 70%, 55%)",
  },
  {
    id: "bloom",
    label: "Bloom",
    hold: 1_000_000,
    holdLabel: "1M–24M",
    activity: { posts: 5, projects: 1, listings: 1, events: 1, interactions: 5 },
    benefits: [
      "1.25× reward multiplier",
      "5% off Spaces & services",
      "2 free IP anchors / mo",
      "3 coin drops / 30 days",
    ],
    coinDropsPerMonth: 3,
    gradient: "linear-gradient(135deg, hsl(330 65% 72%), hsl(345 55% 48%))",
    glowColor: "hsl(335, 60%, 65%)",
  },
  {
    id: "glow",
    label: "Glow",
    hold: 25_000_000,
    holdLabel: "25M–49M",
    activity: { posts: 25, projects: 3, listings: 5, events: 3, interactions: 25 },
    benefits: [
      "1.5× reward multiplier",
      "10% off Spaces & services",
      "Unlimited IP anchors",
      "10 coin drops / 30 days",
      "48h early coin access",
      "Discover boost",
    ],
    coinDropsPerMonth: 10,
    gradient: "linear-gradient(135deg, hsl(30 90% 60%), hsl(20 80% 42%))",
    glowColor: "hsl(28, 85%, 55%)",
  },
  {
    id: "play",
    label: "Play",
    hold: 50_000_000,
    holdLabel: "50M+",
    activity: { posts: 100, projects: 10, listings: 20, events: 10, interactions: 100 },
    benefits: [
      "2× reward multiplier",
      "15% off Spaces & services",
      "Unlimited coin drops",
      "Free coin launch (no platform fee)",
      "72h early coin access",
      "Featured artist placement",
      "Verified Artist fast-track",
    ],
    coinDropsPerMonth: null,
    gradient: "linear-gradient(135deg, hsl(50 90% 58%), hsl(38 80% 40%))",
    glowColor: "hsl(45, 85%, 52%)",
  },
];

export const TIER_RANK: Record<TierId, number> = {
  spark: 0,
  bloom: 1,
  glow: 2,
  play: 3,
};

/** Highest tier the user qualifies for via $RHOZE holdings. */
export function getHoldTier(balance: number): TierId {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].hold) return TIERS[i].id;
  }
  return "spark";
}

export interface ActivityCounts {
  posts: number;
  projects: number;
  listings: number;
  events: number;
  interactions: number;
}

/** Highest tier the user qualifies for via ecosystem activity (any-of). */
export function getActivityTier(a: ActivityCounts): TierId {
  let result: TierId = "spark";
  for (const t of TIERS) {
    const r = t.activity;
    if (!r.posts && !r.projects && !r.listings && !r.events && !r.interactions) continue;
    const qualifies =
      (r.posts != null && a.posts >= r.posts) ||
      (r.projects != null && a.projects >= r.projects) ||
      (r.listings != null && a.listings >= r.listings) ||
      (r.events != null && a.events >= r.events) ||
      (r.interactions != null && a.interactions >= r.interactions);
    if (qualifies && TIER_RANK[t.id] > TIER_RANK[result]) result = t.id;
  }
  return result;
}

export function getEffectiveTier(...tiers: TierId[]): TierId {
  return tiers.reduce<TierId>(
    (best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best),
    "spark",
  );
}

/** Coin drops allowed per rolling 30 days for the given tier. `null` = unlimited. */
export function getCoinDropsPerMonth(tier: TierId): number | null {
  return TIERS.find((t) => t.id === tier)?.coinDropsPerMonth ?? 1;
}

