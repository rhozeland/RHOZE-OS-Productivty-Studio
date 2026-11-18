import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseTestConfig } from "./supabase-test-config";

const { url: URL, anonKey: ANON, serviceRoleKey: SERVICE, enabled: ENABLED } =
  getSupabaseTestConfig("RUN_APPROVED_TOKEN_ATTACHMENT_INTEGRATION");
const describeIntegration = ENABLED ? describe : describe.skip;

const TARGET_TYPES = ["project", "work"] as const;
type TargetType = typeof TARGET_TYPES[number];
const EXTERNAL_MINT = "So11111111111111111111111111111111111111112";

describeIntegration("approved creator-token attachment database enforcement", () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;
  let otherUser: SupabaseClient;
  let ownerId = "";
  let otherUserId = "";
  let projectId = "";
  let workId = "";
  let otherProjectId = "";
  let otherWorkId = "";
  let challengeIds: string[] = [];
  let tokenIds: Record<"approvedA" | "approvedB" | "pending" | "otherApproved", string>;

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    owner = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    otherUser = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

    const suffix = crypto.randomUUID();
    const ownerEmail = `approved-token-owner-${suffix}@integration.test`;
    const otherEmail = `approved-token-other-${suffix}@integration.test`;
    const ownerPassword = `Tt!${crypto.randomUUID()}`;
    const otherPassword = `Tt!${crypto.randomUUID()}`;
    const [{ data: ownerCreated, error: ownerCreateError }, { data: otherCreated, error: otherCreateError }] =
      await Promise.all([
        admin.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true }),
        admin.auth.admin.createUser({ email: otherEmail, password: otherPassword, email_confirm: true }),
      ]);
    ownerId = ownerCreated.user?.id ?? "";
    otherUserId = otherCreated.user?.id ?? "";
    if (ownerCreateError || !ownerCreated.user) throw new Error(`Create owner failed: ${ownerCreateError?.message}`);
    if (otherCreateError || !otherCreated.user) throw new Error(`Create second user failed: ${otherCreateError?.message}`);

    const [{ error: ownerSignInError }, { error: otherSignInError }] = await Promise.all([
      owner.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword }),
      otherUser.auth.signInWithPassword({ email: otherEmail, password: otherPassword }),
    ]);
    if (ownerSignInError) throw new Error(`Owner sign-in failed: ${ownerSignInError.message}`);
    if (otherSignInError) throw new Error(`Second user sign-in failed: ${otherSignInError.message}`);
  }, 60_000);

  beforeEach(async () => {
    const { data: project, error: projectError } = await admin.from("projects")
      .insert({ user_id: ownerId, title: "Approved token integration project" }).select("id").single();
    if (projectError || !project) throw new Error(`Create Project failed: ${projectError?.message}`);
    projectId = project.id;

    const { data: work, error: workError } = await admin.from("works").insert({
      user_id: ownerId,
      title: "Approved token integration work",
      content_hash: crypto.randomUUID().replace(/-/g, ""),
    }).select("id").single();
    if (workError || !work) throw new Error(`Create Work failed: ${workError?.message}`);
    workId = work.id;

    const { data: otherProject, error: otherProjectError } = await admin.from("projects")
      .insert({ user_id: otherUserId, title: "Other user's token integration project" }).select("id").single();
    if (otherProjectError || !otherProject) throw new Error(`Create other user's Project failed: ${otherProjectError?.message}`);
    otherProjectId = otherProject.id;

    const { data: otherWork, error: otherWorkError } = await admin.from("works").insert({
      user_id: otherUserId,
      title: "Other user's token integration work",
      content_hash: crypto.randomUUID().replace(/-/g, ""),
    }).select("id").single();
    if (otherWorkError || !otherWork) throw new Error(`Create other user's Work failed: ${otherWorkError?.message}`);
    otherWorkId = otherWork.id;

    const suffix = crypto.randomUUID();
    const { data: tokens, error: tokenError } = await admin.from("creator_tokens").insert([
      { user_id: ownerId, mint_address: `approved-a-${suffix}`, ticker: "APPA", name: "Approved A", status: "approved", is_primary: false },
      { user_id: ownerId, mint_address: `approved-b-${suffix}`, ticker: "APPB", name: "Approved B", status: "approved", is_primary: false },
      { user_id: ownerId, mint_address: `pending-${suffix}`, ticker: "PEND", name: "Pending Coin", status: "pending", is_primary: false },
      { user_id: otherUserId, mint_address: `other-approved-${suffix}`, ticker: "OTHER", name: "Other Approved", status: "approved", is_primary: false },
    ]).select("id,mint_address");
    if (tokenError || !tokens) throw new Error(`Create creator tokens failed: ${tokenError?.message}`);
    const tokenByMint = new Map(tokens.map((token) => [token.mint_address, token.id]));
    tokenIds = {
      approvedA: tokenByMint.get(`approved-a-${suffix}`)!,
      approvedB: tokenByMint.get(`approved-b-${suffix}`)!,
      pending: tokenByMint.get(`pending-${suffix}`)!,
      otherApproved: tokenByMint.get(`other-approved-${suffix}`)!,
    };
    challengeIds = [];
  });

  afterEach(async () => {
    if (challengeIds.length) await admin.from("external_mint_attachment_challenges").delete().in("id", challengeIds);
    if (projectId) await admin.from("projects").delete().eq("id", projectId);
    if (workId) await admin.from("works").delete().eq("id", workId);
    if (otherProjectId) await admin.from("projects").delete().eq("id", otherProjectId);
    if (otherWorkId) await admin.from("works").delete().eq("id", otherWorkId);
    if (tokenIds) await admin.from("creator_tokens").delete().in("id", Object.values(tokenIds));
    challengeIds = [];
    projectId = "";
    workId = "";
    otherProjectId = "";
    otherWorkId = "";
  });

  afterAll(async () => {
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (otherUserId) await admin.auth.admin.deleteUser(otherUserId);
  }, 30_000);

  const targetId = (targetType: TargetType, other = false) => {
    if (targetType === "project") return other ? otherProjectId : projectId;
    return other ? otherWorkId : workId;
  };

  const linkToken = (client: SupabaseClient, tokenId: string | null, targetType: TargetType, id: string) =>
    client.rpc("link_approved_creator_token", {
      p_token_id: tokenId,
      p_target_type: targetType,
      p_target_id: id,
    });

  const readLink = async (targetType: TargetType, id: string) => {
    const table = targetType === "project" ? "projects" : "works";
    const { data, error } = await admin.from(table)
      .select("linked_token_id,linked_token_mint,linked_token_ticker,linked_token_name,linked_token_image_url")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  };

  const seedExternalLink = async (targetType: TargetType, id: string) => {
    const challengeId = crypto.randomUUID();
    const { error: seedError } = await admin.from("external_mint_attachment_challenges").insert({
      id: challengeId,
      user_id: ownerId,
      target_type: targetType,
      target_id: id,
      mint_address: EXTERNAL_MINT,
      creator_wallet: "11111111111111111111111111111111",
      message: "Approved-token replacement test seed",
      token_name: "External Test Coin",
      token_ticker: "EXT",
      token_image_url: "https://images.example.test/external.png",
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (seedError) throw new Error(`Seed external relationship failed: ${seedError.message}`);
    challengeIds.push(challengeId);
    const { error } = await admin.rpc("attach_verified_external_mint", { p_challenge_id: challengeId });
    if (error) throw new Error(`Create external relationship failed: ${error.message}`);
  };

  it.each(TARGET_TYPES)("allows the owner to replace an external link, replace an approved token, then unlink a %s", async (targetType) => {
    const id = targetId(targetType);
    await seedExternalLink(targetType, id);
    expect((await readLink(targetType, id)).linked_token_mint).toBe(EXTERNAL_MINT);

    const firstLink = await linkToken(owner, tokenIds.approvedA, targetType, id);
    expect(firstLink.error).toBeNull();
    expect(await readLink(targetType, id)).toEqual({
      linked_token_id: tokenIds.approvedA,
      linked_token_mint: null,
      linked_token_ticker: null,
      linked_token_name: null,
      linked_token_image_url: null,
    });

    const replacement = await linkToken(owner, tokenIds.approvedB, targetType, id);
    expect(replacement.error).toBeNull();
    expect((await readLink(targetType, id)).linked_token_id).toBe(tokenIds.approvedB);

    const unlink = await linkToken(owner, null, targetType, id);
    expect(unlink.error).toBeNull();
    expect(await readLink(targetType, id)).toEqual({
      linked_token_id: null,
      linked_token_mint: null,
      linked_token_ticker: null,
      linked_token_name: null,
      linked_token_image_url: null,
    });
  });

  it.each(TARGET_TYPES)("rejects pending, foreign-token, non-owner, and foreign-target links for a %s", async (targetType) => {
    const id = targetId(targetType);
    const otherId = targetId(targetType, true);

    expect((await linkToken(owner, tokenIds.pending, targetType, id)).error?.code).toBe("42501");
    expect((await linkToken(owner, tokenIds.otherApproved, targetType, id)).error?.code).toBe("42501");
    expect((await linkToken(otherUser, tokenIds.approvedA, targetType, id)).error?.code).toBe("42501");
    expect((await linkToken(owner, tokenIds.approvedA, targetType, otherId)).error?.code).toBe("42501");

    expect(await readLink(targetType, id)).toEqual({
      linked_token_id: null,
      linked_token_mint: null,
      linked_token_ticker: null,
      linked_token_name: null,
      linked_token_image_url: null,
    });
    expect(await readLink(targetType, otherId)).toEqual({
      linked_token_id: null,
      linked_token_mint: null,
      linked_token_ticker: null,
      linked_token_name: null,
      linked_token_image_url: null,
    });
  });
});
