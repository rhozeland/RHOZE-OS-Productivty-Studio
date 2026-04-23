import { useLocation } from "react-router-dom";
import {
  NAV_ITEMS_BY_ID,
  isNavItemActive,
  type NavItem,
} from "@/config/navigation";

/**
 * Shared resolved-link descriptor consumed by every nav surface
 * (header in AppLayout, DockBar, AppSidebar, and any future menus).
 *
 * Centralizing this prevents the classic drift bug where one surface
 * highlights the active item on `/drop-rooms/:id` and another doesn't,
 * because each was computing `isActive` with slightly different rules.
 */
export interface ResolvedNavLink {
  /** Final href to pass to <Link>/<NavLink>. */
  to: string;
  /** True if the current pathname should mark this link active. */
  isActive: boolean;
  /** Drop-in for `aria-current` — `"page"` when active, undefined otherwise. */
  ariaCurrent: "page" | undefined;
}

/**
 * Single-source-of-truth helper. Pure — easy to unit test and reuse from
 * non-React code (e.g. the dev-only route registry check in AppLayout).
 */
export const resolveNavLink = (
  target: NavItem | { path: string; matchPaths?: string[] },
  pathname: string,
): ResolvedNavLink => {
  // Accept either a full NavItem or a lightweight `{ path, matchPaths }`
  // shape so ad-hoc links (e.g. /profiles/:userId, /admin) can opt in
  // without being added to the global NAV_ITEMS list.
  const item: NavItem = {
    id: "id" in target ? target.id : target.path,
    label: "label" in target ? target.label : target.path,
    icon: "icon" in target ? target.icon : (() => null) as never,
    path: target.path,
    matchPaths: target.matchPaths,
  };
  const active = isNavItemActive(item, pathname);
  return {
    to: item.path,
    isActive: active,
    ariaCurrent: active ? "page" : undefined,
  };
};

/**
 * React hook wrapper around `resolveNavLink` that reads the current
 * pathname from React Router. Use this in components — pass the bare
 * helper to non-component code.
 *
 * @example
 *   const studios = useNavLink("studios");
 *   <Link to={studios.to} aria-current={studios.ariaCurrent} ... />
 */
export const useNavLink = (
  target: string | NavItem | { path: string; matchPaths?: string[] },
): ResolvedNavLink => {
  const { pathname } = useLocation();
  // String shorthand — look up by id in the registry. Falls back to a
  // path-only descriptor so callers using ad-hoc paths still work.
  const resolved =
    typeof target === "string"
      ? NAV_ITEMS_BY_ID[target] ?? { path: target }
      : target;
  return resolveNavLink(resolved, pathname);
};
