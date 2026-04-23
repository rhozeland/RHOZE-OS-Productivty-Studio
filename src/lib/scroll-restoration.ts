/**
 * Pure helpers for per-route scroll restoration.
 * ─────────────────────────────────────────────────────────────────────────
 * Browsers natively restore scroll on history back/forward, but only when
 * `history.scrollRestoration === "auto"` AND the SPA never re-mounts the
 * page during navigation. React Router unmounts and remounts the matched
 * <Outlet/>, so scroll position is lost. We take over by:
 *
 *   1. Saving `window.scrollY` keyed by `<pathname>+<search>` whenever the
 *      user navigates AWAY (location change effect cleanup).
 *   2. On arrival at a new location:
 *        - PUSH navigations  → scroll to top (fresh visit)
 *        - POP navigations   → restore the saved Y for that key (back/forward)
 *        - REPLACE navigations → leave scroll alone (e.g. hash-only updates
 *          like Settings sub-nav must not jump the page)
 *
 * Hash anchors (`#some-id`) are honored for PUSH navigations only — if the
 * id resolves to an element, we scroll it into view instead of going to top.
 */

/** Scroll position store. In-memory map keyed by pathname+search. */
export type ScrollStore = Map<string, number>;

/** Build the storage key for a location. Hash is excluded so that hash-only
 *  navigations (e.g. /settings#wallet vs /settings#privacy) share a slot. */
export const buildScrollKey = (pathname: string, search: string): string =>
  `${pathname}${search}`;

export type NavAction = "PUSH" | "POP" | "REPLACE";

export interface RestoreDecision {
  /** What to do on arrival at the new location. */
  action: "scroll-to-top" | "restore" | "scroll-to-anchor" | "noop";
  /** Saved Y to restore (only set when action === "restore"). */
  y?: number;
  /** Anchor element id to scroll into view (only when "scroll-to-anchor"). */
  anchorId?: string;
}

/**
 * Decide what scroll behavior to apply when arriving at `next`. Pure — the
 * caller wires it to actual DOM side-effects (or jsdom in tests).
 */
export const decideRestore = (
  next: { pathname: string; search: string; hash: string },
  navAction: NavAction,
  store: ScrollStore,
): RestoreDecision => {
  // REPLACE = same logical page, just url-bar tweak (hash, query). Don't
  // disturb the user's current scroll. Settings sub-nav relies on this.
  if (navAction === "REPLACE") return { action: "noop" };

  // POP = browser back/forward — restore exactly what the user saw last.
  if (navAction === "POP") {
    const key = buildScrollKey(next.pathname, next.search);
    const y = store.get(key);
    if (typeof y === "number") return { action: "restore", y };
    return { action: "scroll-to-top" };
  }

  // PUSH = a fresh navigation. Honor explicit anchors first, otherwise
  // start at the top so the new page's hero is visible.
  const anchorId = next.hash.replace(/^#/, "").trim();
  if (anchorId) return { action: "scroll-to-anchor", anchorId };
  return { action: "scroll-to-top" };
};
