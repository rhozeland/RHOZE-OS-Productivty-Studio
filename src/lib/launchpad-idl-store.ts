/**
 * Launchpad IDL store — runtime IDL hydration with three sources, in order:
 *
 *   1. localStorage("launchpad-idl-json") — user-pasted IDL (highest priority,
 *      lets you iterate on devnet without a redeploy of the frontend).
 *   2. /launchpad-idl.json fetched from `public/` at runtime.
 *   3. import.meta.glob of `src/lib/launchpad-idl.json` (committed snapshot).
 *
 * This means the moment a user pastes an IDL into Settings → Launchpad
 * (or drops one at `public/launchpad-idl.json`), every TradePanel and
 * LaunchCoinDialog instance starts using real Anchor calls — no code edits.
 */
import type { Idl } from "@coral-xyz/anchor";
import { validateLaunchpadIdl, type IdlValidationResult } from "./launchpad-idl-validator";

const LS_KEY = "launchpad-idl-json";
const LS_PROGRAM_ID = "launchpad-program-id";

let cached: Idl | null | undefined; // undefined = not yet attempted
let cachedFromOverride = false;
let inflight: Promise<Idl | null> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export const subscribeIdl = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const tryParse = (raw: string | null): Idl | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Idl;
    // Light shape check — Anchor IDLs always carry `instructions`.
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as unknown as { instructions?: unknown }).instructions)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const loadFromGlob = async (): Promise<Idl | null> => {
  // Vite-only: matches a committed snapshot if a developer drops one in.
  // Using `as` because import.meta.glob isn't typed for arbitrary JSON.
  const matches = (import.meta as unknown as {
    glob: (p: string, opts: { eager?: boolean }) => Record<string, unknown>;
  }).glob("/src/lib/launchpad-idl.json", { eager: true });
  const first = Object.values(matches)[0] as { default?: Idl } | undefined;
  return (first?.default ?? null) as Idl | null;
};

const loadFromPublic = async (): Promise<Idl | null> => {
  try {
    const res = await fetch("/launchpad-idl.json", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as Idl;
    return json;
  } catch {
    return null;
  }
};

/** Force a full reload from sources. Resets the cache. */
export const resetIdlCache = (): void => {
  cached = undefined;
  cachedFromOverride = false;
  inflight = null;
  notify();
};

/** Synchronous accessor: returns the cached IDL or `null` if not loaded yet. */
export const getCachedIdl = (): Idl | null => (cached ?? null) as Idl | null;

/** True when the active IDL came from a user override (localStorage). */
export const isIdlFromOverride = (): boolean => cachedFromOverride;

/** Async loader. Idempotent — multiple callers share the same in-flight promise. */
export const loadLaunchpadIdl = async (): Promise<Idl | null> => {
  if (cached !== undefined) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    // 1. localStorage override
    if (typeof window !== "undefined") {
      const fromLS = tryParse(window.localStorage.getItem(LS_KEY));
      if (fromLS) {
        cached = fromLS;
        cachedFromOverride = true;
        notify();
        return fromLS;
      }
    }
    // 2. /launchpad-idl.json
    const fromPublic = await loadFromPublic();
    if (fromPublic) {
      cached = fromPublic;
      cachedFromOverride = false;
      notify();
      return fromPublic;
    }
    // 3. committed snapshot
    const fromGlob = await loadFromGlob();
    cached = fromGlob;
    cachedFromOverride = false;
    notify();
    return fromGlob;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
};

/** Persist a user-pasted IDL. Pass `null` to clear. Returns parsed Idl on success. */
export const setOverrideIdl = (raw: string | null): Idl | null => {
  if (typeof window === "undefined") return null;
  if (raw === null || raw.trim() === "") {
    window.localStorage.removeItem(LS_KEY);
    resetIdlCache();
    return null;
  }
  const parsed = tryParse(raw);
  if (!parsed) {
    throw new Error("Invalid IDL: expected JSON with an `instructions` array.");
  }
  window.localStorage.setItem(LS_KEY, raw);
  cached = parsed;
  cachedFromOverride = true;
  inflight = null;
  notify();
  return parsed;
};

/** Optional override for program ID (rare — env var is preferred). */
export const getOverrideProgramId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LS_PROGRAM_ID);
};

export const setOverrideProgramId = (id: string | null): void => {
  if (typeof window === "undefined") return;
  if (!id) window.localStorage.removeItem(LS_PROGRAM_ID);
  else window.localStorage.setItem(LS_PROGRAM_ID, id);
  notify();
};

/** Hook-friendly: returns true once an IDL is available. */
export const hasIdl = (): boolean => Boolean(cached);
