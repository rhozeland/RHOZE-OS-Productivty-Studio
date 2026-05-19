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
  content_type?: string | null;
  category?: string | null;
  file_url?: string | null;
  link_url?: string | null;
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

export type DeepLinkSelection = {
  index: number;
  shouldFinalize: boolean;
};

export function normalizeLoopedIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function shouldRepinDeepLink(options: {
  currentIndex: number;
  targetIndex: number;
  itemCount: number;
  visibleItemId: string | null;
  targetId: string;
  isAdvancing: boolean;
}): boolean {
  if (options.itemCount <= 0 || options.isAdvancing) return false;
  if (options.visibleItemId !== options.targetId) return true;
  return normalizeLoopedIndex(options.currentIndex, options.itemCount) !== options.targetIndex;
}

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

/**
 * Resolve where a deep-linked item currently lives in the swipe deck.
 *
 * `shouldFinalize` flips to true only once the feed has settled enough that
 * Flow can safely clear the `?item=` param without losing the clicked item:
 *   - the target is present in the real feed, or
 *   - the target only exists via the fallback deep-link fetch and the feed is
 *     otherwise done loading.
 */
export function resolveDeepLinkSelection<T extends FlowItemLike>(
  targetId: string,
  allItems: T[],
  baseItems: T[],
  options: {
    flowItemsFetching: boolean;
    hasFallbackItem: boolean;
  },
): DeepLinkSelection | null {
  const index = allItems.findIndex((item) => item.id === targetId);
  if (index < 0) return null;

  const inBaseFeed = baseItems.some((item) => item.id === targetId);

  return {
    index,
    shouldFinalize:
      !options.flowItemsFetching && (inBaseFeed || options.hasFallbackItem),
  };
}

/**
 * Resolve which deck index should be rendered right now.
 *
 * This is stricter than `currentIndex`: when Flow is entered through a deep
 * link, we want the clicked card to render immediately even before the effect
 * that syncs `currentIndex` has had a chance to run. Without this, the deck can
 * briefly show whatever card previously lived at index 0, while the background
 * or subsequent repin settles onto the requested item.
 */
export function resolveDisplayedFlowIndex<T extends FlowItemLike>(options: {
  currentIndex: number;
  allItems: T[];
  baseItems: T[];
  targetId?: string | null;
  flowItemsFetching: boolean;
  hasFallbackItem: boolean;
}): number {
  const normalizedIndex = normalizeLoopedIndex(options.currentIndex, options.allItems.length);
  if (!options.targetId) return normalizedIndex;

  const selection = resolveDeepLinkSelection(
    options.targetId,
    options.allItems,
    options.baseItems,
    {
      flowItemsFetching: options.flowItemsFetching,
      hasFallbackItem: options.hasFallbackItem,
    },
  );

  return selection?.index ?? normalizedIndex;
}
