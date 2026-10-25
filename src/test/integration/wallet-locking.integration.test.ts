// Live backend. Runs only with SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY,
// SUPABASE_TEST_SERVICE_ROLE_KEY and RUN_WALLET_LOCKING_INTEGRATION=1.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateKeyPairSync, sign as ed25519Sign } from "node:crypto";
import bs58 from "bs58";

const URL =
  process.env.SUPABASE_TEST_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const OPT_IN = process.env.RUN_WALLET_LOCKING_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);
const skipMessage = !OPT_IN
  ? "skipped: set RUN_WALLET_LOCKING_INTEGRATION=1 to enable"
  : "skipped: missing SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY";

const describeIntegration = ENABLED ? describe : describe.skip;

const FN = "verify-wallet-ownership";

type TestWallet = { address: string; sign: (message: string) => string };

const makeWallet = (): TestWallet => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const { x } = publicKey.export({ format: "jwk" }) as { x: string };
  return {
    address: bs58.encode(Buffer.from(x, "base64url")),
    sign: (message) =>
      bs58.encode(ed25519Sign(null, Buffer.from(message, "utf8"), privateKey)),
  };
};

type FnResult = {
  status: number;
  body: { code?: string; [key: string]: unknown } | null;
};

const call = async (
  client: SupabaseClient,
  body: Record<string, unknown>,
): Promise<FnResult> => {
  const { data, error } = await client.functions.invoke(FN, { body });
  if (!error) return { status: 200, body: data };
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    return { status: ctx.status, body: await ctx.json().catch(() => null) };
  }
  throw error;
};

describeIntegration(`Linked-wallet locking — live backend (${skipMessage})`, () => {
  let admin: SupabaseClient;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let clientAdmin: SupabaseClient;
  let userA: string;
  let userB: string;
  let adminUser: string;

  const walletA = makeWallet();
  const replacement = makeWallet();
  const walletB = makeWallet();
  const stranger = makeWallet();

  const binding = async (userId: string) => {
    const { data, error } = await admin
      .from("profiles")
      .select("wallet_address, wallet_locked, bio")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return data as { wallet_address: string | null; wallet_locked: boolean; bio: string | null };
  };

  const expectBlocked = (error: { message?: string } | null) => {
    expect(error).not.toBeNull();
    expect(error?.message).toContain("wallet_binding_locked");
  };

  const signChange = async (client: SupabaseClient, wallet: TestWallet) => {
    const challenge = await call(client, {
      action: "challenge",
      walletAddress: wallet.address,
      intent: "change",
    });
    expect(challenge.status).toBe(200);
    const message = String(challenge.body?.message);
    return {
      action: "verify",
      challengeId: String(challenge.body?.challengeId),
      walletAddress: wallet.address,
      message,
      signature: wallet.sign(message),
    };
  };

  const requestChange = async (client: SupabaseClient, userId: string, wallet: TestWallet) => {
    const verified = await call(client, await signChange(client, wallet));
    expect(verified).toEqual({
      status: 200,
      body: { verified: true, walletAddress: wallet.address, changeRequested: true },
    });
    const { data, error } = await admin
      .from("wallet_change_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const password = `Tt!${crypto.randomUUID()}`;
    const mkUser = async (role: string) => {
      const email = `wallet-lock-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@integration.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(`${role} create failed: ${error?.message}`);
      const client = createClient(URL, ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
      if (signInErr) throw new Error(`${role} sign-in failed: ${signInErr.message}`);
      return { id: data.user.id, client };
    };

    ({ id: userA, client: clientA } = await mkUser("a"));
    ({ id: userB, client: clientB } = await mkUser("b"));
    ({ id: adminUser, client: clientAdmin } = await mkUser("admin"));

    await admin
      .from("profiles")
      .upsert(
        [{ user_id: userA }, { user_id: userB }, { user_id: adminUser }],
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: adminUser, role: "admin" });
    if (roleErr) throw new Error(`admin role insert failed: ${roleErr.message}`);
  }, 60_000);

  beforeEach(async () => {
    const ids = [userA, userB];
    await admin.from("wallet_change_requests").delete().in("user_id", ids);
    await admin.from("wallet_verification_challenges").delete().in("user_id", ids);
    await admin
      .from("profiles")
      .update({ wallet_address: walletA.address, wallet_locked: true })
      .eq("user_id", userA);
    await admin
      .from("profiles")
      .update({ wallet_address: null, wallet_locked: false })
      .eq("user_id", userB);
  });

  afterAll(async () => {
    try {
      const ids = [userA, userB, adminUser].filter(Boolean);
      await admin.from("wallet_change_requests").delete().in("user_id", ids);
      await admin.from("wallet_verification_challenges").delete().in("user_id", ids);
      await admin.from("user_roles").delete().in("user_id", ids);
      await admin.from("profiles").delete().in("user_id", ids);
      for (const id of ids) await admin.auth.admin.deleteUser(id);
    } catch {
      // Best-effort cleanup — never mask the real assertion failure.
    }
  }, 30_000);

  it("a user cannot set a wallet directly", async () => {
    const { error } = await clientB
      .from("profiles")
      .update({ wallet_address: stranger.address })
      .eq("user_id", userB);
    expectBlocked(error);
    expect((await binding(userB)).wallet_address).toBeNull();
  });

  it("a user cannot replace a linked wallet", async () => {
    const { error } = await clientA
      .from("profiles")
      .update({ wallet_address: stranger.address })
      .eq("user_id", userA);
    expectBlocked(error);
    expect((await binding(userA)).wallet_address).toBe(walletA.address);
  });

  it("a user cannot clear a linked wallet", async () => {
    for (const value of [null, ""]) {
      const { error } = await clientA
        .from("profiles")
        .update({ wallet_address: value })
        .eq("user_id", userA);
      expectBlocked(error);
    }
    expect((await binding(userA)).wallet_address).toBe(walletA.address);
  });

  it("a user cannot change wallet_locked", async () => {
    const unlock = await clientA
      .from("profiles")
      .update({ wallet_locked: false })
      .eq("user_id", userA);
    expectBlocked(unlock.error);
    const lock = await clientB
      .from("profiles")
      .update({ wallet_locked: true })
      .eq("user_id", userB);
    expectBlocked(lock.error);
    expect((await binding(userA)).wallet_locked).toBe(true);
    expect((await binding(userB)).wallet_locked).toBe(false);
  });

  it("a user cannot upsert a wallet onto their profile", async () => {
    const { error } = await clientA
      .from("profiles")
      .upsert({ user_id: userA, wallet_address: stranger.address }, { onConflict: "user_id" });
    // Column SELECT privileges refuse this before the trigger; both use 42501.
    expect(error?.code).toBe("42501");
    expect((await binding(userA)).wallet_address).toBe(walletA.address);
  });

  it("a user cannot create a profile row that already carries a wallet", async () => {
    await admin.from("profiles").delete().eq("user_id", userB);
    try {
      const { error } = await clientB
        .from("profiles")
        .insert({ user_id: userB, wallet_address: stranger.address });
      expectBlocked(error);
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userB);
      expect(count).toBe(0);
    } finally {
      await admin
        .from("profiles")
        .upsert({ user_id: userB }, { onConflict: "user_id", ignoreDuplicates: true });
    }
  });

  it("unrelated profile updates still work", async () => {
    const bio = `bio ${Date.now()}`;
    const { error } = await clientA.from("profiles").update({ bio }).eq("user_id", userA);
    expect(error).toBeNull();
    expect(await binding(userA)).toEqual({
      wallet_address: walletA.address,
      wallet_locked: true,
      bio,
    });
  });

  it("the signed verification flow still performs the initial link", async () => {
    const challenge = await call(clientB, { action: "challenge", walletAddress: walletB.address });
    expect(challenge.status).toBe(200);
    const message = String(challenge.body?.message);
    const res = await call(clientB, {
      action: "verify",
      challengeId: String(challenge.body?.challengeId),
      walletAddress: walletB.address,
      message,
      signature: walletB.sign(message),
    });
    expect(res.status).toBe(200);
    const linked = await binding(userB);
    expect(linked.wallet_address).toBe(walletB.address);
    expect(linked.wallet_locked).toBe(true);
  });

  it("a non-admin cannot approve a wallet change, even their own verified one", async () => {
    const requestId = await requestChange(clientA, userA, replacement);
    const { error } = await clientA.rpc("process_wallet_change", {
      _request_id: requestId,
      _approve: true,
    });
    expect(error?.message).toContain("admin role required");
    expect((await binding(userA)).wallet_address).toBe(walletA.address);
  });

  it("supplying an admin's id does not grant admin rights", async () => {
    const requestId = await requestChange(clientA, userA, replacement);
    const { error } = await clientA.rpc("process_wallet_change", {
      _request_id: requestId,
      _admin_id: adminUser,
      _approve: true,
    });
    expect(error).not.toBeNull();
    expect((await binding(userA)).wallet_address).toBe(walletA.address);
  });

  it("anonymous callers cannot run process_wallet_change", async () => {
    const requestId = await requestChange(clientA, userA, replacement);
    const anon = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc("process_wallet_change", {
      _request_id: requestId,
      _approve: true,
    });
    expect(error).not.toBeNull();
    expect((await binding(userA)).wallet_address).toBe(walletA.address);
  });

  it("an approved change cannot install an unverified replacement wallet", async () => {
    const { data, error: insertErr } = await admin
      .from("wallet_change_requests")
      .insert({
        user_id: userA,
        current_wallet: walletA.address,
        requested_wallet: stranger.address,
      })
      .select("id")
      .single();
    if (insertErr) throw insertErr;

    const { error } = await clientAdmin.rpc("process_wallet_change", {
      _request_id: data.id,
      _approve: true,
    });
    expect(error?.message).toContain("not been verified");
    expect((await binding(userA)).wallet_address).toBe(walletA.address);
  });

  it("a verified change takes effect only once an admin approves it", async () => {
    const requestId = await requestChange(clientA, userA, replacement);
    expect((await binding(userA)).wallet_address).toBe(walletA.address);

    const { error } = await clientAdmin.rpc("process_wallet_change", {
      _request_id: requestId,
      _approve: true,
    });
    expect(error).toBeNull();

    const linked = await binding(userA);
    expect(linked.wallet_address).toBe(replacement.address);
    expect(linked.wallet_locked).toBe(true);
    const { data: request } = await admin
      .from("wallet_change_requests")
      .select("status, processed_by")
      .eq("id", requestId)
      .single();
    expect(request).toEqual({ status: "approved", processed_by: adminUser });
  });

  it("a change signed to replace wallet A cannot replace wallet B after another change", async () => {
    const third = makeWallet();
    // Both signed while walletA is linked.
    const first = await signChange(clientA, replacement);
    const second = await signChange(clientA, third);
    expect(second.message).toContain(`Replaces: ${walletA.address}`);

    const filed = await call(clientA, first);
    expect(filed.status).toBe(200);
    const { data: firstRequest } = await admin
      .from("wallet_change_requests")
      .select("id")
      .eq("user_id", userA)
      .eq("status", "pending")
      .single();
    const approved = await clientAdmin.rpc("process_wallet_change", {
      _request_id: firstRequest?.id,
      _approve: true,
    });
    expect(approved.error).toBeNull();
    expect((await binding(userA)).wallet_address).toBe(replacement.address);

    const stale = await call(clientA, second);
    expect(stale.status).toBe(409);
    expect(stale.body?.code).toBe("wallet_changed");

    const { count } = await admin
      .from("wallet_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userA)
      .eq("current_wallet", replacement.address);
    expect(count).toBe(0);
    expect((await binding(userA)).wallet_address).toBe(replacement.address);
  });

  it("an admin cannot reopen a processed request to replay its proof", async () => {
    const requestId = await requestChange(clientA, userA, replacement);
    const rejected = await clientAdmin.rpc("process_wallet_change", {
      _request_id: requestId,
      _approve: false,
    });
    expect(rejected.error).toBeNull();

    await clientAdmin
      .from("wallet_change_requests")
      .update({ status: "pending" })
      .eq("id", requestId);
    const { error } = await clientAdmin.rpc("process_wallet_change", {
      _request_id: requestId,
      _approve: true,
    });
    expect(error?.message).toContain("already processed");
    expect((await binding(userA)).wallet_address).toBe(walletA.address);
  });

  it("users cannot file change requests directly", async () => {
    const { error } = await clientA.from("wallet_change_requests").insert({
      user_id: userA,
      current_wallet: walletA.address,
      requested_wallet: stranger.address,
    });
    expect(error).not.toBeNull();
    const { count } = await admin
      .from("wallet_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userA);
    expect(count).toBe(0);
  });
});
