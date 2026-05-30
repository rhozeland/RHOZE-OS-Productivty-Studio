/**
 * concierge-analytics.ts
 *
 * Tiny localStorage-backed counter for the post-AI-draft Concierge / A&R
 * CTA banner. Mirrors the pattern of guest-cta-analytics + legacy-redirect-
 * analytics — no third-party tracker, just enough to debug funnel intent
 * locally and let an admin sweep counts via the console.
 *
 * Events
 *   impression — banner rendered after a successful AI draft
 *   dismissed  — user clicked "Not now"
 *   intake     — user clicked the primary CTA ("Book a call")
 */

const KEY = "rhoze.concierge-cta.v1";

export type ConciergeCtaEvent = "impression" | "dismissed" | "intake";

interface Bucket {
  impression: number;
  dismissed: number;
  intake: number;
  last_at: string | null;
}

const empty = (): Bucket => ({
  impression: 0,
  dismissed: 0,
  intake: 0,
  last_at: null,
});

function read(): Bucket {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...(JSON.parse(raw) as Partial<Bucket>) };
  } catch {
    return empty();
  }
}

function write(b: Bucket) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // quota / private mode — silent no-op
  }
}

/** Increment a counter for the concierge banner. */
export function trackConciergeCta(
  event: ConciergeCtaEvent,
  context?: Record<string, unknown>,
) {
  const b = read();
  b[event] = (b[event] ?? 0) + 1;
  b.last_at = new Date().toISOString();
  write(b);
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[concierge-cta]", event, context ?? {});
  }
}

export function getConciergeCtaStats(): Bucket {
  return read();
}

export function resetConciergeCtaStats() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
