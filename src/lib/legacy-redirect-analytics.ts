/**
 * Legacy Redirect Analytics
 * ─────────────────────────────────────────────────────────────────────────
 * Lightweight client-side tracking for legacy URL redirects (e.g. the
 * historical `/droprooms/*` paths now rewritten to `/drop-rooms/*`).
 *
 * Why localStorage instead of an analytics service?
 *   • Zero new dependencies / no third-party network calls
 *   • Survives reloads & navigations so we can measure inbound legacy
 *     traffic over time without a backend round-trip
 *   • Easy to inspect / export for ad-hoc reporting
 *
 * Each event captures:
 *   { from, to, prefix, ts, referrer? }
 *
 * Storage shape (key: `rhz.legacy_redirect.v1`):
 *   { events: LegacyRedirectEvent[] }   // capped at MAX_EVENTS
 *
 * The module is intentionally framework-agnostic so future legacy
 * redirects (added via NAV_ALIASES) get tracked automatically by the
 * shared LegacyAliasRedirect component.
 */

const STORAGE_KEY = "rhz.legacy_redirect.v1";
const MAX_EVENTS = 200;

export type LegacyRedirectEvent = {
  /** Original full pathname the user landed on (e.g. `/droprooms/abc/chat`). */
  from: string;
  /** Canonical pathname they were redirected to (e.g. `/drop-rooms/abc/chat`). */
  to: string;
  /** Alias root prefix that matched (e.g. `/droprooms`). */
  prefix: string;
  /** Epoch ms when the redirect happened. */
  ts: number;
  /** document.referrer at redirect time, when available. */
  referrer?: string;
};

type Storage = { events: LegacyRedirectEvent[] };

const emptyStorage = (): Storage => ({ events: [] });

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const read = (): Storage => {
  if (!isBrowser()) return emptyStorage();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStorage();
    const parsed = JSON.parse(raw) as Partial<Storage>;
    return { events: Array.isArray(parsed.events) ? parsed.events : [] };
  } catch {
    return emptyStorage();
  }
};

const write = (state: Storage): void => {
  if (!isBrowser()) return;
  try {
    const trimmed: Storage = { events: state.events.slice(-MAX_EVENTS) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Best-effort — never break navigation if quota / private mode hits.
  }
};

/**
 * Record a single legacy-redirect event. Safe to call from any redirect
 * site; silently no-ops in non-browser environments (SSR / tests).
 */
export const trackLegacyRedirect = (
  input: Omit<LegacyRedirectEvent, "ts" | "referrer"> &
    Partial<Pick<LegacyRedirectEvent, "ts" | "referrer">>,
): LegacyRedirectEvent => {
  const event: LegacyRedirectEvent = {
    from: input.from,
    to: input.to,
    prefix: input.prefix,
    ts: input.ts ?? Date.now(),
    referrer:
      input.referrer ??
      (typeof document !== "undefined" ? document.referrer || undefined : undefined),
  };

  const state = read();
  state.events.push(event);
  write(state);

  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[legacy-redirect]", event);
  }
  return event;
};

/** Read all stored legacy-redirect events (most recent last). */
export const getLegacyRedirectEvents = (): LegacyRedirectEvent[] =>
  read().events;

/** Wipe all stored legacy-redirect analytics data. */
export const resetLegacyRedirectAnalytics = (): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
};
