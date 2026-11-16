/**
 * Wallet ownership verification — live backend integration test
 * ──────────────────────────────────────────────────────────────────────────
 * Exercises the `verify-wallet-ownership` edge function against the real
 * backend with throwaway users and locally generated ed25519 wallets:
 *
 *   - issuing a challenge alone never links a wallet
 *   - correct wallet + correct signature links it (and consumes the challenge)
 *   - wrong signature / other wallet's signature / edited message fail
 *   - expired and already-consumed challenges fail
 *   - a challenge for user A can't be used by user B
 *   - a challenge for wallet A can't link wallet B
 *   - small-order public keys (forgeable under plain tweetnacl) are refused
 *   - unauthenticated callers, existing wallets and challenge spam are refused
 *   - a wallet linked to one account can't be linked to another, even in a race
 *
 * Requires the `20261021120000_wallet_verification_challenges` and
 * `20261024210000_unique_profile_wallets` migrations and a deployed
 * `verify-wallet-ownership` function on the target project.
 *
 * Skipped unless ALL of the following env vars are set:
 *   SUPABASE_TEST_URL                        — project URL
 *   SUPABASE_TEST_ANON_KEY                   — anon / publishable key
 *   SUPABASE_TEST_SERVICE_ROLE_KEY           — service role key (users, fixtures, cleanup)
 *   RUN_WALLET_VERIFICATION_INTEGRATION=1    — explicit opt-in safety toggle
 *
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  generateKeyPairSync,
  randomBytes,
  sign as ed25519Sign,
} from "node:crypto";
import bs58 from "bs58";

// ── Env-gate ─────────────────────────────────────────────────────────────
const URL =
  process.env.SUPABASE_TEST_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const OPT_IN = process.env.RUN_WALLET_VERIFICATION_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);
const skipMessage = !OPT_IN
  ? "skipped: set RUN_WALLET_VERIFICATION_INTEGRATION=1 to enable"
  : "skipped: missing SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY";

const describeIntegration = ENABLED ? describe : describe.skip;

const FN = "verify-wallet-ownership";

// ── Local test wallets (Solana addresses are base58 ed25519 public keys) ──
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

// supabase-js wraps non-2xx as FunctionsHttpError; unwrap status + JSON body.
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

describeIntegration(
  `Wallet ownership verification — live backend (${skipMessage})`,
  () => {
    let admin: SupabaseClient;
    let clientA: SupabaseClient;
    let clientB: SupabaseClient;
    let userA: string;
    let userB: string;

    const walletA = makeWallet();
    const walletB = makeWallet();

    const requestChallenge = async (
      client: SupabaseClient,
      wallet: TestWallet,
    ) => {
      const res = await call(client, {
        action: "challenge",
        walletAddress: wallet.address,
      });
      expect(res.status).toBe(200);
      return res.body as {
        challengeId: string;
        message: string;
        expiresAt: string;
      };
    };

    const submit = (
      client: SupabaseClient,
      p: {
        challengeId: string;
        walletAddress: string;
        message: string;
        signature: string;
      },
    ) => call(client, { action: "verify", ...p });

    const signedLink = async (client: SupabaseClient, wallet: TestWallet) => {
      const { challengeId, message } = await requestChallenge(client, wallet);
      return {
        challengeId,
        walletAddress: wallet.address,
        message,
        signature: wallet.sign(message),
      };
    };

    const linkedWallet = async (userId: string) => {
      const { data, error } = await admin
        .from("profiles")
        .select("wallet_address, wallet_locked")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data as { wallet_address: string | null; wallet_locked: boolean };
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

      const mkEmail = (role: string) =>
        `wallet-verify-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@integration.test`;
      const password = `Tt!${crypto.randomUUID()}`;
      const emailA = mkEmail("a");
      const emailB = mkEmail("b");

      const { data: a, error: e1 } = await admin.auth.admin.createUser({
        email: emailA,
        password,
        email_confirm: true,
      });
      if (e1 || !a.user)
        throw new Error(`User A create failed: ${e1?.message}`);
      userA = a.user.id;

      const { data: b, error: e2 } = await admin.auth.admin.createUser({
        email: emailB,
        password,
        email_confirm: true,
      });
      if (e2 || !b.user)
        throw new Error(`User B create failed: ${e2?.message}`);
      userB = b.user.id;

      // Signup normally creates the profile; make sure it exists either way.
      await admin
        .from("profiles")
        .upsert([{ user_id: userA }, { user_id: userB }], {
          onConflict: "user_id",
          ignoreDuplicates: true,
        });

      clientA = createClient(URL, ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: s1 } = await clientA.auth.signInWithPassword({
        email: emailA,
        password,
      });
      if (s1) throw new Error(`User A sign-in failed: ${s1.message}`);

      clientB = createClient(URL, ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: s2 } = await clientB.auth.signInWithPassword({
        email: emailB,
        password,
      });
      if (s2) throw new Error(`User B sign-in failed: ${s2.message}`);
    }, 60_000);

    beforeEach(async () => {
      // Every test starts with no linked wallet and no outstanding challenges.
      await admin
        .from("profiles")
        .update({ wallet_address: null, wallet_locked: false })
        .in("user_id", [userA, userB]);
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
        await admin.from("profiles").delete().in("user_id", ids);
        if (userA) await admin.auth.admin.deleteUser(userA);
        if (userB) await admin.auth.admin.deleteUser(userB);
      } catch {
        // Best-effort cleanup — never mask the real assertion failure.
      }
    }, 30_000);

    it("issuing a challenge does not link the wallet", async () => {
      const { message } = await requestChallenge(clientA, walletA);

      expect(message).toContain("Purpose: rhoze-wallet-verification");
      expect(message).toContain(`Wallet: ${walletA.address}`);
      expect(message).toContain(`User ID: ${userA}`);
      expect(message).toMatch(/Nonce: [0-9a-f]{64}/);
      expect((await linkedWallet(userA)).wallet_address).toBeNull();
    });

    it("links the wallet for the correct wallet and signature, consuming the challenge", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);

      const res = await submit(clientA, {
        challengeId,
        walletAddress: walletA.address,
        message,
        signature: walletA.sign(message),
      });

      expect(res).toEqual({
        status: 200,
        body: { verified: true, walletAddress: walletA.address },
      });
      expect(await linkedWallet(userA)).toEqual({
        wallet_address: walletA.address,
        wallet_locked: true,
      });
      expect(await consumedAt(challengeId)).not.toBeNull();
    });

    it("rejects a wrong signature", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);

      const res = await submit(clientA, {
        challengeId,
        walletAddress: walletA.address,
        message,
        signature: bs58.encode(randomBytes(64)),
      });

      expect(res.status).toBe(401);
      expect(res.body?.code).toBe("invalid_signature");
      expect((await linkedWallet(userA)).wallet_address).toBeNull();
    });

    it("rejects a signature from another wallet", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);

      const res = await submit(clientA, {
        challengeId,
        walletAddress: walletA.address,
        message,
        signature: walletB.sign(message),
      });

      expect(res.status).toBe(401);
      expect(res.body?.code).toBe("invalid_signature");
      expect((await linkedWallet(userA)).wallet_address).toBeNull();
    });

    it("rejects a modified challenge message", async () => {
      const first = await requestChallenge(clientA, walletA);
      const edited = first.message.replace(
        /Nonce: \w+/,
        "Nonce: attacker-chosen",
      );

      const editedAndSigned = await submit(clientA, {
        challengeId: first.challengeId,
        walletAddress: walletA.address,
        message: edited,
        signature: walletA.sign(edited),
      });
      expect(editedAndSigned.status).toBe(400);
      expect(editedAndSigned.body?.code).toBe("message_mismatch");

      // Original text submitted, but the wallet actually signed something else.
      const second = await requestChallenge(clientA, walletA);
      const signedSomethingElse = await submit(clientA, {
        challengeId: second.challengeId,
        walletAddress: walletA.address,
        message: second.message,
        signature: walletA.sign(`${second.message}\nextra`),
      });
      expect(signedSomethingElse.status).toBe(401);
      expect(signedSomethingElse.body?.code).toBe("invalid_signature");

      expect((await linkedWallet(userA)).wallet_address).toBeNull();
    });

    it("rejects an expired challenge", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);
      const now = Date.now();
      await admin
        .from("wallet_verification_challenges")
        .update({
          issued_at: new Date(now - 10 * 60_000).toISOString(),
          expires_at: new Date(now - 5 * 60_000).toISOString(),
        })
        .eq("id", challengeId);

      const res = await submit(clientA, {
        challengeId,
        walletAddress: walletA.address,
        message,
        signature: walletA.sign(message),
      });

      expect(res.status).toBe(400);
      expect(res.body?.code).toBe("invalid_challenge");
      expect((await linkedWallet(userA)).wallet_address).toBeNull();
    });

    it("rejects reuse of an already-consumed challenge", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);
      const signed = {
        challengeId,
        walletAddress: walletA.address,
        message,
        signature: walletA.sign(message),
      };
      expect((await submit(clientA, signed)).status).toBe(200);

      // Unlink, then replay the exact same signed challenge.
      await admin
        .from("profiles")
        .update({ wallet_address: null, wallet_locked: false })
        .eq("user_id", userA);
      const replay = await submit(clientA, signed);

      expect(replay.status).toBe(400);
      expect(replay.body?.code).toBe("invalid_challenge");
      expect((await linkedWallet(userA)).wallet_address).toBeNull();
    });

    it("does not let user B use a challenge issued to user A", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);
      const signed = {
        challengeId,
        walletAddress: walletA.address,
        message,
        signature: walletA.sign(message),
      };

      const stolen = await submit(clientB, signed);
      expect(stolen.status).toBe(400);
      expect(stolen.body?.code).toBe("invalid_challenge");
      expect((await linkedWallet(userB)).wallet_address).toBeNull();

      // B's attempt neither consumed A's challenge nor linked anything for A.
      expect(await consumedAt(challengeId)).toBeNull();
      expect((await linkedWallet(userA)).wallet_address).toBeNull();
      expect((await submit(clientA, signed)).status).toBe(200);
    });

    it("refuses small-order public keys that no private key controls", async () => {
      // Identity point: under plain tweetnacl, R = base point, S = 1 'verifies' any message.
      const identity = new Uint8Array(32);
      identity[0] = 1;
      const forged = new Uint8Array(64);
      forged.set(
        Buffer.from(
          "5866666666666666666666666666666666666666666666666666666666666666",
          "hex",
        ),
        0,
      );
      forged[32] = 1;

      const challenge = await call(clientA, {
        action: "challenge",
        walletAddress: bs58.encode(identity),
      });
      expect(challenge.status).toBe(400);

      const forgedVerify = await submit(clientA, {
        challengeId: crypto.randomUUID(),
        walletAddress: bs58.encode(identity),
        message: "any message",
        signature: bs58.encode(forged),
      });
      expect(forgedVerify.status).toBe(400);
      expect((await linkedWallet(userA)).wallet_address).toBeNull();
    });

    it("does not let a challenge for wallet A link wallet B", async () => {
      const { challengeId, message } = await requestChallenge(clientA, walletA);

      const signedByB = await submit(clientA, {
        challengeId,
        walletAddress: walletB.address,
        message,
        signature: walletB.sign(message),
      });
      expect(signedByB.status).toBe(400);
      expect(signedByB.body?.code).toBe("invalid_challenge");

      const signedByA = await submit(clientA, {
        challengeId,
        walletAddress: walletB.address,
        message,
        signature: walletA.sign(message),
      });
      expect(signedByA.status).toBe(400);
      expect(signedByA.body?.code).toBe("invalid_challenge");

      expect((await linkedWallet(userA)).wallet_address).toBeNull();
    });

    it("refuses unauthenticated callers", async () => {
      const anon = createClient(URL, ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const res = await call(anon, {
        action: "challenge",
        walletAddress: walletA.address,
      });
      expect(res.status).toBe(401);
    });

    it("refuses to replace a wallet that is already linked", async () => {
      await admin
        .from("profiles")
        .update({ wallet_address: walletB.address, wallet_locked: true })
        .eq("user_id", userA);

      const res = await call(clientA, {
        action: "challenge",
        walletAddress: walletA.address,
      });
      expect(res.status).toBe(409);
      expect(res.body?.code).toBe("wallet_already_linked");
      expect((await linkedWallet(userA)).wallet_address).toBe(walletB.address);
    });

    it("does not link a wallet that another account already holds", async () => {
      const first = await submit(clientA, await signedLink(clientA, walletA));
      expect(first.status).toBe(200);

      const res = await submit(clientB, await signedLink(clientB, walletA));
      expect(res.status).toBe(409);
      expect(res.body?.code).toBe("wallet_already_in_use");
      expect(await linkedWallet(userB)).toEqual({
        wallet_address: null,
        wallet_locked: false,
      });
      expect((await linkedWallet(userA)).wallet_address).toBe(walletA.address);

      // The owning account still gets already_linked.
      const own = await call(clientA, {
        action: "challenge",
        walletAddress: walletA.address,
      });
      expect(own.status).toBe(409);
      expect(own.body?.code).toBe("already_linked");
    });

    it("lets only one of two accounts racing for a wallet link it", async () => {
      const [signedA, signedB] = await Promise.all([
        signedLink(clientA, walletA),
        signedLink(clientB, walletA),
      ]);
      // No app-level check precedes the link write; only the unique index
      // can stop the second one.
      const [resA, resB] = await Promise.all([
        submit(clientA, signedA),
        submit(clientB, signedB),
      ]);

      expect([resA.status, resB.status].sort()).toEqual([200, 409]);
      const [winner, loser, refused] =
        resA.status === 200 ? [userA, userB, resB] : [userB, userA, resA];
      expect(refused.body?.code).toBe("wallet_already_in_use");
      expect((await linkedWallet(winner)).wallet_address).toBe(
        walletA.address,
      );
      expect(await linkedWallet(loser)).toEqual({
        wallet_address: null,
        wallet_locked: false,
      });
    });

    it("caps outstanding challenges per user", async () => {
      for (let i = 0; i < 5; i++) await requestChallenge(clientA, walletA);
      const res = await call(clientA, {
        action: "challenge",
        walletAddress: walletA.address,
      });
      expect(res.status).toBe(429);
      expect(res.body?.code).toBe("too_many_requests");
    });
  },
);
