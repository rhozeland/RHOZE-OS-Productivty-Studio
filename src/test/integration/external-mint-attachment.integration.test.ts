import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_TEST_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const ENABLED = Boolean(URL && ANON && SERVICE) && process.env.RUN_EXTERNAL_MINT_ATTACHMENT_INTEGRATION === "1";
const describeIntegration = ENABLED ? describe : describe.skip;

const MINT = "So11111111111111111111111111111111111111112";
const TICKER = "TESTCOIN";
const NAME = "Verified Test Coin";
const IMAGE = "https://images.example.test/verified.png";

describeIntegration("external pump.fun mint attachment database enforcement", () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;
  let otherUser: SupabaseClient;
  let ownerId = "";
  let otherUserId = "";
  let projectId = "";
  let workId = "";
  let challengeIds: string[] = [];

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    owner = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    otherUser = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

    const ownerEmail = `external-mint-owner-${crypto.randomUUID()}@integration.test`;
    const ownerPassword = `Tt!${crypto.randomUUID()}`;
    const otherEmail = `external-mint-other-${crypto.randomUUID()}@integration.test`;
    const otherPassword = `Tt!${crypto.randomUUID()}`;
    const [{ data: ownerCreated, error: ownerCreateError }, { data: otherCreated, error: otherCreateError }] =
      await Promise.all([
        admin.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true }),
        admin.auth.admin.createUser({ email: otherEmail, password: otherPassword, email_confirm: true }),
      ]);
    if (ownerCreateError || !ownerCreated.user) throw new Error(`Create owner failed: ${ownerCreateError?.message}`);
    if (otherCreateError || !otherCreated.user) throw new Error(`Create second user failed: ${otherCreateError?.message}`);
    ownerId = ownerCreated.user.id;
    otherUserId = otherCreated.user.id;

    const [{ error: ownerSignInError }, { error: otherSignInError }] = await Promise.all([
      owner.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword }),
      otherUser.auth.signInWithPassword({ email: otherEmail, password: otherPassword }),
    ]);
    if (ownerSignInError) throw new Error(`Owner sign-in failed: ${ownerSignInError.message}`);
    if (otherSignInError) throw new Error(`Second user sign-in failed: ${otherSignInError.message}`);
  }, 60_000);

  beforeEach(async () => {
    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({ user_id: ownerId, title: "External mint integration project" })
      .select("id")
      .single();
    if (projectError || !project) throw new Error(`Create project failed: ${projectError?.message}`);
    projectId = project.id;

    const { data: work, error: workError } = await admin
      .from("works")
      .insert({ user_id: ownerId, title: "External mint integration work", content_hash: crypto.randomUUID().replaceAll("-", "") })
      .select("id")
      .single();
    if (workError || !work) throw new Error(`Create work failed: ${workError?.message}`);
    workId = work.id;
    challengeIds = [];
  });

  afterAll(async () => {
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (otherUserId) await admin.auth.admin.deleteUser(otherUserId);
  }, 30_000);

  afterEach(async () => {
    if (challengeIds.length) {
      await admin.from("external_mint_attachment_challenges").delete().in("id", challengeIds);
    }
    if (projectId) await admin.from("projects").delete().eq("id", projectId);
    if (workId) await admin.from("works").delete().eq("id", workId);
    challengeIds = [];
    projectId = "";
    workId = "";
  });

  const seedChallenge = async (overrides: Record<string, unknown> = {}) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const { error } = await admin.from("external_mint_attachment_challenges").insert({
      id,
      user_id: ownerId,
      target_type: "project",
      target_id: projectId,
      mint_address: MINT,
      creator_wallet: "11111111111111111111111111111111",
      message: "test-only server-seeded challenge",
      token_name: NAME,
      token_ticker: TICKER,
      token_image_url: IMAGE,
      expires_at: new Date(now + 5 * 60_000).toISOString(),
      ...overrides,
    });
    if (error) throw new Error(`Seed challenge failed: ${error.message}`);
    challengeIds.push(id);
    return id;
  };

  it("persists only challenge-stored metadata and consumes the challenge atomically", async () => {
    const challengeId = await seedChallenge();
    const { data, error } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: challengeId });

    expect(error).toBeNull();
    expect(data).toEqual([{ target_type: "project", target_id: projectId, mint_address: MINT }]);

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("linked_token_id,linked_token_mint,linked_token_name,linked_token_ticker,linked_token_image_url")
      .eq("id", projectId)
      .single();
    expect(projectError).toBeNull();
    expect(project).toEqual({
      linked_token_id: null,
      linked_token_mint: MINT,
      linked_token_name: NAME,
      linked_token_ticker: TICKER,
      linked_token_image_url: IMAGE,
    });

    const { data: challenge } = await admin
      .from("external_mint_attachment_challenges")
      .select("consumed_at")
      .eq("id", challengeId)
      .single();
    expect(challenge?.consumed_at).toBeTruthy();

    const { error: replayError } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: challengeId });
    expect(replayError?.code).toBe("22023");
  });

  it("rejects an expired challenge and leaves the target untouched", async () => {
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    const createdAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const challengeId = await seedChallenge({ created_at: createdAt, expires_at: expiredAt });
    const { error } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: challengeId });
    expect(error?.code).toBe("22023");

    const { data: project } = await admin.from("projects").select("linked_token_mint").eq("id", projectId).single();
    expect(project?.linked_token_mint).toBeNull();
  });

  it("does not expose the persistence RPC to authenticated clients", async () => {
    const challengeId = await seedChallenge();
    const { error } = await owner.rpc("attach_verified_external_mint", { p_challenge_id: challengeId });
    expect(error).toBeTruthy();

    const { data: project } = await admin.from("projects").select("linked_token_mint").eq("id", projectId).single();
    expect(project?.linked_token_mint).toBeNull();
  });

  it("rejects a challenge that targets a row owned by a different user", async () => {
    const { data: foreignProject, error: foreignError } = await admin
      .from("projects")
      .insert({ user_id: otherUserId, title: "Other user's project" })
      .select("id")
      .single();
    if (foreignError || !foreignProject) throw new Error(`Create foreign project failed: ${foreignError?.message}`);
    try {
      const challengeId = await seedChallenge({ target_id: foreignProject.id });
      const { error } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: challengeId });
      expect(error?.code).toBe("42501");
    } finally {
      await admin.from("projects").delete().eq("id", foreignProject.id);
    }
  });

  it("rejects an older challenge after the target relationship has changed", async () => {
    const staleChallenge = await seedChallenge();
    const currentChallenge = await seedChallenge();
    const { error: currentError } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: currentChallenge });
    expect(currentError).toBeNull();

    const { error: staleError } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: staleChallenge });
    expect(staleError?.code).toBe("40001");
  });

  it("supports secure attachment to a Work row", async () => {
    const challengeId = await seedChallenge({ target_type: "work", target_id: workId });
    const { error } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: challengeId });
    expect(error).toBeNull();

    const { data: work } = await admin
      .from("works")
      .select("linked_token_mint,linked_token_name,linked_token_ticker,linked_token_image_url")
      .eq("id", workId)
      .single();
    expect(work).toEqual({ linked_token_mint: MINT, linked_token_name: NAME, linked_token_ticker: TICKER, linked_token_image_url: IMAGE });
  });

  it("blocks owner-supplied and service-role direct external metadata writes", async () => {
    const forged = {
      linked_token_mint: MINT,
      linked_token_ticker: "FORGED",
      linked_token_name: "Forged metadata",
      linked_token_image_url: "https://evil.example/forged.png",
    };
    const ownerWrite = await owner.from("projects").update(forged).eq("id", projectId);
    expect(ownerWrite.error).toBeTruthy();
    expect(ownerWrite.error?.code).toBe("42501");

    const serviceWrite = await admin.from("works").update({
      linked_token_mint: MINT,
      linked_token_ticker: "FORGED",
      linked_token_name: "Forged metadata",
      linked_token_image_url: "https://evil.example/forged.png",
    }).eq("id", workId);
    expect(serviceWrite.error).toBeTruthy();
    expect(serviceWrite.error?.code).toBe("42501");
  });

  it("does not let a different authenticated user modify the owner's target", async () => {
    const { data, error } = await otherUser
      .from("projects")
      .update({ title: "Unauthorized update", linked_token_mint: MINT })
      .eq("id", projectId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: project } = await admin.from("projects").select("title,linked_token_mint").eq("id", projectId).single();
    expect(project).toEqual({ title: "External mint integration project", linked_token_mint: null });
  });

  it("lets the owner unlink and relies on Task #147 to clear stale metadata", async () => {
    const challengeId = await seedChallenge();
    const { error: attachError } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: challengeId });
    expect(attachError).toBeNull();

    const { error: unlinkError } = await owner.from("projects").update({ linked_token_mint: null }).eq("id", projectId);
    expect(unlinkError).toBeNull();

    const { data: project } = await admin
      .from("projects")
      .select("linked_token_mint,linked_token_ticker,linked_token_name,linked_token_image_url")
      .eq("id", projectId)
      .single();
    expect(project).toEqual({ linked_token_mint: null, linked_token_ticker: null, linked_token_name: null, linked_token_image_url: null });
  });

  it("rejects conflicting creator-token and external-mint relationships", async () => {
    const { error } = await owner.from("projects").update({
      linked_token_id: crypto.randomUUID(),
      linked_token_mint: MINT,
      linked_token_ticker: TICKER,
      linked_token_name: NAME,
    }).eq("id", projectId);
    expect(error).toBeTruthy();
  });
});
