/**
 * Flow Mode RLS integration tests
 * ──────────────────────────────────────────────────────────────────────────
 * Exercises the **real** Supabase backend (Lovable Cloud) end-to-end to
 * confirm the global Flow feed contract holds under live RLS:
 *
 *   • Anonymous role ─── SELECT on flow_items returns multi-creator items
 *   • Anonymous role ─── profiles_public view resolves uploader attribution
 *   • Authenticated ──── same multi-creator visibility (auth never narrows)
 *   • Anonymous role ─── INSERT on flow_items is denied (negative control)
 *
 * Skipped unless ALL of the following env vars are set:
 *   SUPABASE_TEST_URL                — project URL
 *   SUPABASE_TEST_ANON_KEY           — anon / publishable key
 *   SUPABASE_TEST_SERVICE_ROLE_KEY   — service role key (seed + teardown)
 *   RUN_FLOW_RLS_INTEGRATION=1       — explicit opt-in safety toggle
 *
 * See `src/test/integration/README.md` for full setup notes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadFlowFeed, clearFlowProfileCache } from "@/lib/flow-feed";

// ── Env-gate ─────────────────────────────────────────────────────────────
const URL =
  process.env.SUPABASE_TEST_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const OPT_IN = process.env.RUN_FLOW_RLS_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);

const skipMessage = !OPT_IN
  ? "skipped: set RUN_FLOW_RLS_INTEGRATION=1 to enable"
  : "skipped: missing SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY";

const describeIntegration = ENABLED ? describe : describe.skip;

// Unique per-run tag so teardown only deletes rows we created.
const RUN_TAG = `flow-rls-test-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

// Two synthetic creators — flow_items.user_id has no FK to auth.users so
// random UUIDs work fine and keep us from touching the auth schema.
const CREATOR_A = crypto.randomUUID();
const CREATOR_B = crypto.randomUUID();

type SeededRow = { id: string };

describeIntegration(`Flow Mode RLS — live backend (${skipMessage})`, () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let authed: SupabaseClient;
  let throwawayUserId: string | null = null;
  let seededIds: string[] = [];

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Seed: 4 multi-creator items tagged with RUN_TAG ────────────────
    const seedPayload = [
      {
        user_id: CREATOR_A,
        title: "Integration A1",
        category: "design",
        content_type: "image",
        file_url: null,
        link_url: "https://example.com/a1",
        tags: [RUN_TAG],
      },
      {
        user_id: CREATOR_A,
        title: "Integration A2",
        category: "music",
        content_type: "link",
        file_url: null,
        link_url: "https://example.com/a2",
        tags: [RUN_TAG],
      },
      {
        user_id: CREATOR_B,
        title: "Integration B1",
        category: "photo",
        content_type: "image",
        file_url: null,
        link_url: "https://example.com/b1",
        tags: [RUN_TAG],
      },
      {
        user_id: CREATOR_B,
        title: "Integration B2",
        category: "video",
        content_type: "link",
        file_url: null,
        link_url: "https://example.com/b2",
        tags: [RUN_TAG],
      },
    ];

    const { data: inserted, error: insertErr } = await admin
      .from("flow_items")
      .insert(seedPayload)
      .select("id");
    if (insertErr) throw new Error(`Seed failed: ${insertErr.message}`);
    seededIds = ((inserted ?? []) as SeededRow[]).map((r) => r.id);
    expect(seededIds).toHaveLength(4);

    // ── Throwaway auth user ────────────────────────────────────────────
    const email = `flow-rls-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@integration.test`;
    const password = `Tt!${crypto.randomUUID()}`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      throw new Error(
        `Failed to create throwaway user: ${createErr?.message ?? "no user"}`,
      );
    }
    throwawayUserId = created.user.id;

    authed = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await authed.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);
  }, 60_000);

  afterAll(async () => {
    // Always attempt teardown — even if assertions failed mid-run.
    try {
      if (seededIds.length > 0) {
        await admin.from("flow_items").delete().in("id", seededIds);
      }
      if (throwawayUserId) {
        await admin.auth.admin.deleteUser(throwawayUserId);
      }
    } finally {
      clearFlowProfileCache();
    }
  }, 30_000);

  // ── Tests ───────────────────────────────────────────────────────────

  it("anon role can SELECT seeded multi-creator items via flow_items RLS", async () => {
    const { data, error } = await anon
      .from("flow_items")
      .select("id, user_id, title")
      .contains("tags", [RUN_TAG]);

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBe(4);

    const distinctCreators = new Set((data ?? []).map((r) => r.user_id));
    expect(distinctCreators.size).toBe(2);
    expect(distinctCreators.has(CREATOR_A)).toBe(true);
    expect(distinctCreators.has(CREATOR_B)).toBe(true);
  });

  it("anon role can read profiles_public (guest-safe attribution view)", async () => {
    // Doesn't matter that our synthetic creators have no profile row —
    // we're proving the *view itself* is selectable by anon, which is the
    // RLS contract Flow Mode depends on. A failure here would mean
    // FlowCard would render every uploader as "Anonymous".
    const { error } = await anon
      .from("profiles_public")
      .select("user_id, display_name, avatar_url")
      .limit(1);
    expect(error).toBeNull();
  });

  it("loadFlowFeed (anon) returns the seeded multi-creator items", async () => {
    clearFlowProfileCache();
    const items = await loadFlowFeed(anon, []);
    const ours = items.filter((i) => Array.isArray((i as any).tags) && (i as any).tags.includes(RUN_TAG));
    expect(ours.length).toBe(4);
    const creators = new Set(ours.map((i) => i.user_id));
    expect(creators.size).toBe(2);
    // Profile resolution must not throw — `profiles` may be null since
    // synthetic users have no profile row, but the field MUST exist.
    for (const item of ours) {
      expect(Object.prototype.hasOwnProperty.call(item, "profiles")).toBe(true);
    }
  });

  it("loadFlowFeed (authenticated) returns the same multi-creator set", async () => {
    clearFlowProfileCache();
    const items = await loadFlowFeed(authed, []);
    const ours = items.filter((i) => Array.isArray((i as any).tags) && (i as any).tags.includes(RUN_TAG));
    expect(ours.length).toBe(4);
    const creators = new Set(ours.map((i) => i.user_id));
    expect(creators.size).toBe(2);
  });

  it("anon role is BLOCKED from inserting into flow_items (negative control)", async () => {
    // Confirms RLS is actually enforced — without this, a passing
    // SELECT test could be a false positive on a DB with RLS disabled.
    const { error } = await anon.from("flow_items").insert({
      user_id: CREATOR_A,
      title: "Should be rejected",
      category: "design",
      content_type: "image",
      tags: [RUN_TAG],
    });
    expect(error).toBeTruthy();
    // PostgREST surfaces RLS violations as 42501 / "new row violates
    // row-level security policy". Match loosely so wording changes don't
    // break the test.
    expect(
      `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase(),
    ).toMatch(/row-level security|42501|permission/);
  });
});
