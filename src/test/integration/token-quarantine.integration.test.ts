// These tests verify that legacy simulated tokens are safely quarantined and can no 
// longer be treated as valid creator tokens, while legitimate approved tokens 
// continue to work normally. They also verify that token ownership, Project/Work 
// linking rules, and profile synchronization still behave correctly after the changes.
//
// US183:
//     Task #185 — Remediate or quarantine legacy simulated token records.
//     Task #188 — Consolidate profile and creator_tokens synchronization,

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
const OPT_IN = process.env.RUN_TOKEN_QUARANTINE_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);

const describeIntegration = ENABLED ? describe : describe.skip;

// Unique per-run tag so teardown only deletes rows we created.
const RUN_TAG = `token-quarantine-test-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

// Sanitized tag for usernames (3-20 chars, alphanumeric + underscore only)
// Slice from the tail to ensure uniqueness: the random/timestamp portion is preserved
const SAFE_TAG = RUN_TAG.replace(/[^a-zA-Z0-9_]/g, "").slice(-8);

// Two synthetic creators (will be set to the created auth user IDs)
let CREATOR_A: string | null = null;
let CREATOR_B: string | null = null;

describeIntegration(`Simulated Token Quarantine - live backend)`, () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let authedA: SupabaseClient;
  let authedB: SupabaseClient;
  let throwawayUserIdA: string | null = null;
  let throwawayUserIdB: string | null = null;
  let seededTokens: Array<{ id: string; mint_address: string; user_id: string }> = [];
  let seededProjects: string[] = [];
  let seededWorks: string[] = [];
  let seededProfileA = false;
  let seededProfileB = false;
  const projectIdByUser: Record<string, string> = {};
  const workIdByUser: Record<string, string> = {};

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Seed: Creator A and B users ────────────────────────────────────
    const emailA = `quarantine-a-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@integration.test`;
    const passwordA = `Tt!${crypto.randomUUID()}`;
    const { data: createdA, error: createErrA } = await admin.auth.admin.createUser({
      email: emailA,
      password: passwordA,
      email_confirm: true,
    });
    if (createErrA || !createdA.user) {
      throw new Error(
        `Failed to create throwaway user A: ${createErrA?.message ?? "no user"}`,
      );
    }
    throwawayUserIdA = createdA.user.id;
    CREATOR_A = createdA.user.id;

    // Check if
  const { data: profileA, error: profileCheckErrA } = await admin
  .from("profiles")
  .select("user_id")
  .eq("user_id", CREATOR_A)
  .maybeSingle();

  //-----------------  Check if profile was created suscessfully --------------------------
  if (profileCheckErrA) {
    throw new Error(
      `Failed to check profile A: ${profileCheckErrA.message}`,
    );
  }

  if (!profileA) {
    throw new Error(
      `Auth user A was created, but no profile was created for user ${CREATOR_A}`,
    );
  }

    const emailB = `quarantine-b-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@integration.test`;
    const passwordB = `Tt!${crypto.randomUUID()}`;
    const { data: createdB, error: createErrB } = await admin.auth.admin.createUser({
      email: emailB,
      password: passwordB,
      email_confirm: true,
    });
    if (createErrB || !createdB.user) {
      throw new Error(
        `Failed to create throwaway user B: ${createErrB?.message ?? "no user"}`,
      );
    }
    throwawayUserIdB = createdB.user.id;
    CREATOR_B = createdB.user.id;


    // Verify handle_new_user created Creator B's profile
  const { data: profileB, error: profileCheckErrB } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", CREATOR_B)
    .maybeSingle();

  if (profileCheckErrB) {
    throw new Error(
      `Failed to check Creator B profile: ${profileCheckErrB.message}`,
    );
  }

  if (!profileB) {
    throw new Error(
      `Creator B auth user was created, but no matching profile was created.`,
    );
  }

    authedA = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErrA } = await authedA.auth.signInWithPassword({
      email: emailA,
      password: passwordA,
    });
    if (signInErrA) throw new Error(`Sign-in A failed: ${signInErrA.message}`);

    authedB = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErrB } = await authedB.auth.signInWithPassword({
      email: emailB,
      password: passwordB,
    });
    if (signInErrB) throw new Error(`Sign-in B failed: ${signInErrB.message}`);

    // ── Seed: Profiles for A and B (UPDATE auto-created profiles) ─────────
    // The handle_new_user trigger auto-creates profiles, so we UPDATE instead of INSERT.
    const { error: profileErrA } = await admin
      .from("profiles")
      .update({
        username: `qa_${SAFE_TAG}_a`, // 3–20 chars, alphanumeric + underscore only
        display_name: `Quarantine Test Profile A ${RUN_TAG}`,
      })
      .eq("user_id", throwawayUserIdA);
    if (profileErrA) throw new Error(`Profile A update failed: ${profileErrA.message}`);
    seededProfileA = true;

    const { error: profileErrB } = await admin
      .from("profiles")
      .update({
        username: `qa_${SAFE_TAG}_b`, // 3–20 chars, alphanumeric + underscore only
        display_name: `Quarantine Test Profile B ${RUN_TAG}`,
      })
      .eq("user_id", throwawayUserIdB);
    if (profileErrB) throw new Error(`Profile B update failed: ${profileErrB.message}`);
    seededProfileB = true;








    // ── Seed: Creator tokens ────────────────────────────────────────────
    // Simulated approved token (will be quarantined)
    const simulatedToken = {
      user_id: CREATOR_A!,
      mint_address: `itest185-${RUN_TAG}-simulated-RHOZE-001`,
      ticker: "RHOZE001",
      name: "Simulated Token",
      is_primary: true,
      status: "approved",
      source: "simulated",
      approved_at: new Date().toISOString(),
    };


    // Legitimate tokens (should NOT be quarantined)
    const submissionToken = {
      user_id: CREATOR_A!,
      mint_address: `itest185-${RUN_TAG}-submission-001`,
      ticker: "SUB001",
      name: "Submission Token",
      is_primary: false,
      status: "approved",
      source: "submission",
      approved_at: new Date().toISOString(),
    };

    const backfillToken = {
      user_id: CREATOR_A!,
      mint_address: `itest185-${RUN_TAG}-backfill-001`,
      ticker: "BKF001",
      name: "Backfill Token",
      is_primary: false,
      status: "approved",
      source: "backfill",
      approved_at: new Date().toISOString(),
    };

    const externalToken = {
      user_id: CREATOR_A!,
      mint_address: `itest185-${RUN_TAG}-external-001`,
      ticker: "EXT001",
      name: "External Token",
      is_primary: false,
      status: "approved",
      source: "external",
      approved_at: new Date().toISOString(),
    };

    // Already-rejected simulated token (should be untouched)
    const rejectedSimulatedToken = {
      user_id: CREATOR_A!,
      mint_address: `itest185-${RUN_TAG}-rejected-simulated-RHOZE-002`,
      ticker: "RHOZE002",
      name: "Rejected Simulated Token",
      is_primary: false,
      status: "rejected",
      source: "simulated",
      reject_reason: "Pre-existing rejection",
    };

    // Token for Creator B (cross-creator test)
    const creatorBToken = {
      user_id: CREATOR_B!,
      mint_address: `itest185-${RUN_TAG}-creator-b-001`,
      ticker: "CREB001",
      name: "Creator B Token",
      is_primary: false,
      status: "approved",
      source: "submission",
      approved_at: new Date().toISOString(),
    };

    const { data: tokens, error: tokenErr } = await admin
      .from("creator_tokens")
      .insert([
        simulatedToken,
        submissionToken,
        backfillToken,
        externalToken,
        rejectedSimulatedToken,
        creatorBToken,
      ])
      .select("id, mint_address, user_id, ticker, status, is_primary, source");

    if (tokenErr) throw new Error(`Token seed failed: ${tokenErr.message}`);

    // DEBUG: Verify exactly what PostgreSQL stored for the creator-token insert.

    // DEBUG: Check Creator A's compatibility mirror immediately after token insert.
    const { data: profileAfter, error: profileAfterErr } = await admin
      .from("profiles")
      .select("user_id, token_mint_address, token_ticker")
      .eq("user_id", CREATOR_A!)
      .single();

    if (profileAfterErr) {
      throw new Error(
        `Failed to inspect Creator A profile after token insert: ${profileAfterErr.message}`,
      );
    }

    seededTokens = (tokens ?? []) as Array<{ id: string; mint_address: string; user_id: string }>;
    expect(seededTokens).toHaveLength(6);

    // Verify the mirror was set by the trigger for the primary simulated token
    const simulatedTokenRow = seededTokens.find((t) => t.mint_address.includes("simulated-RHOZE-001"));
    expect(simulatedTokenRow).toBeDefined();
    if (!simulatedTokenRow) throw new Error("Seeded simulated token missing");
    const { data: profileAfterInsert, error: profileErr } = await admin
      .from("profiles")
      .select("token_mint_address, token_ticker")
      .eq("user_id", CREATOR_A!)
      .single();
    if (profileErr) throw new Error(`Profile check failed: ${profileErr.message}`);
    expect(profileAfterInsert?.token_mint_address).toBe(simulatedTokenRow.mint_address);
    expect(profileAfterInsert?.token_ticker).toBe("RHOZE001");

    // ── Seed: Projects and Works ────────────────────────────────────────
    const projectA = {
      user_id: CREATOR_A!,
      title: `Project A ${RUN_TAG}`,
      description: "Test project for Creator A",
    };

    const projectB = {
      user_id: CREATOR_B!,
      title: `Project B ${RUN_TAG}`,
      description: "Test project for Creator B",
    };

    const workA = {
      user_id: CREATOR_A!,
      title: `Work A ${RUN_TAG}`,
      description: "Test work for Creator A",
      kind: "image",
      content_hash: crypto.randomUUID(),
    };

    const workB = {
      user_id: CREATOR_B!,
      title: `Work B ${RUN_TAG}`,
      description: "Test work for Creator B",
      kind: "image",
      content_hash: crypto.randomUUID(),
    };

    const { data: projects, error: projectErr } = await admin
      .from("projects")
      .insert([projectA, projectB])
      .select("id, user_id");
    if (projectErr) throw new Error(`Project seed failed: ${projectErr.message}`);
    seededProjects = ((projects ?? []) as Array<{ id: string; user_id: string }>).map((r) => r.id);
    expect(seededProjects).toHaveLength(2);
    // Map user_id to project id for deterministic lookup
    (projects ?? []).forEach((row) => {
      projectIdByUser[row.user_id] = row.id;
    });

    const { data: works, error: workErr } = await admin
      .from("works")
      .insert([workA, workB])
      .select("id, user_id");
    if (workErr) throw new Error(`Work seed failed: ${workErr.message}`);
    seededWorks = ((works ?? []) as Array<{ id: string; user_id: string }>).map((r) => r.id);
    expect(seededWorks).toHaveLength(2);
    // Map user_id to work id for deterministic lookup
    (works ?? []).forEach((row) => {
      workIdByUser[row.user_id] = row.id;
    });

    // ── Apply quarantine UPDATE (simulating migration 20261117231508) ────
    // Only target our test mint addresses to avoid touching real rows
    const simulatedMints = seededTokens
      .filter((t) => t.mint_address.includes("simulated-RHOZE-001")) // Only the approved simulated token
      .map((t) => t.mint_address);

    const { error: quarantineErr } = await admin
      .from("creator_tokens")
      .update({
        status: "rejected",
        reject_reason: 
          "Quarantined: simulated launchpad token (RHOZE vanity mint), auto-approved by historical backfill",
        is_primary: false,
        updated_at: new Date().toISOString(),
      })
      .in("mint_address", simulatedMints)
      .eq("source", "simulated")
      .eq("status", "approved");

    if (quarantineErr) throw new Error(`Quarantine failed: ${quarantineErr.message}`);
  }, 60_000);

  afterAll(async () => {
    const cleanupErrors: string[] = [];

    // Delete works
    if (seededWorks.length > 0) {
      const { error } = await admin.from("works").delete().in("id", seededWorks);
      if (error) cleanupErrors.push(`works: ${error.message}`);
    }

    // Delete projects
    if (seededProjects.length > 0) {
      const { error } = await admin.from("projects").delete().in("id", seededProjects);
      if (error) cleanupErrors.push(`projects: ${error.message}`);
    }

    // Delete tokens
    if (seededTokens.length > 0) {
      const { error } = await admin.from("creator_tokens").delete().in("id", seededTokens.map(t => t.id));
      if (error) cleanupErrors.push(`creator_tokens: ${error.message}`);
    }

    // Delete profiles
    if (seededProfileA && throwawayUserIdA) {
      const { error } = await admin.from("profiles").delete().eq("user_id", throwawayUserIdA);
      if (error) cleanupErrors.push(`profiles A: ${error.message}`);
    }
    if (seededProfileB && throwawayUserIdB) {
      const { error } = await admin.from("profiles").delete().eq("user_id", throwawayUserIdB);
      if (error) cleanupErrors.push(`profiles B: ${error.message}`);
    }

    // Delete auth users
    if (throwawayUserIdA) {
      const { error } = await admin.auth.admin.deleteUser(throwawayUserIdA);
      if (error) cleanupErrors.push(`auth user A: ${error.message}`);
    }
    if (throwawayUserIdB) {
      const { error } = await admin.auth.admin.deleteUser(throwawayUserIdB);
      if (error) cleanupErrors.push(`auth user B: ${error.message}`);
    }

    if (cleanupErrors.length > 0) {
      throw new Error(`Integration cleanup failed: ${cleanupErrors.join("; ")}`);
    }
  }, 30_000);

  // ── Tests ───────────────────────────────────────────────────────────

  it("T1: Simulated approved token is quarantined", async () => {
    const simulatedToken = seededTokens.find((t) => t.mint_address.includes("simulated-RHOZE-001"));
    expect(simulatedToken).toBeDefined();
    if (!simulatedToken) throw new Error("Seeded simulated token missing");
    const { data, error } = await admin
      .from("creator_tokens")
      .select("*")
      .eq("id", simulatedToken.id)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: "rejected",
      is_primary: false,
    });
    expect(data.reject_reason).toContain("Quarantined");
    expect(data.reject_reason).toContain("simulated");
  });

  it("T2: Legitimate tokens are NOT quarantined", async () => {
    const sources = ["submission", "backfill", "external"];
    for (const source of sources) {
      const token = seededTokens.find((t) => t.mint_address.includes(source));
      expect(token).toBeDefined();
      if (!token) throw new Error(`Seeded token for source ${source} missing`);
      const { data, error } = await admin
        .from("creator_tokens")
        .select("*")
        .eq("id", token.id)
        .single();

      expect(error).toBeNull();
      expect(data).toMatchObject({
        status: "approved",
        source: source,
      });
    }
  });

  it("T3: Already-rejected simulated token is untouched", async () => {
    const rejectedToken = seededTokens.find((t) => t.mint_address.includes("rejected-simulated"));
    expect(rejectedToken).toBeDefined();
    if (!rejectedToken) throw new Error("Seeded rejected token missing");
    const { data, error } = await admin
      .from("creator_tokens")
      .select("*")
      .eq("id", rejectedToken.id)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: "rejected",
      is_primary: false,
      reject_reason: "Pre-existing rejection",
    });
  });

  it("T4: Simulated token cannot pass eligibility (defense-in-depth)", async () => {
    // Artificially set a simulated token to approved after quarantine
    const simulatedToken = seededTokens.find((t) => t.mint_address.includes("simulated-RHOZE-001"));
    expect(simulatedToken).toBeDefined();
    if (!simulatedToken) throw new Error("Seeded simulated token missing");
    
    try {
      await admin
        .from("creator_tokens")
        .update({ status: "approved" })
        .eq("id", simulatedToken.id);

      const projectId = projectIdByUser[CREATOR_A!]; // Creator A's project
      const workId = workIdByUser[CREATOR_A!]; // Creator A's work
      expect(projectId).toBeDefined();
      expect(workId).toBeDefined();

      // Call is_creator_token_eligible via RPC
      const { data: eligibleProject, error: errProject } = await authedA
        .rpc("is_creator_token_eligible", {
          p_token_id: simulatedToken.id,
          p_target_type: "project",
          p_target_id: projectId,
        });

      const { data: eligibleWork, error: errWork } = await authedA
        .rpc("is_creator_token_eligible", {
          p_token_id: simulatedToken.id,
          p_target_type: "work",
          p_target_id: workId,
        });

      expect(errProject).toBeNull();
      expect(errWork).toBeNull();
      expect(eligibleProject).toBe(false);
      expect(eligibleWork).toBe(false);
    } finally {
      // Reset status to rejected for other tests
      await admin
        .from("creator_tokens")
        .update({ status: "rejected" })
        .eq("id", simulatedToken.id);
    }
  });

  it("T5: Legitimate approved token passes eligibility", async () => {
    const sources = ["submission", "backfill", "external"];
    const projectId = projectIdByUser[CREATOR_A!]; // Creator A's project
    const workId = workIdByUser[CREATOR_A!]; // Creator A's work
    expect(projectId).toBeDefined();
    expect(workId).toBeDefined();

    for (const source of sources) {
      const token = seededTokens.find((t) => t.mint_address.includes(source));
      expect(token).toBeDefined();
      if (!token) throw new Error(`Seeded token for source ${source} missing`);

      const { data: eligibleProject, error: errProject } = await authedA
        .rpc("is_creator_token_eligible", {
          p_token_id: token.id,
          p_target_type: "project",
          p_target_id: projectId,
        });

      const { data: eligibleWork, error: errWork } = await authedA
        .rpc("is_creator_token_eligible", {
          p_token_id: token.id,
          p_target_type: "work",
          p_target_id: workId,
        });

      expect(errProject).toBeNull();
      expect(errWork).toBeNull();
      expect(eligibleProject).toBe(true);
      expect(eligibleWork).toBe(true);
    }
  });

  it("T6: Rejected legitimate token → eligibility false", async () => {
    // Temporarily reject a legitimate token
    const submissionToken = seededTokens.find((t) => t.mint_address.includes("submission"));
    expect(submissionToken).toBeDefined();
    if (!submissionToken) throw new Error("Seeded submission token missing");
    
    try {
      await admin
        .from("creator_tokens")
        .update({ status: "rejected", reject_reason: "Test rejection" })
        .eq("id", submissionToken.id);

      const projectId = projectIdByUser[CREATOR_A!]; // Creator A's project
      expect(projectId).toBeDefined();
      const { data, error } = await authedA
        .rpc("is_creator_token_eligible", {
          p_token_id: submissionToken.id,
          p_target_type: "project",
          p_target_id: projectId,
        });

      expect(error).toBeNull();
      expect(data).toBe(false);
    } finally {
      // Restore
      await admin
        .from("creator_tokens")
        .update({ status: "approved", reject_reason: null })
        .eq("id", submissionToken.id);
    }
  });

  it("T7: Cross-creator eligibility and locking blocked", async () => {
    const creatorAToken = seededTokens.find((t) => t.mint_address.includes("submission"));
    expect(creatorAToken).toBeDefined();
    if (!creatorAToken) throw new Error("Seeded creator A token missing");
    const projectBId = projectIdByUser[CREATOR_B!]; // Creator B's project
    const workBId = workIdByUser[CREATOR_B!]; // Creator B's work
    expect(projectBId).toBeDefined();
    expect(workBId).toBeDefined();

    // Eligibility should fail (wrong owner)
    const { data: eligibleProject, error: errProject } = await authedB
      .rpc("is_creator_token_eligible", {
        p_token_id: creatorAToken.id,
        p_target_type: "project",
        p_target_id: projectBId,
      });

    const { data: eligibleWork, error: errWork } = await authedB
      .rpc("is_creator_token_eligible", {
        p_token_id: creatorAToken.id,
        p_target_type: "work",
        p_target_id: workBId,
      });

    expect(errProject).toBeNull();
    expect(errWork).toBeNull();
    expect(eligibleProject).toBe(false);
    expect(eligibleWork).toBe(false);

    // Locking should also fail (wrong owner)
    const { data: locked, error: lockErr } = await authedB
      .rpc("lock_approved_creator_token", {
        p_token_id: creatorAToken.id,
      });

    expect(lockErr).toBeNull();
    expect(locked).toBe(false);
  });

  it("T8: lock_approved_creator_token on artificially-approved simulated token returns false", async () => {
    const simulatedToken = seededTokens.find((t) => t.mint_address.includes("simulated-RHOZE-001"));
    expect(simulatedToken).toBeDefined();
    if (!simulatedToken) throw new Error("Seeded simulated token missing");
    
    try {
      await admin
        .from("creator_tokens")
        .update({ status: "approved" })
        .eq("id", simulatedToken.id);

      const { data, error } = await authedA
        .rpc("lock_approved_creator_token", {
          p_token_id: simulatedToken.id,
        });

      expect(error).toBeNull();
      expect(data).toBe(false);
    } finally {
      // Reset
      await admin
        .from("creator_tokens")
        .update({ status: "rejected" })
        .eq("id", simulatedToken.id);
    }
  });

  it("T9: lock_approved_creator_token on approved legitimate token owned by caller returns true", async () => {
    const submissionToken = seededTokens.find((t) => t.mint_address.includes("submission"));
    expect(submissionToken).toBeDefined();
    if (!submissionToken) throw new Error("Seeded submission token missing");
    const { data, error } = await authedA
      .rpc("lock_approved_creator_token", {
        p_token_id: submissionToken.id,
      });

    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("T10: lock_approved_creator_token on rejected token returns false", async () => {
    const rejectedToken = seededTokens.find((t) => t.mint_address.includes("rejected-simulated"));
    expect(rejectedToken).toBeDefined();
    if (!rejectedToken) throw new Error("Seeded rejected token missing");
    const { data, error } = await authedA
      .rpc("lock_approved_creator_token", {
        p_token_id: rejectedToken.id,
      });

    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("T11: Unauthenticated (anon client) → eligibility and locking return false", async () => {
    // Asymmetry note: is_creator_token_eligible has no explicit REVOKE from anon
    // (default PUBLIC execute applies) so anon callers get `false` via the `auth.uid() IS NULL` check.
    // lock_approved_creator_token is REVOKE'd from PUBLIC and anon (migration 20261103045345)
    // so anon may receive a 42501 permission error instead. Both paths assert NO success.
    const submissionToken = seededTokens.find((t) => t.mint_address.includes("submission"));
    expect(submissionToken).toBeDefined();
    if (!submissionToken) throw new Error("Seeded submission token missing");
    const projectId = projectIdByUser[CREATOR_A!]; // Creator A's project
    expect(projectId).toBeDefined();

    const { data: eligible, error: errEligible } = await anon
      .rpc("is_creator_token_eligible", {
        p_token_id: submissionToken.id,
        p_target_type: "project",
        p_target_id: projectId,
      });

    const { data: locked, error: errLocked } = await anon
      .rpc("lock_approved_creator_token", {
        p_token_id: submissionToken.id,
      });

    // Either false or permission error is acceptable
    if (errEligible) {
      expect(`${errEligible.code} ${errEligible.message}`).toMatch(/permission|42501|row-level security/i);
    } else {
      expect(eligible).toBe(false);
    }

    if (errLocked) {
      expect(`${errLocked.code} ${errLocked.message}`).toMatch(/permission|42501|row-level security/i);
    } else {
      expect(locked).toBe(false);
    }
  });

  it("T12: Quarantining a primary simulated token clears the profile mirror", async () => {
    // This test depends on the mirror-fix trigger migration (20261117231112)
    // We already applied quarantine in beforeAll, so we verify the mirror was cleared
    // Note: beforeAll verified the mirror was SET after inserting the primary simulated token

    const simulatedToken = seededTokens.find((t) => t.mint_address.includes("simulated-RHOZE-001"));
    expect(simulatedToken).toBeDefined();
    if (!simulatedToken) throw new Error("Seeded simulated token missing");

    // Check that the profile mirror was cleared
    const { data: profile, error } = await admin
      .from("profiles")
      .select("token_mint_address, token_ticker")
      .eq("user_id", CREATOR_A!)
      .single();

    expect(error).toBeNull();
    // The mirror should be cleared because the primary simulated token was quarantined
    expect(profile?.token_mint_address).toBeNull();
    expect(profile?.token_ticker).toBeNull();
  });
});




