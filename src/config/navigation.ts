import {
  Home,
  Building2,
  FolderKanban,
  Flame,
  MessageSquare,
  Palette,
  Radio,
  ShoppingBag,
  Calendar,
  CreditCard,
  User,
  Settings,
  Store,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for dock / primary navigation items.
 *
 * IMPORTANT: DockBar and DockCustomizer both consume this config.
 * Add new nav destinations here — never hardcode paths/labels/icons in those components.
 *
 * - `path`: the canonical route the link navigates to
 * - `matchPaths`: optional extra paths that should also count as "active"
 *   (legacy aliases, sub-route roots, etc.)
 */
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  matchPaths?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Home", icon: Home, path: "/dashboard" },
  { id: "studios", label: "Studios", icon: Building2, path: "/studios" },
  { id: "projects", label: "Projects", icon: FolderKanban, path: "/projects" },
  { id: "hub", label: "Hub", icon: Flame, path: "/creators" },
  { id: "messages", label: "Inbox", icon: MessageSquare, path: "/messages" },
  { id: "boards", label: "Boards", icon: Palette, path: "/smartboards" },
  {
    id: "droprooms",
    label: "Drops",
    icon: Radio,
    path: "/drop-rooms",
    matchPaths: ["/droprooms"],
  },
  { id: "marketplace", label: "Market", icon: ShoppingBag, path: "/marketplace" },
  { id: "calendar", label: "Calendar", icon: Calendar, path: "/calendar" },
  { id: "bookings", label: "Bookings", icon: Calendar, path: "/bookings" },
  { id: "credits", label: "Credits", icon: CreditCard, path: "/credits" },
  { id: "profile", label: "Profile", icon: User, path: "/profiles" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  { id: "services", label: "Services", icon: Store, path: "/services" },
];

export const NAV_ITEMS_BY_ID: Record<string, NavItem> = NAV_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, NavItem>,
);

export const DEFAULT_DOCK_IDS = [
  "dashboard",
  "studios",
  "projects",
  "hub",
  "messages",
];

/** Returns true if the current pathname should mark this nav item active. */
export const isNavItemActive = (item: NavItem, pathname: string): boolean => {
  const candidates = [item.path, ...(item.matchPaths ?? [])];
  return candidates.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
};

/**
 * Returns true if `id` corresponds to a registered nav item.
 * Use to validate `dock_config` values loaded from the database.
 */
export const isValidNavId = (id: unknown): id is string =>
  typeof id === "string" && id in NAV_ITEMS_BY_ID;

/**
 * Splits a list of dock ids into `valid` (resolvable in NAV_ITEMS_BY_ID) and
 * `unknown` (stale ids from old configs or future ids the client hasn't
 * shipped yet). Pure helper — easy to test and reuse from any consumer.
 */
export const partitionDockIds = (
  ids: readonly unknown[] | null | undefined,
): { valid: string[]; unknown: string[] } => {
  const valid: string[] = [];
  const unknown: string[] = [];
  for (const id of ids ?? []) {
    if (isValidNavId(id)) valid.push(id);
    else if (typeof id === "string") unknown.push(id);
  }
  return { valid, unknown };
};

// ============================================================================
// Legacy aliases / redirects — central registry
// ============================================================================
//
// ONE place to register a legacy URL → canonical URL rewrite. Two sources
// feed the final table, both routed through `LegacyAliasRedirect` which
// preserves suffix, search, and hash:
//
//   1. NavItem.matchPaths   — for legacy URLs tied to a primary nav
//                             destination. Adding the entry to NAV_ITEMS
//                             also keeps the link "active" in the dock.
//   2. EXTRA_ALIASES        — for ad-hoc / cross-cutting redirects that
//                             don't belong to a single nav item (renamed
//                             marketing pages, feature relocations, etc.).
//
// To add a NEW legacy redirect:
//
//   • If the canonical destination is already a NavItem:
//       Add `matchPaths: ["/old-path"]` to that NavItem above.
//
//   • Otherwise (any other rewrite):
//       Add `{ from: "/legacy", to: "/new-canonical" }` to EXTRA_ALIASES.
//
// That's it. The router (App.tsx) auto-mounts `<from>/*` for every entry,
// REGISTERED_ROUTE_PATHS picks them up for the nav-link sanity check, and
// `resolveAlias` handles suffix preservation. `LegacyAliasRedirect`
// re-attaches the original `?search` and `#hash` so deep links survive.

export interface NavAlias {
  /** Legacy prefix (no trailing slash, no wildcard). e.g. `/droprooms` */
  from: string;
  /** Canonical replacement prefix. e.g. `/drop-rooms` */
  to: string;
}

/**
 * Ad-hoc redirects not bound to a NavItem. Edit this array to add a new
 * legacy → canonical mapping; everything else (route registration, suffix
 * preservation, search/hash carry-over) is automatic.
 *
 * Rules enforced at module load (see `validateAliases`):
 *   - `from` and `to` must start with `/` and have no trailing slash
 *   - `from` must not equal `to` (would loop)
 *   - `to` must not be a sub-path of `from` (would loop on the suffix)
 *   - no duplicate `from` entries across NAV_ITEMS.matchPaths + EXTRA_ALIASES
 */
export const EXTRA_ALIASES: NavAlias[] = [
  // Example (uncomment + edit when you need one):
  // { from: "/old-marketing-page", to: "/landing" },
];

/**
 * Full alias table: every NavItem.matchPaths entry rewrites to that item's
 * canonical `path`, plus any EXTRA_ALIASES. Stable ordering so router
 * registration is deterministic.
 */
export const NAV_ALIASES: NavAlias[] = [
  ...NAV_ITEMS.flatMap((item) =>
    (item.matchPaths ?? []).map((from) => ({ from, to: item.path })),
  ),
  ...EXTRA_ALIASES,
];

/**
 * Sanity-check the alias table. Exported so tests can lock in the
 * invariants and fail loudly if someone adds a bad entry. Throws on the
 * first violation with a precise message naming the offending entry.
 */
export const validateAliases = (aliases: readonly NavAlias[]): void => {
  const seen = new Set<string>();
  for (const { from, to } of aliases) {
    if (!from.startsWith("/") || !to.startsWith("/")) {
      throw new Error(`Alias paths must start with "/": ${from} → ${to}`);
    }
    if (from.length > 1 && from.endsWith("/")) {
      throw new Error(`Alias 'from' must not end with "/": ${from}`);
    }
    if (to.length > 1 && to.endsWith("/")) {
      throw new Error(`Alias 'to' must not end with "/": ${to}`);
    }
    if (from === to) {
      throw new Error(`Alias would loop (from === to): ${from}`);
    }
    if (to.startsWith(from + "/")) {
      throw new Error(`Alias would loop on suffix: ${from} → ${to}`);
    }
    if (seen.has(from)) {
      throw new Error(`Duplicate alias 'from' entry: ${from}`);
    }
    seen.add(from);
  }
};

// Run once at module load so misconfigurations surface during dev/build,
// not silently at runtime when a user hits the legacy URL.
validateAliases(NAV_ALIASES);

/**
 * Rewrites a legacy pathname to its canonical form, preserving any sub-path
 * suffix. Returns `null` if no alias matches. Search and hash are preserved
 * by `LegacyAliasRedirect`, not here.
 *
 * @example
 *   resolveAlias("/droprooms")          // "/drop-rooms"
 *   resolveAlias("/droprooms/abc/chat") // "/drop-rooms/abc/chat"
 *   resolveAlias("/dashboard")          // null
 */
export const resolveAlias = (pathname: string): string | null => {
  const match = matchAlias(pathname);
  return match ? match.to : null;
};

/**
 * Like `resolveAlias` but also returns which alias entry matched, so
 * callers (e.g. analytics) can attribute the redirect to a specific
 * legacy prefix.
 */
export const matchAlias = (
  pathname: string,
): { from: string; to: string; alias: NavAlias } | null => {
  for (const alias of NAV_ALIASES) {
    const { from, to } = alias;
    if (pathname === from) return { from: pathname, to, alias };
    if (pathname.startsWith(from + "/")) {
      return { from: pathname, to: to + pathname.slice(from.length), alias };
    }
  }
  return null;
};
