/**
 * Flow Mode feed loader — extracted from FlowModePage so it can be tested
 * in isolation against a mocked Supabase client.
 *
 * Contract (must hold for both guests and authenticated users):
 *  - Reads from `flow_items` with no user filter (global feed).
 *  - Soft-sorts: preferred categories surfaced first, but nothing hidden.
 *  - Resolves uploader attribution via the guest-safe `profiles_public` view,
 *    NEVER the private `profiles` table (which blocks anon reads).
 */

export type FlowItem = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  content_type: string;
  file_url: string | null;
  link_url: string | null;
  created_at: string;
  [key: string]: unknown;
};

export type FlowProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

export type FlowItemWithProfile = FlowItem & {
  profiles: FlowProfile | null;
};

// Minimal subset of the Supabase client surface the loader uses.
// Kept loose so tests can supply a tiny stub.
export interface FlowSupabase {
  from: (table: string) => any;
}

export const ALL_CATEGORIES = ["design", "music", "photo", "video", "writing"];

// In-memory TTL cache for uploader profiles. Flow Mode re-renders cards often
// (swipe stack, browse grid, scope toggles) and the profile data rarely changes
// within a session, so we cache `profiles_public` lookups by user_id and only
// fetch IDs we haven't seen yet (or whose entry has expired).
const PROFILE_TTL_MS = 5 * 60 * 1000; // 5 minutes
type CachedProfile = { value: FlowProfile | null; expiresAt: number };
const profileCache = new Map<string, CachedProfile>();

export function clearFlowProfileCache(): void {
  profileCache.clear();
}

// Exposed for tests — lets specs assert cache hits/misses without reaching
// into module internals.
export function _getFlowProfileCacheSize(): number {
  return profileCache.size;
}

/**
 * Loader options.
 *
 * `shuffleSeed` — when provided, items within each provenance tier are
 * shuffled deterministically by this seed. Lets discovery surfaces
 * (mosaic, hero, widget) feel fresh from session to session without
 * destabilising the FlowModePage swipe stack, which calls with no seed
 * and gets the stable time-desc order.
 */
export interface LoadFlowFeedOptions {
  shuffleSeed?: number;
}

const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export async function loadFlowFeed(
  supabase: FlowSupabase,
  selectedCategories: string[],
  opts: LoadFlowFeedOptions = {},
): Promise<FlowItemWithProfile[]> {
  const { data, error } = await supabase
    .from("flow_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  let items: FlowItem[] = data ?? [];

  // Soft sort: preferred categories first, rest after — never filter out.
  if (
    selectedCategories.length > 0 &&
    selectedCategories.length < ALL_CATEGORIES.length
  ) {
    const prefSet = new Set(selectedCategories);
    const preferred = items.filter((i) => prefSet.has(i.category));
    const rest = items.filter((i) => !prefSet.has(i.category));
    items = [...preferred, ...rest];
  }

  // Provenance bias: verified-IP first, fingerprinted next, then the rest.
  // When `shuffleSeed` is supplied, we shuffle *within* each tier so
  // discovery surfaces still surface verified work first but the order
  // inside each tier varies. Without a seed (FlowModePage swipe stack),
  // order stays stable so the loop is predictable.
  const tierOf = (i: FlowItem) => {
    const status = (i as any).verification_status as string | undefined;
    if (status === "verified") return 0;
    if (status === "pending") return 1;
    if ((i as any).content_hash) return 2;
    return 3;
  };
  if (typeof opts.shuffleSeed === "number") {
    const tiers: FlowItem[][] = [[], [], [], []];
    for (const it of items) tiers[tierOf(it)].push(it);
    items = tiers
      .map((tier, idx) => seededShuffle(tier, opts.shuffleSeed! + idx * 7919))
      .flat();
  } else {
    items = [...items].sort((a, b) => tierOf(a) - tierOf(b));
  }

  const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean))];
  const now = Date.now();
  const profileMap = new Map<string, FlowProfile>();
  const missingIds: string[] = [];

  for (const uid of userIds) {
    const cached = profileCache.get(uid);
    if (cached && cached.expiresAt > now) {
      if (cached.value) profileMap.set(uid, cached.value);
    } else {
      missingIds.push(uid);
    }
  }

  if (missingIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles_public")
      .select("user_id, display_name, avatar_url, username")
      .in("user_id", missingIds);
    const fetched = ((profiles ?? []) as FlowProfile[]).filter((p) => !!p.user_id);
    for (const p of fetched) {
      profileMap.set(p.user_id, p);
      profileCache.set(p.user_id, { value: p, expiresAt: now + PROFILE_TTL_MS });
    }
    // Cache negative lookups too so we don't re-query for ghost/banned users
    // on every render.
    const foundIds = new Set(fetched.map((p) => p.user_id));
    for (const uid of missingIds) {
      if (!foundIds.has(uid)) {
        profileCache.set(uid, { value: null, expiresAt: now + PROFILE_TTL_MS });
      }
    }
  }

  return items.map((i) => ({
    ...i,
    profiles: profileMap.get(i.user_id) ?? null,
  }));
}

