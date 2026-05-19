/**
 * End-to-end-ish tests for Flow Mode navigation invariants.
 *
 * These cover the two bugs that previously caused swipe-up to land on the
 * wrong profile:
 *
 *   1. Swipe-up resolved against the viewer instead of the item's creator.
 *   2. A deep-linked item arrived without its `profiles_public` row, so the
 *      FlowCard rendered a stuck skeleton and the peek had no target.
 *
 * The helpers exercised here are the same ones FlowModePage uses in
 * production (see `src/pages/FlowModePage.tsx`), so a regression in either
 * code path fails these tests.
 */
import { describe, it, expect } from "vitest";
import {
  resolvePeekTarget,
  mergeDeepLinkProfile,
  mergeDeepLinkIntoFeed,
  resolveDeepLinkSelection,
  normalizeLoopedIndex,
  shouldRepinDeepLink,
  type FlowItemLike,
} from "./flow-navigation";

const item = (overrides: Partial<FlowItemLike> = {}): FlowItemLike => ({
  id: "item-1",
  user_id: "creator-1",
  creator_name: "Jewwie Smalls",
  profiles: { display_name: "Jewwie Smalls", avatar_url: "https://cdn/jw.jpg" },
  ...overrides,
});

describe("resolvePeekTarget (swipe-up → correct creator)", () => {
  it("returns the *item's* user_id, not the viewer's", () => {
    const target = resolvePeekTarget(item({ user_id: "creator-xyz" }));
    expect(target?.creatorId).toBe("creator-xyz");
  });

  it("prefers profiles.display_name over creator_name", () => {
    const target = resolvePeekTarget(
      item({
        creator_name: "fallback name",
        profiles: { display_name: "Real Name", avatar_url: null },
      }),
    );
    expect(target?.initial.display_name).toBe("Real Name");
  });

  it("falls back to creator_name when profiles is missing", () => {
    const target = resolvePeekTarget(
      item({ profiles: null, creator_name: "Fang" }),
    );
    expect(target?.initial.display_name).toBe("Fang");
    expect(target?.initial.avatar_url).toBeNull();
  });

  it("returns null when item has no user_id (never silently peeks viewer)", () => {
    expect(resolvePeekTarget(item({ user_id: null }))).toBeNull();
    expect(resolvePeekTarget(item({ user_id: undefined }))).toBeNull();
  });

  it("returns null for null / undefined input", () => {
    expect(resolvePeekTarget(null)).toBeNull();
    expect(resolvePeekTarget(undefined)).toBeNull();
  });

  it("never returns the same creatorId for two different items", () => {
    const a = resolvePeekTarget(item({ id: "a", user_id: "creator-a" }));
    const b = resolvePeekTarget(item({ id: "b", user_id: "creator-b" }));
    expect(a?.creatorId).toBe("creator-a");
    expect(b?.creatorId).toBe("creator-b");
    expect(a?.creatorId).not.toBe(b?.creatorId);
  });
});

describe("mergeDeepLinkProfile (deep-link → poster attribution)", () => {
  it("attaches the profile row to the item", () => {
    const raw = item({ profiles: null });
    const merged = mergeDeepLinkProfile(raw, {
      user_id: "creator-1",
      display_name: "Jewwie Smalls",
      avatar_url: "https://cdn/jw.jpg",
      username: "jewwie",
    });
    expect(merged.profiles?.display_name).toBe("Jewwie Smalls");
    expect(merged.profiles?.avatar_url).toBe("https://cdn/jw.jpg");
  });

  it("sets profiles to null when the lookup misses", () => {
    const merged = mergeDeepLinkProfile(item({ profiles: null }), null);
    expect(merged.profiles).toBeNull();
  });

  it("preserves the item's other fields", () => {
    const merged = mergeDeepLinkProfile(
      item({ id: "deep-1", user_id: "creator-9" }),
      null,
    );
    expect(merged.id).toBe("deep-1");
    expect(merged.user_id).toBe("creator-9");
  });

  it("an enriched deep-link item peeks at the poster — not the viewer", () => {
    // Simulates: viewer clicks a shared link `/flow?item=<id>` and the page
    // hydrates the row. The resulting peek must point at the *poster*.
    const raw = item({
      id: "deep-1",
      user_id: "creator-poster",
      profiles: null,
      creator_name: null,
    });
    const enriched = mergeDeepLinkProfile(raw, {
      user_id: "creator-poster",
      display_name: "Poster",
      avatar_url: "https://cdn/poster.jpg",
      username: "poster",
    });
    const peek = resolvePeekTarget(enriched);
    expect(peek?.creatorId).toBe("creator-poster");
    expect(peek?.creatorId).not.toBe("viewer-self");
    expect(peek?.initial.display_name).toBe("Poster");
  });
});

describe("mergeDeepLinkIntoFeed", () => {
  it("prepends the deep-link item when it's missing from the feed", () => {
    const feed = [item({ id: "a" }), item({ id: "b" })];
    const deep = item({ id: "deep" });
    const merged = mergeDeepLinkIntoFeed(deep, feed);
    expect(merged.map((i) => i.id)).toEqual(["deep", "a", "b"]);
  });

  it("dedupes when the deep-link item is already in the feed", () => {
    const feed = [item({ id: "a" }), item({ id: "b" })];
    const merged = mergeDeepLinkIntoFeed(item({ id: "a" }), feed);
    expect(merged.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("returns the feed unchanged when there is no deep-link item", () => {
    const feed = [item({ id: "a" })];
    expect(mergeDeepLinkIntoFeed(null, feed)).toBe(feed);
    expect(mergeDeepLinkIntoFeed(undefined, feed)).toBe(feed);
  });
});

describe("resolveDeepLinkSelection", () => {
  it("pins to the target item when it is already in the base feed", () => {
    const base = [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })];
    expect(
      resolveDeepLinkSelection("b", base, base, {
        flowItemsFetching: false,
        hasFallbackItem: false,
      }),
    ).toEqual({ index: 1, shouldFinalize: true });
  });

  it("finalizes fallback deep-links once the feed is done loading", () => {
    const fallback = item({ id: "deep" });
    const all = [fallback, item({ id: "a" })];
    const base = [item({ id: "a" })];
    expect(
      resolveDeepLinkSelection("deep", all, base, {
        flowItemsFetching: false,
        hasFallbackItem: true,
      }),
    ).toEqual({ index: 0, shouldFinalize: true });
  });

  it("waits to finalize while the feed is still loading", () => {
    const all = [item({ id: "deep" }), item({ id: "a" })];
    const base = [item({ id: "a" })];
    expect(
      resolveDeepLinkSelection("deep", all, base, {
        flowItemsFetching: true,
        hasFallbackItem: true,
      }),
    ).toEqual({ index: 0, shouldFinalize: false });
  });

  it("returns null when the target is missing", () => {
    expect(
      resolveDeepLinkSelection("missing", [item({ id: "a" })], [item({ id: "a" })], {
        flowItemsFetching: false,
        hasFallbackItem: false,
      }),
    ).toBeNull();
  });
});

describe("deep-link repinning guards", () => {
  it("normalizes looped indexes safely", () => {
    expect(normalizeLoopedIndex(0, 5)).toBe(0);
    expect(normalizeLoopedIndex(6, 5)).toBe(1);
    expect(normalizeLoopedIndex(-1, 5)).toBe(4);
    expect(normalizeLoopedIndex(2, 0)).toBe(0);
  });

  it("re-pins when the visible card is not the deep-linked target", () => {
    expect(
      shouldRepinDeepLink({
        currentIndex: 3,
        targetIndex: 1,
        itemCount: 5,
        visibleItemId: "other",
        targetId: "target",
        isAdvancing: false,
      }),
    ).toBe(true);
  });

  it("does not re-pin while the deck is advancing to the next card", () => {
    expect(
      shouldRepinDeepLink({
        currentIndex: 0,
        targetIndex: 0,
        itemCount: 5,
        visibleItemId: "target",
        targetId: "target",
        isAdvancing: true,
      }),
    ).toBe(false);
  });

  it("does not re-pin once the current card already matches the target index and id", () => {
    expect(
      shouldRepinDeepLink({
        currentIndex: 6,
        targetIndex: 1,
        itemCount: 5,
        visibleItemId: "target",
        targetId: "target",
        isAdvancing: false,
      }),
    ).toBe(false);
  });
});
