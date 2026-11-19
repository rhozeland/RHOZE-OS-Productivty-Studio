/**
 * Curator Invite Flow — end-to-end integration test
 * ──────────────────────────────────────────────────────────────────────────
 * Exercises the full invite handshake against the real Lovable Cloud
 * backend:
 *
 *   1. Inviter creates a revenue_split_configs row and seeds the lead's
 *      collaborator share.
 *   2. Inviter inserts a curator_invites row targeting the invitee.
 *   3. Invitee fetches the pending invite via RLS (proves invitee can
 *      see their own invites — what powers /inquiries' CuratorInvitesInbox).
 *   4. Invitee UPDATEs status → 'accepted'.
 *   5. Server-side triggers transfer the offered share to
 *      revenue_split_collaborators, preserve the legacy curator_id
 *      projection, stamp responded_at, and emit notifications.
 *   6. We assert all of the above.
 *
 * Skipped unless ALL of the following env vars are set:
 *   SUPABASE_TEST_URL                — project URL
 *   SUPABASE_TEST_ANON_KEY           — anon / publishable key
 *   SUPABASE_TEST_SERVICE_ROLE_KEY   — service role key (user create + cleanup)
 *   RUN_CURATOR_INVITE_INTEGRATION=1 — explicit opt-in safety toggle
 *
 * See `src/test/integration/README.md` for setup notes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Env-gate ─────────────────────────────────────────────────────────────
const URL =
  process.env.SUPABASE_TEST_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const OPT_IN = process.env.RUN_CURATOR_INVITE_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);
const skipMessage = !OPT_IN
  ? "skipped: set RUN_CURATOR_INVITE_INTEGRATION=1 to enable"
  : "skipped: missing SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY";

const describeIntegration = ENABLED ? describe : describe.skip;

const RUN_TAG = `curator-invite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describeIntegration(`Curator Invite flow — live backend (${skipMessage})`, () => {
  let admin: SupabaseClient;
  let inviterClient: SupabaseClient;
  let inviteeClient: SupabaseClient;

  let inviterId: string;
  let inviteeId: string;
  let splitConfigId: string;
  let inviteId: string;
  const leadPct = 90;
  const invitePct = 10;

  // Track every row we create so afterAll can clean up reliably.
  const createdNotificationOwners: string[] = [];

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Create two throwaway users ────────────────────────────────────
    const mkEmail = (role: string) =>
      `curator-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@integration.test`;

    const inviterEmail = mkEmail("inviter");
    const inviteeEmail = mkEmail("invitee");
    const password = `Tt!${crypto.randomUUID()}`;

    const { data: inviterUser, error: e1 } = await admin.auth.admin.createUser({
      email: inviterEmail,
      password,
      email_confirm: true,
    });
    if (e1 || !inviterUser.user) throw new Error(`Inviter create failed: ${e1?.message}`);
    inviterId = inviterUser.user.id;

    const { data: inviteeUser, error: e2 } = await admin.auth.admin.createUser({
      email: inviteeEmail,
      password,
      email_confirm: true,
    });
    if (e2 || !inviteeUser.user) throw new Error(`Invitee create failed: ${e2?.message}`);
    inviteeId = inviteeUser.user.id;

    createdNotificationOwners.push(inviterId, inviteeId);

    // Profiles for friendly, run-scoped names in trigger-emitted notifications.
    const { error: profileErr } = await admin.from("profiles").insert([
      { user_id: inviterId, username: `inviter_${RUN_TAG}`, display_name: `Test Inviter ${RUN_TAG}` },
      { user_id: inviteeId, username: `invitee_${RUN_TAG}`, display_name: `Test Invitee ${RUN_TAG}` },
    ]);
    if (profileErr) throw new Error(`Profile seed failed: ${profileErr.message}`);

    // ── Sign in as both ───────────────────────────────────────────────
    inviterClient = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: s1 } = await inviterClient.auth.signInWithPassword({
      email: inviterEmail,
      password,
    });
    if (s1) throw new Error(`Inviter sign-in failed: ${s1.message}`);

    inviteeClient = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: s2 } = await inviteeClient.auth.signInWithPassword({
      email: inviteeEmail,
      password,
    });
    if (s2) throw new Error(`Invitee sign-in failed: ${s2.message}`);
  }, 60_000);

  afterAll(async () => {
    const cleanupErrors: string[] = [];
    // Invites and collaborators cascade-delete with the config.
    if (splitConfigId) {
      const { error } = await admin.from("revenue_split_configs").delete().eq("id", splitConfigId);
      if (error) cleanupErrors.push(`revenue_split_configs: ${error.message}`);
    }
    if (createdNotificationOwners.length) {
      const { error } = await admin.from("notifications").delete().in("user_id", createdNotificationOwners);
      if (error) cleanupErrors.push(`notifications: ${error.message}`);
    }
    const profileIds = [inviterId, inviteeId].filter(Boolean);
    if (profileIds.length > 0) {
      const { error } = await admin.from("profiles").delete().in("user_id", profileIds);
      if (error) cleanupErrors.push(`profiles: ${error.message}`);
    }
    if (inviterId) {
      const { error } = await admin.auth.admin.deleteUser(inviterId);
      if (error) cleanupErrors.push(`inviter auth user: ${error.message}`);
    }
    if (inviteeId) {
      const { error } = await admin.auth.admin.deleteUser(inviteeId);
      if (error) cleanupErrors.push(`invitee auth user: ${error.message}`);
    }
    if (cleanupErrors.length > 0) {
      throw new Error(`Integration cleanup failed: ${cleanupErrors.join("; ")}`);
    }
  }, 30_000);

  it("inviter can create a revenue_split_configs row with curator share", async () => {
    const { data, error } = await inviterClient
      .from("revenue_split_configs")
      .insert({
        creator_id: inviterId,
        creator_pct: 80,
        curator_pct: 10,
        buyback_pct: 10,
        is_active: true,
      })
      .select("id, curator_id")
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.curator_id).toBeNull();
    splitConfigId = data!.id;

    const { error: collaboratorErr } = await inviterClient
      .from("revenue_split_collaborators")
      .insert({ config_id: splitConfigId, user_id: inviterId, pct: leadPct });
    expect(collaboratorErr).toBeNull();
  });

  it("inviter can insert a curator_invites row targeting the invitee", async () => {
    const { data, error } = await inviterClient
      .from("curator_invites")
      .insert({
        split_config_id: splitConfigId,
        inviter_id: inviterId,
        invitee_id: inviteeId,
        message: `Join me on ${RUN_TAG}`,
        pct: invitePct,
      })
      .select("id, status")
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.status).toBe("pending");
    inviteId = data!.id;
  });

  it("invitee can SELECT the pending invite via RLS (Inquiries inbox path)", async () => {
    const { data, error } = await inviteeClient
      .from("curator_invites")
      .select("id, status, message, inviter_id, split_config_id")
      .eq("id", inviteId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.status).toBe("pending");
    expect(data!.inviter_id).toBe(inviterId);
    expect(data!.message).toContain(RUN_TAG);
  });

  it("invitee accepts → trigger transfers the collaborator share", async () => {
    const { error: updateErr } = await inviteeClient
      .from("curator_invites")
      .update({ status: "accepted" })
      .eq("id", inviteId);
    expect(updateErr).toBeNull();

    // Re-fetch the invite — responded_at should now be populated.
    const { data: invite } = await inviteeClient
      .from("curator_invites")
      .select("status, responded_at")
      .eq("id", inviteId)
      .single();
    expect(invite?.status).toBe("accepted");
    expect(invite?.responded_at).toBeTruthy();

    const { data: collaborators, error: collaboratorsErr } = await admin
      .from("revenue_split_collaborators")
      .select("user_id, pct")
      .eq("config_id", splitConfigId)
      .in("user_id", [inviterId, inviteeId]);
    expect(collaboratorsErr).toBeNull();
    expect(collaborators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: inviterId, pct: leadPct - invitePct }),
        expect.objectContaining({ user_id: inviteeId, pct: invitePct }),
      ]),
    );

    // The legacy projection remains part of the deployed schema while
    // clients migrate to the collaborator table.
    const { data: config, error: cfgErr } = await admin
      .from("revenue_split_configs")
      .select("curator_id, creator_pct, curator_pct")
      .eq("id", splitConfigId)
      .single();

    expect(cfgErr).toBeNull();
    expect(config?.curator_id).toBe(inviteeId);
    expect(config?.curator_pct).toBe(10);
  });

  it("trigger emitted notifications to both inviter and invitee", async () => {
    // Notifications are RLS-restricted to user_id = auth.uid(), so query
    // each side from the right client to also prove that contract.
    const { data: inviterNotif } = await inviterClient
      .from("notifications")
      .select("type, title")
      .eq("user_id", inviterId)
      .eq("type", "curator_accepted")
      .ilike("title", `%${RUN_TAG}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(inviterNotif?.type).toBe("curator_accepted");
    expect(inviterNotif?.title).toMatch(/accepted/i);

    const { data: inviteeNotif } = await inviteeClient
      .from("notifications")
      .select("type, title, body")
      .eq("user_id", inviteeId)
      .eq("type", "curator_role")
      .ilike("body", `%${RUN_TAG}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(inviteeNotif?.type).toBe("curator_role");
    expect(inviteeNotif?.title).toMatch(/curator/i);
  });

  it("a third party (admin-created stranger) is BLOCKED from reading the invite", async () => {
    // Negative control — confirms RLS isn't accidentally world-readable.
    const strangerEmail = `stranger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@integration.test`;
    const password = `Tt!${crypto.randomUUID()}`;
    const { data: strangerUser, error: createErr } =
      await admin.auth.admin.createUser({
        email: strangerEmail,
        password,
        email_confirm: true,
      });
    if (createErr || !strangerUser.user) {
      throw new Error(`Stranger create failed: ${createErr?.message}`);
    }
    const strangerId = strangerUser.user.id;

    try {
      const stranger = createClient(URL, ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInErr } = await stranger.auth.signInWithPassword({
        email: strangerEmail,
        password,
      });
      expect(signInErr).toBeNull();

      const { data, error } = await stranger
        .from("curator_invites")
        .select("id")
        .eq("id", inviteId)
        .maybeSingle();

      // RLS-filtered SELECTs return zero rows (not an error). Either
      // outcome — empty result OR error — is acceptable; what's NOT
      // acceptable is the row coming back.
      expect(error == null || error.code === "PGRST116").toBeTruthy();
      expect(data).toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(strangerId);
    }
  });
});
