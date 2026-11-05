/**
 * Token-gated access bound to verified account wallets — live backend test
 * ──────────────────────────────────────────────────────────────────────────
 * verify-token-grant:
 *   - refuses callers with no verified wallet
 *   - refuses wallets not linked to the caller, including another account's
 *     verified wallet signed by its real key
 *   - refuses a bad signature for the linked wallet
 *   - lets the caller's linked wallet through to the token check
 *
 * holds_creator_token() / creator_token_grants RLS:
 *   - a grant for the caller's linked wallet unlocks gated works
 *   - a grant for another wallet, or for a since-replaced wallet, does not
 *
 * Requires the `20261104120000_bind_token_grants_to_linked_wallet` migration
 * and the updated `verify-token-grant` function on the target project.
 *
 * Skipped unless ALL of the following env vars are set:
 *   SUPABASE_TEST_URL                          — project URL
 *   SUPABASE_TEST_ANON_KEY                     — anon / publishable key
 *   SUPABASE_TEST_SERVICE_ROLE_KEY             — service role key (users, fixtures, cleanup)
 *   RUN_TOKEN_GRANT_BINDING_INTEGRATION=1      — explicit opt-in safety toggle
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
const OPT_IN = process.env.RUN_TOKEN_GRANT_BINDING_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);
const skipMessage = !OPT_IN
  ? "skipped: set RUN_TOKEN_GRANT_BINDING_INTEGRATION=1 to enable"
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

describeIntegration(
  `Token grants bound to verified wallets — live backend (${skipMessage})`,
  () => {
    let admin: SupabaseClient;
    let clientA: SupabaseClient;
    let userA: string;
    let userB: string;
    let creatorId: string;
    let gatedWorkId: string;

    const walletA = makeWallet();
    const walletB = makeWallet();
    const unlinkedWallet = makeWallet();
    const testMint = makeWallet().address;

    const requestGrant = (
      wallet: TestWallet,
      opts: { signer?: TestWallet; creator?: string } = {},
    ) => {
      const creator = opts.creator ?? creatorId;
      const message = `Rhozeland token-gate access for ${creator} at ${new Date().toISOString()}`;
      return call(clientA, {
        creatorId: creator,
        walletAddress: wallet.address,
        message,
        signature: (opts.signer ?? wallet).sign(message),
      });
    };

    const linkWallet = async (userId: string, address: string | null) => {
      const { error } = await admin
        .from("profiles")
        .update({ wallet_address: address, wallet_locked: !!address })
        .eq("user_id", userId);
      if (error) throw error;
    };

    const seedGrant = async (userId: string, walletAddress: string) => {
      const { error } = await admin.from("creator_token_grants").upsert(
        {
          user_id: userId,
          creator_id: creatorId,
          wallet_address: walletAddress,
          mint_address: testMint,
          balance: 1,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "user_id,creator_id" },
      );
      if (error) throw error;
    };

    const grantCount = async (userId: string) => {
      const { count, error } = await admin
        .from("creator_token_grants")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) throw error;
      return count ?? 0;
    };

    const canSeeGatedWork = async () => {
      const { data, error } = await clientA
        .from("works")
        .select("id")
        .eq("id", gatedWorkId);
      if (error) throw error;
      return (data ?? []).length === 1;
    };

    const canSeeOwnGrant = async () => {
      const { data, error } = await clientA
        .from("creator_token_grants")
        .select("id")
        .eq("user_id", userA)
        .eq("creator_id", creatorId);
      if (error) throw error;
      return (data ?? []).length === 1;
    };

    beforeAll(async () => {
      admin = createClient(URL, SERVICE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const password = `Tt!${crypto.randomUUID()}`;
      const mkUser = async (role: string) => {
        const email = `token-binding-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@integration.test`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user)
          throw new Error(`${role} create failed: ${error?.message}`);
        return { id: data.user.id, email };
      };

      const a = await mkUser("a");
      const b = await mkUser("b");
      const creator = await mkUser("creator");
      userA = a.id;
      userB = b.id;
      creatorId = creator.id;

      await admin
        .from("profiles")
        .upsert(
          [{ user_id: userA }, { user_id: userB }, { user_id: creatorId }],
          { onConflict: "user_id", ignoreDuplicates: true },
        );

      const { data: work, error: workErr } = await admin
        .from("works")
        .insert({
          user_id: creatorId,
          title: "Token-gated integration work",
          content_hash: `token-binding-${crypto.randomUUID()}`,
          visibility: "subscribers",
        })
        .select("id")
        .single();
      if (workErr) throw workErr;
      gatedWorkId = work.id;

      clientA = createClient(URL, ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInErr } = await clientA.auth.signInWithPassword({
        email: a.email,
        password,
      });
      if (signInErr) throw new Error(`User A sign-in failed: ${signInErr.message}`);
    }, 60_000);

    beforeEach(async () => {
      await linkWallet(userA, walletA.address);
      await linkWallet(userB, walletB.address);
      await admin
        .from("creator_token_grants")
        .delete()
        .in("user_id", [userA, userB]);
    });

    afterAll(async () => {
      try {
        const ids = [userA, userB, creatorId].filter(Boolean);
        await admin.from("creator_token_grants").delete().in("user_id", ids);
        if (gatedWorkId) await admin.from("works").delete().eq("id", gatedWorkId);
        await admin.from("profiles").delete().in("user_id", ids);
        for (const id of ids) await admin.auth.admin.deleteUser(id);
      } catch {
        // Best-effort cleanup — never mask the real assertion failure.
      }
    }, 30_000);

    describe("verify-token-grant", () => {
      it("refuses a caller with no verified wallet", async () => {
        await linkWallet(userA, null);

        const res = await requestGrant(walletA);

        expect(res.status).toBe(403);
        expect(res.body?.code).toBe("wallet_not_verified");
        expect(await grantCount(userA)).toBe(0);
      });

      it("refuses a wallet that is not linked to the caller", async () => {
        const res = await requestGrant(unlinkedWallet);

        expect(res.status).toBe(403);
        expect(res.body?.code).toBe("wallet_not_linked");
        expect(await grantCount(userA)).toBe(0);
      });

      it("refuses another account's verified wallet, even with its valid signature", async () => {
        const res = await requestGrant(walletB);

        expect(res.status).toBe(403);
        expect(res.body?.code).toBe("wallet_not_linked");
        expect(await grantCount(userA)).toBe(0);
        expect(await grantCount(userB)).toBe(0);
      });

      it("refuses the linked wallet when another key signed", async () => {
        const res = await requestGrant(walletA, { signer: unlinkedWallet });

        expect(res.status).toBe(401);
        expect(await grantCount(userA)).toBe(0);
      });

      it("lets the caller's linked wallet through to the token check", async () => {
        // An unknown creator is the next gate after the wallet checks, so a
        // 404 here means the wallet was accepted without touching Solana RPC.
        const res = await requestGrant(walletA, { creator: crypto.randomUUID() });

        expect(res.status).toBe(404);
        expect(res.body?.error).toBe("creator has not linked a token");
      });
    });

    describe("holds_creator_token() and grant visibility", () => {
      it("unlocks gated works for a grant on the caller's linked wallet", async () => {
        await seedGrant(userA, walletA.address);

        expect(await canSeeGatedWork()).toBe(true);
        expect(await canSeeOwnGrant()).toBe(true);
      });

      it("does not unlock for a grant on another account's wallet", async () => {
        await seedGrant(userA, walletB.address);

        expect(await canSeeGatedWork()).toBe(false);
        expect(await canSeeOwnGrant()).toBe(false);
      });

      it("stops unlocking once the account's wallet is replaced", async () => {
        await seedGrant(userA, walletA.address);
        expect(await canSeeGatedWork()).toBe(true);

        await linkWallet(userA, unlinkedWallet.address);

        expect(await canSeeGatedWork()).toBe(false);
        expect(await canSeeOwnGrant()).toBe(false);
      });

      it("does not unlock once the account has no linked wallet", async () => {
        await seedGrant(userA, walletA.address);
        await linkWallet(userA, null);

        expect(await canSeeGatedWork()).toBe(false);
      });
    });
  },
);
