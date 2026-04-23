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
// Legacy aliases / redirects
// ============================================================================
//
// Centralized map of legacy URL prefixes → canonical paths. Derived
// automatically from each nav item's `matchPaths`, so adding a new alias
// is a one-line change in NAV_ITEMS — the router picks it up via
// LegacyAliasRedirect (see src/components/LegacyAliasRedirect.tsx).
//
// Add ad-hoc redirects (paths not tied to a nav item) to EXTRA_ALIASES.

interface NavAlias {
  /** Legacy prefix (no trailing slash, no wildcard). e.g. `/droprooms` */
  from: string;
  /** Canonical replacement prefix. e.g. `/drop-rooms` */
  to: string;
}

const EXTRA_ALIASES: NavAlias[] = [
  // Add cross-cutting aliases here that don't belong to a single nav item.
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
 * Rewrites a legacy pathname to its canonical form, preserving any sub-path
 * suffix. Returns `null` if no alias matches.
 *
 * @example
 *   resolveAlias("/droprooms")          // "/drop-rooms"
 *   resolveAlias("/droprooms/abc/chat") // "/drop-rooms/abc/chat"
 *   resolveAlias("/dashboard")          // null
 */
export const resolveAlias = (pathname: string): string | null => {
  for (const { from, to } of NAV_ALIASES) {
    if (pathname === from) return to;
    if (pathname.startsWith(from + "/")) {
      return to + pathname.slice(from.length);
    }
  }
  return null;
};
