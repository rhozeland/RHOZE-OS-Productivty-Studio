/**
 * rewards-catalog.ts — single source of truth for fan/creator $RHOZE rewards.
 *
 * v7 hybrid model: small daily-capped rewards for engagement, bigger commerce
 * rewards that align fan spending with artist payouts.
 *
 * Every reward routes through `pending_rewards` and waits for admin approval
 * before being credited to `user_credits` (the existing Admin Reward Gate).
 * This file only describes the *intent*; the on-DB triggers and edge functions
 * remain the actual enforcement layer.
 */

export type RewardCategory = "engagement" | "commerce" | "milestone";

export interface RewardEntry {
  /** action_type stored on `pending_rewards.action_type` */
  action: string;
  /** Short, fan-facing label */
  label: string;
  /** One-line description */
  description: string;
  /** Either a fixed $RHOZE amount, a formula string, or "%" rebate copy */
  amount: string;
  category: RewardCategory;
  /** Per-day or lifetime cap copy */
  cap?: string;
}

export const REWARDS_CATALOG: RewardEntry[] = [
  // —— Engagement (small, capped) ——
  {
    action: "like_work",
    label: "Like a work",
    description: "Tap the heart on any work.",
    amount: "0.5 $RHOZE",
    category: "engagement",
    cap: "Cap 20/day",
  },
  {
    action: "follow_artist",
    label: "Follow an artist",
    description: "Subscribe to a creator's updates.",
    amount: "1 $RHOZE",
    category: "engagement",
    cap: "Cap 10/day",
  },
  {
    action: "comment_work",
    label: "Comment on a work",
    description: "Leave a thoughtful comment.",
    amount: "0.5 $RHOZE",
    category: "engagement",
    cap: "Cap 20/day",
  },
  {
    action: "attend_space",
    label: "Attend a free Space",
    description: "Show up to a free event.",
    amount: "5 $RHOZE",
    category: "engagement",
    cap: "Per event",
  },
  {
    action: "complete_profile",
    label: "Complete your profile",
    description: "Display name, bio, avatar, and at least one social link.",
    amount: "25 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },

  // —— Commerce (bigger, drives the loop) ——
  {
    action: "buy_work",
    label: "Buy a work",
    description: "Earn 5% of your fiat spend back as $RHOZE.",
    amount: "5% of spend",
    category: "commerce",
  },
  {
    action: "hold_artist_coin_7d",
    label: "Hold an artist coin for 7 days",
    description: "Reward fans who back creators they believe in.",
    amount: "10 $RHOZE",
    category: "commerce",
    cap: "Per coin per week",
  },
  {
    action: "swap_into_artist_coin",
    label: "First swap into an artist coin",
    description: "2% rebate the first time you swap $RHOZE → that artist's coin.",
    amount: "2% rebate",
    category: "commerce",
    cap: "Once per coin",
  },
  {
    action: "attend_paid_space",
    label: "Attend a paid Space",
    description: "Buy a ticket and show up.",
    amount: "25 $RHOZE",
    category: "commerce",
    cap: "Per event",
  },
  {
    action: "refer_paying_user",
    label: "Refer a paying user",
    description: "Your invitee makes their first purchase.",
    amount: "100 $RHOZE",
    category: "commerce",
    cap: "Per referral",
  },
];

export const REWARDS_BY_CATEGORY: Record<RewardCategory, RewardEntry[]> = {
  engagement: REWARDS_CATALOG.filter((r) => r.category === "engagement"),
  commerce: REWARDS_CATALOG.filter((r) => r.category === "commerce"),
  milestone: REWARDS_CATALOG.filter((r) => r.category === "milestone"),
};
