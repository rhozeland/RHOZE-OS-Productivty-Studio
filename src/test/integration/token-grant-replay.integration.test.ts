/**
 * Token-grant signature replay — live backend integration test
 * ──────────────────────────────────────────────────────────────────────────
 * verify-token-grant authorizations are server-issued, single-use challenges:
 *   - a fresh signed challenge is accepted exactly once
 *   - replayed, expired and concurrently resubmitted challenges are refused
 *   - a bad signature burns the challenge
 *   - another user's challenge, a wallet-verification challenge and the old
 *     client-composed message format are refused
 *   - open token-grant challenges don't count toward the wallet-verification cap
 *
 * Requires the `20261106120000_token_grant_challenges` migration and the
 * updated `verify-token-grant` and `verify-wallet-ownership` functions on the
 * target project.
 *
 * Skipped unless ALL of the following env vars are set:
 *   SUPABASE_TEST_URL                          — project URL
 *   SUPABASE_TEST_ANON_KEY                     — anon / publishable key
 *   SUPABASE_TEST_SERVICE_ROLE_KEY             — service role key (users, fixtures, cleanup)
 *   RUN_TOKEN_GRANT_REPLAY_INTEGRATION=1       — explicit opt-in safety toggle
 */
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
const OPT_IN = process.env.RUN_TOKEN_GRANT_REPLAY_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);
const skipMessage = !OPT_IN
  ? "skipped: set RUN_TOKEN_GRANT_REPLAY_INTEGRATION=1 to enable"
  : "skipped: missing SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY";

const describeIntegration = ENABLED ? describe : describe.skip;

const FN = "verify-token-grant";

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
  body: { code?: string; error?: string; [key: string]: unknown } | null;
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

// An unknown creator is the first check after the challenge is consumed and
// the signature verified, so this response means "authorization accepted".
const ACCEPTED = { status: 404, error: "creator has not linked a token" };
const isAccepted = (r: FnResult) =>
  r.status === ACCEPTED.status && r.body?.error === ACCEPTED.error;

describeIntegration(
  `Token-grant signature replay — live backend (${skipMessage})`,
  () => {
    let admin: SupabaseClient;
    let clientA: SupabaseClient;
    let clientB: SupabaseClient;
    let userA: string;
    let userB: string;

    const walletA = makeWallet();
    const walletB = makeWallet();
    const otherKey = makeWallet();

    const requestChallenge = async (
      client: SupabaseClient,
      wallet: TestWallet,
    ) => {
      const res = await call(client, {
        action: "challenge",
        creatorId: crypto.randomUUID(),
        walletAddress: wallet.address,
      });
      expect(res.status).toBe(200);
      return res.body as { challengeId: string; message: string };
    };

    const submitGrant = (
      client: SupabaseClient,
      p: { challengeId: string; walletAddress: string; signature: string },
    ) => call(client, { action: "grant", ...p });

    const signedGrant = async (client: SupabaseClient, wallet: TestWallet) => {
      const { challengeId, message } = await requestChallenge(client, wallet);
      return {
        challengeId,
        walletAddress: wallet.address,
        signature: wallet.sign(message),
      };
    };

    const consumedAt = async (challengeId: string) => {
      const { data, error } = await admin
        .from("wallet_verification_challenges")
        .select("consumed_at")
        .eq("id", challengeId)
        .single();
      if (error) throw error;
      return data.consumed_at as string | null;
    };

    beforeAll(async () => {
      admin = createClient(URL, SERVICE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const password = `Tt!${crypto.randomUUID()}`;
      const signedInUser = async (role: string, wallet: TestWallet) => {
        const email = `token-replay-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@integration.test`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user)
          throw new Error(`${role} create failed: ${error?.message}`);
        await admin
          .from("profiles")
          .upsert([{ user_id: data.user.id }], {
            onConflict: "user_id",
            ignoreDuplicates: true,
          });
        const { error: linkErr } = await admin
          .from("profiles")
          .update({ wallet_address: wallet.address, wallet_locked: true })
          .eq("user_id", data.user.id);
        if (linkErr) throw linkErr;

        const client = createClient(URL, ANON, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error: signInErr } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw new Error(`${role} sign-in failed: ${signInErr.message}`);
        return { id: data.user.id, client };
      };

      const a = await signedInUser("a", walletA);
      const b = await signedInUser("b", walletB);
      userA = a.id;
      clientA = a.client;
      userB = b.id;
      clientB = b.client;
    }, 60_000);

    beforeEach(async () => {
      await admin
        .from("wallet_verification_challenges")
        .delete()
        .in("user_id", [userA, userB]);
    });

    afterAll(async () => {
      try {
        const ids = [userA, userB].filter(Boolean);
        await admin
          .from("wallet_verification_challenges")
          .delete()
          .in("user_id", ids);
        await admin.from("creator_token_grants").delete().in("user_id", ids);
        await admin.from("profiles").delete().in("user_id", ids);
        for (const id of ids) await admin.auth.admin.deleteUser(id);
      } catch {
        // Best-effort cleanup — never mask the real assertion failure.
      }
    }, 30_000);

    it("issues a challenge bound to the user, wallet and a nonce", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);

      expect(message).toContain("Purpose: rhoze-token-grant");
      expect(message).toContain(`Wallet: ${walletA.address}`);
      expect(message).toContain(`User ID: ${userA}`);
      expect(message).toMatch(/Nonce: [0-9a-f]{32}/);
      expect(await consumedAt(challengeId)).toBeNull();
    });

    it("accepts a fresh signed challenge and consumes it", async () => {
      const grant = await signedGrant(clientA, walletA);

      expect(isAccepted(await submitGrant(clientA, grant))).toBe(true);
      expect(await consumedAt(grant.challengeId)).not.toBeNull();
    });

    it("refuses replaying a consumed challenge", async () => {
      const grant = await signedGrant(clientA, walletA);
      expect(isAccepted(await submitGrant(clientA, grant))).toBe(true);

      const replay = await submitGrant(clientA, grant);

      expect(replay.status).toBe(400);
      expect(replay.body?.code).toBe("invalid_challenge");
    });

    it("accepts exactly one of several concurrent submissions", async () => {
      const grant = await signedGrant(clientA, walletA);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => submitGrant(clientA, grant)),
      );

      expect(results.filter(isAccepted)).toHaveLength(1);
      expect(
        results.filter((r) => r.status === 400 && r.body?.code === "invalid_challenge"),
      ).toHaveLength(4);
    });

    it("refuses an expired challenge", async () => {
      const grant = await signedGrant(clientA, walletA);
      const past = Date.now() - 10 * 60 * 1000;
      await admin
        .from("wallet_verification_challenges")
        .update({
          issued_at: new Date(past).toISOString(),
          expires_at: new Date(past + 5 * 60 * 1000).toISOString(),
        })
        .eq("id", grant.challengeId);

      const res = await submitGrant(clientA, grant);

      expect(res.status).toBe(400);
      expect(res.body?.code).toBe("invalid_challenge");
      expect(await consumedAt(grant.challengeId)).toBeNull();
    });

    it("burns the challenge on a bad signature", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);

      const bad = await submitGrant(clientA, {
        challengeId,
        walletAddress: walletA.address,
        signature: otherKey.sign(message),
      });
      expect(bad.status).toBe(401);

      const retry = await submitGrant(clientA, {
        challengeId,
        walletAddress: walletA.address,
        signature: walletA.sign(message),
      });
      expect(retry.status).toBe(400);
      expect(retry.body?.code).toBe("invalid_challenge");
    });

    it("refuses another user's challenge without burning it", async () => {
      const grantB = await signedGrant(clientB, walletB);

      const res = await submitGrant(clientA, {
        ...grantB,
        walletAddress: walletA.address,
      });

      expect(res.status).toBe(400);
      expect(res.body?.code).toBe("invalid_challenge");
      expect(await consumedAt(grantB.challengeId)).toBeNull();
    });

    it("refuses a wallet-verification challenge as a grant authorization", async () => {
      const now = Date.now();
      const message = `wallet verification ${crypto.randomUUID()}`;
      const { data: row, error } = await admin
        .from("wallet_verification_challenges")
        .insert({
          user_id: userA,
          wallet_address: walletA.address,
          purpose: "rhoze-wallet-verification",
          nonce: crypto.randomUUID().replace(/-/g, ""),
          message,
          issued_at: new Date(now).toISOString(),
          expires_at: new Date(now + 5 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;

      const res = await submitGrant(clientA, {
        challengeId: row.id,
        walletAddress: walletA.address,
        signature: walletA.sign(message),
      });

      expect(res.status).toBe(400);
      expect(res.body?.code).toBe("invalid_challenge");
      expect(await consumedAt(row.id)).toBeNull();
    });

    it("caps token-grant challenges without blocking wallet verification", async () => {
      for (let i = 0; i < 5; i++) await requestChallenge(clientA, walletA);
      const sixth = await call(clientA, {
        action: "challenge",
        creatorId: crypto.randomUUID(),
        walletAddress: walletA.address,
      });
      expect(sixth.status).toBe(429);

      const { data, error } = await clientA.functions.invoke(
        "verify-wallet-ownership",
        {
          body: {
            action: "challenge",
            walletAddress: makeWallet().address,
            intent: "change",
          },
        },
      );
      expect(error).toBeNull();
      expect(typeof data?.challengeId).toBe("string");
    });

    it("refuses the old client-composed message format", async () => {
      const creatorId = crypto.randomUUID();
      const message = `Rhozeland token-gate access for ${creatorId} at ${new Date().toISOString()}`;

      const res = await call(clientA, {
        creatorId,
        walletAddress: walletA.address,
        message,
        signature: walletA.sign(message),
      });

      expect(res.status).toBe(400);
    });
  },
);
