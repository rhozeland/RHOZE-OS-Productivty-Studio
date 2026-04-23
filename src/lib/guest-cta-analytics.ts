/**
 * Guest CTA Analytics
 * ─────────────────────────────────────────────────────────────────────────
 * Lightweight client-side tracking for unauthenticated visitors interacting
 * with sign-up call-to-actions in Flow Mode (and elsewhere).
 *
 * Why localStorage instead of an analytics service?
 *   • Zero new dependencies / no third-party network calls
 *   • Works offline-first; survives page reloads & navigations
 *   • Conversion attribution requires bridging anonymous sessions to an
 *     authenticated user — localStorage is the simplest durable bridge
 *
 * Event model
 *   - "click"      → guest tapped any sign-up CTA (with surface + variant)
 *   - "conversion" → a previously-clicking guest successfully created an
 *                    account (detected on first auth state change with a
 *                    pending click in storage)
 *
 * Each event carries:
 *   { type, surface, variant?, ts, userId? }
 *
 * Surfaces
 *   - "flow-guest-cta"    → the persistent FlowGuestCTA (card | floating)
 *   - "flow-signup-prompt" → the SignUpToPostPrompt popover
 *
 * Storage shape (key: `rhz.guest_cta.v1`):
 *   {
 *     events:        Event[]   // capped at MAX_EVENTS most recent
 *     pendingClick:  Event|null // last click awaiting conversion
 *   }
 *
 * Reading aggregates
 *   getGuestCTAStats() returns counts grouped by surface/variant plus a
 *   coarse conversion rate. Useful for an internal admin debug panel
 *   without any backend wiring.
 */

const STORAGE_KEY = "rhz.guest_cta.v1";
const MAX_EVENTS = 200;
// Treat a click as "expired" after 30 days — beyond that we no longer
// attribute a sign-up to it (likely a different intent / device reuse).
const CONVERSION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type GuestCTASurface = "flow-guest-cta" | "flow-signup-prompt";
export type GuestCTAEventType = "click" | "conversion";

export type GuestCTAEvent = {
  type: GuestCTAEventType;
  surface: GuestCTASurface;
  variant?: string;
  ts: number;
  userId?: string;
};

type Storage = {
  events: GuestCTAEvent[];
  pendingClick: GuestCTAEvent | null;
};

const emptyStorage = (): Storage => ({ events: [], pendingClick: null });

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const read = (): Storage => {
  if (!isBrowser()) return emptyStorage();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStorage();
    const parsed = JSON.parse(raw) as Partial<Storage>;
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      pendingClick: parsed.pendingClick ?? null,
    };
  } catch {
    // Corrupt JSON or quota issue — start fresh rather than throw.
    return emptyStorage();
  }
};

const write = (state: Storage): void => {
  if (!isBrowser()) return;
  try {
    // Cap event list so storage stays bounded for long-lived guests.
    const trimmed: Storage = {
      events: state.events.slice(-MAX_EVENTS),
      pendingClick: state.pendingClick,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage quota / private mode — silently no-op; analytics is
    // best-effort and must never break the user-facing flow.
  }
};

/**
 * Record a guest CTA click. Stored both as an immutable event in the log
 * and as a "pending click" used later to attribute a conversion.
 */
export const trackGuestCTAClick = (
  surface: GuestCTASurface,
  variant?: string,
): void => {
  const event: GuestCTAEvent = {
    type: "click",
    surface,
    variant,
    ts: Date.now(),
  };
  const state = read();
  state.events.push(event);
  state.pendingClick = event;
  write(state);

  // Surface to console in dev so engineers can verify wiring without
  // needing to inspect storage manually. Stripped by minifier in prod.
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[guest-cta] click", event);
  }
};

/**
 * Called once per session whenever auth transitions from "no user" to a
 * real user. If we have a pending click within the conversion window,
 * we record a conversion event and clear the pending marker so we don't
 * double-count.
 *
 * Returns the recorded conversion event (or null if no attribution).
 */
export const maybeRecordConversion = (userId: string): GuestCTAEvent | null => {
  const state = read();
  const pending = state.pendingClick;
  if (!pending) return null;

  const age = Date.now() - pending.ts;
  if (age > CONVERSION_WINDOW_MS) {
    // Stale — drop the marker without crediting a conversion.
    state.pendingClick = null;
    write(state);
    return null;
  }

  const conversion: GuestCTAEvent = {
    type: "conversion",
    surface: pending.surface,
    variant: pending.variant,
    ts: Date.now(),
    userId,
  };
  state.events.push(conversion);
  state.pendingClick = null;
  write(state);

  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[guest-cta] conversion", conversion);
  }
  return conversion;
};

export type GuestCTABreakdown = Record<
  string,
  { clicks: number; conversions: number }
>;

export type GuestCTAStats = {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number; // 0..1
  bySurface: GuestCTABreakdown;
  byVariant: GuestCTABreakdown;
};

/**
 * Aggregate the local event log into a summary suitable for displaying
 * in an internal dashboard or copying into a bug report.
 */
export const getGuestCTAStats = (): GuestCTAStats => {
  const { events } = read();
  const bySurface: GuestCTABreakdown = {};
  const byVariant: GuestCTABreakdown = {};
  let totalClicks = 0;
  let totalConversions = 0;

  for (const event of events) {
    const surfaceBucket = (bySurface[event.surface] ??= {
      clicks: 0,
      conversions: 0,
    });
    const variantKey = event.variant ?? "default";
    const variantBucket = (byVariant[variantKey] ??= {
      clicks: 0,
      conversions: 0,
    });

    if (event.type === "click") {
      totalClicks += 1;
      surfaceBucket.clicks += 1;
      variantBucket.clicks += 1;
    } else {
      totalConversions += 1;
      surfaceBucket.conversions += 1;
      variantBucket.conversions += 1;
    }
  }

  return {
    totalClicks,
    totalConversions,
    conversionRate: totalClicks === 0 ? 0 : totalConversions / totalClicks,
    bySurface,
    byVariant,
  };
};

/** Read all events (most recent last). Useful for debugging. */
export const getGuestCTAEvents = (): GuestCTAEvent[] => read().events;

/** Wipe all stored guest-CTA analytics data. */
export const resetGuestCTAAnalytics = (): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
};
