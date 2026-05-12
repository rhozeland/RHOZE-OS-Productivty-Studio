/**
 * rewards-catalog.ts — single source of truth for fan/creator $RHOZE rewards.
 *
 * v8 expanded model — three lanes:
 *   • Engagement  — small, daily-capped, keeps the network alive
 *   • Commerce    — bigger, aligns fan spend + artist payout
 *   • Milestone   — one-time unlocks (profile, verification, growth tiers)
 *
 * Every reward routes through `pending_rewards` and waits for admin approval
 * before being credited to `user_credits` (the existing Admin Reward Gate).
 * This file describes the *intent*; on-DB triggers + edge functions remain
 * the actual enforcement layer.
 */

export type RewardCategory = "engagement" | "commerce" | "milestone";

/**
 * v8.7 — fan-facing lanes. We keep `category` for back-compat, but the UI
 * groups by `lane` because users think in two modes:
 *   • connect — engaging with artists + the community
 *   • build   — running Spaces, projects, and your creative footprint
 */
export type RewardLane = "connect" | "build";

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
  lane?: RewardLane;
  /** Per-day or lifetime cap copy */
  cap?: string;
  /** Optional longer "learn more" copy surfaced on hover/expand */
  detail?: string;
}


export const REWARDS_CATALOG: RewardEntry[] = [
  // ─────────────────────────────────────────────────────────────
  // ENGAGEMENT — small, capped. Keep the network alive.
  // ─────────────────────────────────────────────────────────────
  {
    action: "like_work",
    label: "Like a work",
    description: "Tap the heart on any work.",
    amount: "0.5 $RHOZE",
    category: "engagement",
    cap: "Cap 20/day",
    detail: "Likes signal taste. Capped to prevent spam farming.",
  },
  {
    action: "comment_work",
    label: "Comment on a work",
    description: "Leave a thoughtful comment (min 8 chars).",
    amount: "0.5 $RHOZE",
    category: "engagement",
    cap: "Cap 20/day",
    detail: "Empty or template comments are flagged and rejected by the gate.",
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
    action: "send_dm",
    label: "Start a real conversation",
    description: "First DM that gets a reply.",
    amount: "2 $RHOZE",
    category: "engagement",
    cap: "Cap 5/day",
    detail: "Counted only when the other side replies — kills cold-DM farming.",
  },
  {
    action: "review_received",
    label: "Receive a review",
    description: "A buyer leaves a public review on your offering.",
    amount: "3 $RHOZE",
    category: "engagement",
    cap: "Per review",
  },
  {
    action: "daily_streak",
    label: "Daily streak",
    description: "Sign in + post or interact, 7 days running.",
    amount: "5 $RHOZE",
    category: "engagement",
    cap: "Per 7-day cycle",
  },

  // ─────────────────────────────────────────────────────────────
  // COMMERCE — bigger. The loop that funds the platform.
  // ─────────────────────────────────────────────────────────────
  {
    action: "buy_work",
    label: "Buy a work",
    description: "Earn 5% of your fiat spend back as $RHOZE.",
    amount: "5% of spend",
    category: "commerce",
  },
  {
    action: "sell_work",
    label: "Sell a work",
    description: "Earn 2% of your sale price as $RHOZE on top of the 75% payout.",
    amount: "2% of sale",
    category: "commerce",
    detail: "Stacks with the locked collaborator splits — the artist's reward, not the buyer's.",
  },
  {
    action: "publish_listing",
    label: "Publish a listing or offering",
    description: "Put a service, product, or request live.",
    amount: "5 $RHOZE",
    category: "commerce",
    cap: "Cap 3/week",
    detail: "Counts both offerings (you provide) and requests (you're hiring).",
  },
  {
    action: "listing_inquiry_received",
    label: "Listing inquiry received",
    description: "Someone connects to your listing or offering.",
    amount: "3 $RHOZE",
    category: "commerce",
    cap: "Cap 10/week",
  },
  {
    action: "listing_sale",
    label: "Listing sale closed",
    description: "An inquiry converts into a paid booking or purchase.",
    amount: "15 $RHOZE",
    category: "commerce",
    cap: "Per sale",
  },
  {
    action: "book_space",
    label: "Book a Space",
    description: "Reserve a studio or venue Space (any duration).",
    amount: "10 $RHOZE",
    category: "commerce",
    cap: "Per booking",
  },
  {
    action: "host_paid_space",
    label: "Host a paid Space",
    description: "Run a ticketed event with at least one attendee.",
    amount: "25 $RHOZE",
    category: "commerce",
    cap: "Per event",
  },
  {
    action: "attend_space",
    label: "Attend a free Space",
    description: "Show up to a free event (check-in required).",
    amount: "5 $RHOZE",
    category: "commerce",
    cap: "Per event",
  },
  {
    action: "attend_paid_space",
    label: "Attend a paid Space",
    description: "Buy a ticket and check in.",
    amount: "25 $RHOZE",
    category: "commerce",
    cap: "Per event",
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
    action: "hold_artist_coin_7d",
    label: "Hold an artist coin (7 days)",
    description: "Weekly reward for holding any artist coin in your wallet.",
    amount: "10 $RHOZE",
    category: "commerce",
    cap: "Per coin per week",
  },
  {
    action: "hold_artist_coin_30d",
    label: "Hold an artist coin (30 days)",
    description: "Diamond-hand bonus on top of the weekly hold reward.",
    amount: "50 $RHOZE",
    category: "commerce",
    cap: "Per coin per month",
    detail: "Resets if you sell more than 25% of your position before day 30.",
  },
  {
    action: "refer_paying_user",
    label: "Refer a paying user",
    description: "Your invitee makes their first purchase.",
    amount: "100 $RHOZE",
    category: "commerce",
    cap: "Per referral",
  },

  // ─────────────────────────────────────────────────────────────
  // MILESTONE — one-time unlocks. Growth + verification.
  // ─────────────────────────────────────────────────────────────
  {
    action: "complete_profile",
    label: "Complete your profile",
    description: "Display name, bio, avatar, and at least one social link.",
    amount: "25 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "upload_work",
    label: "Drop a work",
    description: "Every work you post earns you $RHOZE — no review needed.",
    amount: "10 $RHOZE",
    category: "milestone",
    cap: "Cap 5/day",
    detail: "Posting always pays. If admins later mark it Verified IP, you get a 50 $RHOZE bonus on top.",
  },
  {
    action: "first_work_uploaded",
    label: "Upload your first work",
    description: "First post bonus on top of the per-work reward.",
    amount: "10 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "ten_works_uploaded",
    label: "10 works uploaded",
    description: "Build a real portfolio.",
    amount: "50 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "verified_ip_approved",
    label: "Work approved as Verified IP",
    description: "Admin confirms provenance — anchored on Solana, on top of the upload reward.",
    amount: "50 $RHOZE",
    category: "milestone",
    cap: "Per work",
    detail: "Stacks with the 10 $RHOZE you got for uploading. Sets you up for Verified Artist (need 3 approved).",
  },
  {
    action: "first_work_anchored",
    label: "First work anchored",
    description: "Bonus the first time a work gets Verified IP approval.",
    amount: "25 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "ten_works_anchored",
    label: "10 works anchored",
    description: "Real provenance, real volume.",
    amount: "100 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "verified_artist",
    label: "Become a Verified Artist",
    description: "3 Verified IP works + admin approval — unlocks paid services and coin launches.",
    amount: "250 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "first_share_trade",
    label: "First Share bought or sold",
    description: "Your first time backing a creator's Shares — buyer or seller side.",
    amount: "25 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "first_space_booked",
    label: "First Space booked",
    description: "First time you book or host a Space booking.",
    amount: "25 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "first_coin_launch",
    label: "Launch your first artist coin",
    description: "Verified Artists only. One-time bonus on launch.",
    amount: "100 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "followers_100",
    label: "100 followers",
    description: "Cross your first follower milestone.",
    amount: "25 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "followers_1k",
    label: "1,000 followers",
    description: "Real audience traction.",
    amount: "150 $RHOZE",
    category: "milestone",
    cap: "One-time",
  },
  {
    action: "work_views_1k",
    label: "1,000 views on a single work",
    description: "Cumulative views across Discover, Flow, and your profile.",
    amount: "30 $RHOZE",
    category: "milestone",
    cap: "Per work",
  },
  {
    action: "work_views_10k",
    label: "10,000 views on a single work",
    description: "Breakout-level reach.",
    amount: "200 $RHOZE",
    category: "milestone",
    cap: "Per work",
  },
  {
    action: "milestone_approved",
    label: "Project milestone approved",
    description: "Both sides sign off on a stage in a paid project.",
    amount: "20 $RHOZE",
    category: "milestone",
    cap: "Per milestone",
  },
];

export const REWARDS_BY_CATEGORY: Record<RewardCategory, RewardEntry[]> = {
  engagement: REWARDS_CATALOG.filter((r) => r.category === "engagement"),
  commerce: REWARDS_CATALOG.filter((r) => r.category === "commerce"),
  milestone: REWARDS_CATALOG.filter((r) => r.category === "milestone"),
};

/**
 * v8.7 — fan-facing lane mapping. Two modes only:
 *   • connect — engaging with artists & community
 *       (likes, comments, follows, DMs, reviews, streaks, attending events,
 *        backing artist coins, referrals)
 *   • build   — running Spaces, projects, listings, your creative footprint
 *       (publishing listings, hosting Spaces, sales, bookings, milestones,
 *        verification, projects, coin launches)
 */
const LANE_BY_ACTION: Record<string, RewardLane> = {
  // — connect —
  like_work: "connect",
  comment_work: "connect",
  follow_artist: "connect",
  send_dm: "connect",
  daily_streak: "connect",
  attend_space: "connect",
  attend_paid_space: "connect",
  swap_into_artist_coin: "connect",
  hold_artist_coin_7d: "connect",
  hold_artist_coin_30d: "connect",
  refer_paying_user: "connect",
  buy_work: "connect",
  followers_100: "connect",
  followers_1k: "connect",

  // — build —
  review_received: "build",
  publish_listing: "build",
  listing_inquiry_received: "build",
  listing_sale: "build",
  sell_work: "build",
  book_space: "build",
  host_paid_space: "build",
  complete_profile: "build",
  upload_work: "build",
  first_work_uploaded: "build",
  ten_works_uploaded: "build",
  verified_ip_approved: "build",
  first_work_anchored: "build",
  ten_works_anchored: "build",
  verified_artist: "build",
  first_share_trade: "build",
  first_space_booked: "build",
  first_coin_launch: "build",
  work_views_1k: "build",
  work_views_10k: "build",
  milestone_approved: "build",
};

// Hydrate `.lane` on each entry so consumers can read it directly.
REWARDS_CATALOG.forEach((r) => {
  r.lane = LANE_BY_ACTION[r.action] ?? (r.category === "engagement" ? "connect" : "build");
});

export const REWARDS_BY_LANE: Record<RewardLane, RewardEntry[]> = {
  connect: REWARDS_CATALOG.filter((r) => r.lane === "connect"),
  build: REWARDS_CATALOG.filter((r) => r.lane === "build"),
};


/**
 * Flat coin-launch fee in $RHOZE. Charged to creator on first mint of each
 * coin (covers metadata pinning, vanity CA generation, and platform infra).
 * 100 $RHOZE ≈ $1, so 500 ≈ $5 — intentionally small so it doesn't gate
 * launches, but real enough to discourage spam mints.
 */
export const COIN_LAUNCH_FEE_RHOZE = 100;

