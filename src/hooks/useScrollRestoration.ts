import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import {
  buildScrollKey,
  decideRestore,
  type ScrollStore,
} from "@/lib/scroll-restoration";

/**
 * Per-route scroll restoration.
 * ─────────────────────────────────────────────────────────────────────────
 * Mount once at the app shell level (AppLayout). Saves `window.scrollY`
 * keyed by `pathname+search` on every navigation away, then restores it
 * on POP (back/forward) and scrolls to top on fresh PUSH navigations.
 * REPLACE navigations are left alone so hash-only updates (e.g. the
 * Settings sub-nav) don't jump the page.
 *
 * Active-link styling is unaffected — we never alter the location or the
 * DOM order of nav surfaces, only `window.scrollY` after the route has
 * already mounted.
 */
export const useScrollRestoration = () => {
  const location = useLocation();
  const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"
  const storeRef = useRef<ScrollStore>(new Map());
  // Track which key represents the page the user is currently looking at,
  // so the cleanup effect can save its scrollY before we navigate away.
  const currentKeyRef = useRef<string>(buildScrollKey(location.pathname, location.search));

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Disable native restoration so the browser doesn't fight us on POP.
    if ("scrollRestoration" in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      // Restore on unmount (StrictMode / hot-reload safety).
      return () => {
        window.history.scrollRestoration = prev;
      };
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const decision = decideRestore(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      navType,
      storeRef.current,
    );

    // Defer one frame so React has finished committing the new route's DOM
    // (without this we'd scroll before the page exists and land at 0).
    const raf = window.requestAnimationFrame(() => {
      switch (decision.action) {
        case "scroll-to-top":
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          break;
        case "restore":
          window.scrollTo({ top: decision.y ?? 0, left: 0, behavior: "auto" });
          break;
        case "scroll-to-anchor": {
          const el = decision.anchorId
            ? document.getElementById(decision.anchorId)
            : null;
          if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
          else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          break;
        }
        case "noop":
        default:
          break;
      }
    });

    // Refresh the "current page" pointer for the save-on-leave cleanup.
    currentKeyRef.current = buildScrollKey(location.pathname, location.search);

    return () => {
      window.cancelAnimationFrame(raf);
      // Save the scroll position of the page the user is leaving. We read
      // it here (cleanup) because at this point the old DOM is still in
      // place and `window.scrollY` reflects what the user was looking at.
      storeRef.current.set(currentKeyRef.current, window.scrollY);
    };
    // location.key changes on every navigation, even to the same path —
    // exactly what we want.
  }, [location.key, location.pathname, location.search, location.hash, navType]);
};
