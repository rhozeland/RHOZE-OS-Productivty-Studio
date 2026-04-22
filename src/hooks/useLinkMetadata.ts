import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LinkMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  type: string;
}

type CacheEntry = { ts: number; data: LinkMetadata | null; error?: string };

const memCache = new Map<string, CacheEntry>();
const STORAGE_KEY = "rhz-link-meta-cache-v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h
const MAX_ENTRIES = 100;

function loadStorage(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStorage(map: Record<string, CacheEntry>) {
  if (typeof window === "undefined") return;
  try {
    // Trim oldest if too large
    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].ts - a[1].ts);
      map = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota exceeded — clear and retry once
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }
}

function getCached(url: string): CacheEntry | null {
  const fromMem = memCache.get(url);
  if (fromMem && Date.now() - fromMem.ts < MAX_AGE_MS) return fromMem;
  const store = loadStorage();
  const fromStore = store[url];
  if (fromStore && Date.now() - fromStore.ts < MAX_AGE_MS) {
    memCache.set(url, fromStore);
    return fromStore;
  }
  return null;
}

function setCached(url: string, entry: CacheEntry) {
  memCache.set(url, entry);
  const store = loadStorage();
  store[url] = entry;
  saveStorage(store);
}

function isLikelyUrl(value: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Debounced + cached link metadata fetcher.
 * Pass `enabled=false` to skip fetching (e.g. when a richer preview already handles the URL).
 */
export function useLinkMetadata(url: string, enabled: boolean = true, debounceMs: number = 500) {
  const [data, setData] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const trimmed = url.trim();

    if (!enabled || !trimmed || !isLikelyUrl(trimmed)) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Cache hit
    const cached = getCached(trimmed);
    if (cached) {
      setData(cached.data);
      setError(cached.error ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const myReqId = ++reqIdRef.current;
    const handle = setTimeout(async () => {
      try {
        const { data: result, error: fnErr } = await supabase.functions.invoke("fetch-link-metadata", {
          body: { url: trimmed },
        });

        if (myReqId !== reqIdRef.current) return; // stale

        if (fnErr) {
          const msg = fnErr.message || "Could not load preview";
          setCached(trimmed, { ts: Date.now(), data: null, error: msg });
          setError(msg);
          setData(null);
        } else if (result?.error) {
          setCached(trimmed, { ts: Date.now(), data: null, error: result.error });
          setError(result.error);
          setData(null);
        } else if (result) {
          const meta: LinkMetadata = {
            url: result.url ?? trimmed,
            title: result.title ?? null,
            description: result.description ?? null,
            image: result.image ?? null,
            siteName: result.siteName ?? null,
            favicon: result.favicon ?? null,
            type: result.type ?? "website",
          };
          setCached(trimmed, { ts: Date.now(), data: meta });
          setData(meta);
          setError(null);
        }
      } catch (e: any) {
        if (myReqId !== reqIdRef.current) return;
        const msg = e?.message || "Could not load preview";
        setError(msg);
        setData(null);
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(handle);
  }, [url, enabled, debounceMs]);

  return { data, loading, error };
}
