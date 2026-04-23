/**
 * Flow Mode multi-creator visibility tests.
 *
 * Verifies that the data layer used by FlowModePage returns items from
 * MULTIPLE creators for both guests and authenticated users — and uses
 * the guest-safe `profiles_public` view (never `profiles`) for attribution.
 *
 * The Supabase client is stubbed so tests run offline. The stub mirrors
 * the chained query-builder API the loader uses.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadFlowFeed, ALL_CATEGORIES, clearFlowProfileCache, type FlowSupabase } from "./flow-feed";

type Row = Record<string, unknown>;

/**
 * Build a stub Supabase client whose `from(table)` returns a thenable
 * query-builder. Records every (table, columns) pair so tests can assert
 * which tables were touched.
 */
function makeSupabase(tables: Record<string, Row[]>) {
  const calls: { table: string; columns?: string }[] = [];

  const builder = (table: string) => {
    let rows: Row[] = [...(tables[table] ?? [])];
    let resolved = false;

    const api: any = {
      select(columns?: string) {
        calls.push({ table, columns });
        return api;
      },
      order(_col: string, _opts?: unknown) {
        return api;
      },
      limit(_n: number) {
        resolved = true;
        return Promise.resolve({ data: rows, error: null });
      },
      in(col: string, values: unknown[]) {
        rows = rows.filter((r) => values.includes(r[col]));
        resolved = true;
        return Promise.resolve({ data: rows, error: null });
      },
      // Allow `await api` directly when no terminal method is called.
      then(resolve: (v: { data: Row[]; error: null }) => void) {
        if (!resolved) resolve({ data: rows, error: null });
      },
    };
    return api;
  };

  const supabase: FlowSupabase = { from: builder };
  return { supabase, calls };
}

const SAMPLE_ITEMS: Row[] = [
  { id: "i1", user_id: "u-alice", title: "Alice track", category: "music", content_type: "link", file_url: null, link_url: "https://x", created_at: "2026-04-23T10:00:00Z" },
  { id: "i2", user_id: "u-bob", title: "Bob photo", category: "photo", content_type: "image", file_url: "/b.jpg", link_url: null, created_at: "2026-04-22T10:00:00Z" },
  { id: "i3", user_id: "u-carol", title: "Carol design", category: "design", content_type: "image", file_url: "/c.jpg", link_url: null, created_at: "2026-04-21T10:00:00Z" },
  { id: "i4", user_id: "u-alice", title: "Alice essay", category: "writing", content_type: "link", file_url: null, link_url: "https://y", created_at: "2026-04-20T10:00:00Z" },
];

const SAMPLE_PROFILES: Row[] = [
  { user_id: "u-alice", display_name: "Alice", avatar_url: "/a.png", username: "alice" },
  { user_id: "u-bob", display_name: "Bob", avatar_url: null, username: "bob" },
  { user_id: "u-carol", display_name: "Carol", avatar_url: "/c.png", username: null },
];

describe("Flow Mode global feed (loadFlowFeed)", () => {
  let supabase: FlowSupabase;
  let calls: { table: string; columns?: string }[];

  beforeEach(() => {
    const built = makeSupabase({
      flow_items: SAMPLE_ITEMS,
      profiles_public: SAMPLE_PROFILES,
    });
    supabase = built.supabase;
    calls = built.calls;
  });

  it("returns items from MULTIPLE creators for guests (no auth context)", async () => {
    const items = await loadFlowFeed(supabase, []);
    const uploaders = new Set(items.map((i) => i.user_id));
    expect(uploaders.size).toBeGreaterThanOrEqual(3);
    expect(uploaders).toEqual(new Set(["u-alice", "u-bob", "u-carol"]));
  });

  it("returns items from MULTIPLE creators for authenticated users", async () => {
    // Auth state is irrelevant to the data shape — RLS on flow_items allows
    // both `anon` and `authenticated` to SELECT all rows. We assert the same
    // contract holds regardless of caller.
    const items = await loadFlowFeed(supabase, ["music"]);
    const uploaders = new Set(items.map((i) => i.user_id));
    expect(uploaders.size).toBeGreaterThanOrEqual(3);
  });

  it("soft-sorts preferred categories first WITHOUT hiding others", async () => {
    const items = await loadFlowFeed(supabase, ["music"]);
    expect(items[0].category).toBe("music");
    // Crucially, non-music items are still present — the bug we're guarding
    // against is "I only see my own music" / single-category tunneling.
    const categories = new Set(items.map((i) => i.category));
    expect(categories.has("photo")).toBe(true);
    expect(categories.has("design")).toBe(true);
    expect(categories.has("writing")).toBe(true);
  });

  it("does NOT filter when all categories are selected", async () => {
    const items = await loadFlowFeed(supabase, ALL_CATEGORIES);
    expect(items).toHaveLength(SAMPLE_ITEMS.length);
  });

  it("attributes uploaders via profiles_public (guest-safe view)", async () => {
    await loadFlowFeed(supabase, []);
    const tablesQueried = calls.map((c) => c.table);
    expect(tablesQueried).toContain("flow_items");
    expect(tablesQueried).toContain("profiles_public");
    // The private `profiles` table must NEVER be queried — anon RLS blocks it
    // and would silently null-out attribution for guests.
    expect(tablesQueried).not.toContain("profiles");
  });

  it("attaches resolved profile objects to each item", async () => {
    const items = await loadFlowFeed(supabase, []);
    const alice = items.find((i) => i.id === "i1");
    expect(alice?.profiles?.display_name).toBe("Alice");
    expect(alice?.profiles?.username).toBe("alice");
  });

  it("returns null profile (not crash) when uploader has no public profile", async () => {
    const built = makeSupabase({
      flow_items: [
        { id: "i1", user_id: "u-ghost", title: "x", category: "design", content_type: "image", file_url: "/g.jpg", link_url: null, created_at: "2026-04-23T10:00:00Z" },
      ],
      profiles_public: [], // banned/private — not exposed to anon
    });
    const items = await loadFlowFeed(built.supabase, []);
    expect(items[0].profiles).toBeNull();
  });

  it("propagates errors from flow_items query", async () => {
    const supabaseErr: FlowSupabase = {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: null, error: { message: "boom" } }),
          }),
        }),
      }),
    };
    await expect(loadFlowFeed(supabaseErr, [])).rejects.toMatchObject({ message: "boom" });
  });
});
