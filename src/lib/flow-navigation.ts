/**
 * flow-navigation — pure helpers for Flow Mode navigation invariants.
 *
 * Two invariants matter, and both are covered by tests in
 * `src/lib/flow-navigation.test.ts`:
 *
 *   1. **Swipe-up / avatar-tap always peeks at the *item's* creator**, never
 *      at the viewer or any other user. A regression here previously caused
 *      every swipe-up to navigate to the current user's own profile.
 *
 *   2. **A deep-linked item (`/flow?item=<id>`) is enriched with uploader
 *      attribution from `profiles_public`** before it's merged into the feed,
 *      so the FlowCard renders the correct avatar + display name on arrival
 *      and the up-swipe peek points at the *poster*, not at whoever clicked
 *      the link.
 *
 * These helpers are intentionally pure (no React, no Supabase) so they can
 * be tested in isolation under jsdom and reused if the feed loader moves.
 */

export type FlowItemLike = {
  id: string;
  user_id?: string | null;
  creator_name?: string | null;
  profiles?: {
    display_name?: string | null;
    avatar_url?: string | null;
    username?: string | null;
  } | null;
} & Record<string, unknown>;

export type PeekTarget = {
  creatorId: string;
  initial: {
    display_name: string | null;
    avatar_url: string | null;
  };
};

/**
 * Given a Flow item, resolve the creator-peek target.
 *
 * Returns `null` when the item has no `user_id` (we never want the peek to
 * silently fall back to the viewer — that was the bug).
 */
export function resolvePeekTarget(item: FlowItemLike | null | undefined): PeekTarget | null {
  if (!item || !item.user_id) return null;
  return {
    creatorId: item.user_id,
    initial: {
      display_name: item.profiles?.display_name ?? item.creator_name ?? null,
      avatar_url: item.profiles?.avatar_url ?? null,
    },
  };
}

/**
 * Attach a `profiles_public` row to a deep-linked Flow item so the FlowCard
 * can render the poster's avatar + name immediately on arrival.
 */
export function mergeDeepLinkProfile<T extends FlowItemLike>(
  item: T,
  profile: {
    user_id?: string;
    display_name?: string | null;
    avatar_url?: string | null;
    username?: string | null;
  } | null,
): T {
  return { ...item, profiles: profile ?? null };
}

/**
 * Merge a deep-linked item to the head of the feed, deduping by id so the
 * same card never appears twice when the feed loader later catches up.
 */
export function mergeDeepLinkIntoFeed<T extends FlowItemLike>(
  deepLinkItem: T | null | undefined,
  baseItems: T[],
): T[] {
  if (!deepLinkItem) return baseItems;
  if (baseItems.some((i) => i.id === deepLinkItem.id)) return baseItems;
  return [deepLinkItem, ...baseItems];
}
