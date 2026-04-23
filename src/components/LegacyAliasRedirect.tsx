import { Navigate, useLocation } from "react-router-dom";
import { resolveAlias } from "@/config/navigation";

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
 */
export const LegacyAliasRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const canonical = resolveAlias(pathname);
  // Fall through to the catch-all 404 if no alias matches — avoids
  // accidental redirect loops if this component is mounted on a path
  // that has no entry in NAV_ALIASES.
  if (!canonical) return <Navigate to="/" replace />;
  return <Navigate to={`${canonical}${search}${hash}`} replace />;
};
