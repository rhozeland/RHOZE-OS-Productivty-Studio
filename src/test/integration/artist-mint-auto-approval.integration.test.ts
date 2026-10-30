import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL =
  process.env.SUPABASE_TEST_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const ENABLED =
  Boolean(URL && ANON && SERVICE) &&
  process.env.RUN_ARTIST_MINT_APPROVAL_INTEGRATION === "1";
const describeIntegration = ENABLED ? describe : describe.skip;

const MINT = "So11111111111111111111111111111111111111112";
const WALLET = "11111111111111111111111111111111";
const TICKER = "RHOZE";

describeIntegration("verified artist mint auto-approval", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let userId: string;
  let challengeId: string;

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `artist-mint-approval-${crypto.randomUUID()}@integration.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `Tt!${crypto.randomUUID()}`,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Failed to create integration user: ${error?.message ?? "no user"}`);
    }
    userId = data.user.id;
  }, 60_000);

  beforeEach(async () => {
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        wallet_address: WALLET,
        token_mint_address_pending: MINT,
        token_ticker_pending: TICKER,
        token_submission_status: "pending",
      })
      .eq("user_id", userId);
    if (profileError) throw new Error(`Failed to seed profile: ${profileError.message}`);

    challengeId = crypto.randomUUID();
    const { error: challengeError } = await admin
      .from("artist_mint_verification_challenges")
      .insert({
        id: challengeId,
        user_id: userId,
        mint_address: MINT,
        token_ticker: TICKER,
        creator_wallet: WALLET,
        message: "integration test signature challenge",
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
    if (challengeError) {
      throw new Error(`Failed to seed challenge: ${challengeError.message}`);
    }
  });

  afterEach(async () => {
    if (challengeId) {
      await admin
        .from("artist_mint_verification_challenges")
        .delete()
        .eq("id", challengeId);
    }
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }, 30_000);

  it("atomically approves the matching pending mint and ticker and consumes the challenge", async () => {
    const { data, error } = await admin.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: userId },
    );

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ mint_address: MINT, ticker: TICKER });
    expect(data?.[0].approved_at).toBeTruthy();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select(
        "token_mint_address,token_ticker,token_mint_address_pending,token_ticker_pending,token_submission_status,token_reviewed_at",
      )
      .eq("user_id", userId)
      .single();
    expect(profileError).toBeNull();
    expect(profile).toMatchObject({
      token_mint_address: MINT,
      token_ticker: TICKER,
      token_mint_address_pending: null,
      token_ticker_pending: null,
      token_submission_status: "approved",
    });
    expect(profile?.token_reviewed_at).toBeTruthy();

    const { data: challenge, error: challengeError } = await admin
      .from("artist_mint_verification_challenges")
      .select("consumed_at")
      .eq("id", challengeId)
      .single();
    expect(challengeError).toBeNull();
    expect(challenge?.consumed_at).toBeTruthy();
  });

  it("does not approve when the pending mint changed after challenge issuance", async () => {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ token_mint_address_pending: "ChangedMintAddress" })
      .eq("user_id", userId);
    expect(updateError).toBeNull();

    const { data, error } = await admin.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: userId },
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not approve when the pending ticker changed after challenge issuance", async () => {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ token_ticker_pending: "CHANGED" })
      .eq("user_id", userId);
    expect(updateError).toBeNull();

    const { data, error } = await admin.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: userId },
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not approve when the profile wallet no longer matches the creator", async () => {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ wallet_address: "11111111111111111111111111111112" })
      .eq("user_id", userId);
    expect(updateError).toBeNull();

    const { data, error } = await admin.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: userId },
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not approve a challenge for a different user", async () => {
    const { data, error } = await admin.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: crypto.randomUUID() },
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not approve an expired or previously consumed challenge", async () => {
    const createdAt = new Date(Date.now() - 10 * 60_000);
    const expiredAt = new Date(Date.now() - 5 * 60_000);
    const { error: expireError } = await admin
      .from("artist_mint_verification_challenges")
      .update({
        created_at: createdAt.toISOString(),
        expires_at: expiredAt.toISOString(),
      })
      .eq("id", challengeId);
    expect(expireError).toBeNull();

    const { data: expired, error: expiredError } = await admin.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: userId },
    );
    expect(expiredError).toBeNull();
    expect(expired).toEqual([]);

    const { error: renewError } = await admin
      .from("artist_mint_verification_challenges")
      .update({
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      .eq("id", challengeId);
    expect(renewError).toBeNull();

    const { data: firstUse, error: firstError } = await admin.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: userId },
    );
    expect(firstError).toBeNull();
    expect(firstUse).toHaveLength(1);

    const { data: replay, error: replayError } = await admin.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: userId },
    );
    expect(replayError).toBeNull();
    expect(replay).toEqual([]);
  });

  it("denies RPC execution to anon clients", async () => {
    const { error } = await anon.rpc(
      "approve_verified_artist_token_submission",
      { _challenge_id: challengeId, _user_id: userId },
    );
    expect(error).toBeTruthy();
  });
});
