import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { matchAlias } from "@/config/navigation";
import { trackLegacyRedirect } from "@/lib/legacy-redirect-analytics";

/**
 * Generic legacy-path redirect. Reads the current pathname, asks the
 * navigation config to resolve it to a canonical path, and issues a
 * `<Navigate replace />`. Search params and hash are preserved so deep
 * links survive the rewrite.
 *
 * Driven entirely by `NAV_ALIASES` in src/config/navigation.ts — to add a
 * new redirect, append a `matchPaths` entry to the relevant NavItem (or
 * an entry to EXTRA_ALIASES) and register a route in App.tsx via
 * `navAliasRoutes()`.
 *
 * Side effect: every successful redirect is logged via
 * `trackLegacyRedirect` so we can measure inbound traffic to legacy URLs
 * (e.g. how often `/droprooms/*` is still being hit).
 */
export const LegacyAliasRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const match = matchAlias(pathname);
  // Guard against firing the analytics event twice for the same redirect
  // when React strict-mode double-invokes effects in development.
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!match) return;
    const key = `${pathname}->${match.to}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    trackLegacyRedirect({
      from: pathname,
      to: match.to,
      prefix: match.alias.from,
    });
  }, [pathname, match]);

  // Fall through to home if no alias matches — avoids accidental redirect
  // loops if this component is mounted on a path that has no entry in
  // NAV_ALIASES.
  if (!match) return <Navigate to="/" replace />;
  return <Navigate to={`${match.to}${search}${hash}`} replace />;
};
