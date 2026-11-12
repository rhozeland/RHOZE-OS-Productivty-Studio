/**
 * Permanent invalidation of token grants — live backend integration test
 * ──────────────────────────────────────────────────────────────────────────
 * Grants only count for the token generation they were issued in:
 *   - re-approving a replaced, removed or rejected mint revives nothing
 *   - grants without a generation unlock nothing
 *   - clients can't change generations
 *   - a grant written from a pre-revocation snapshot stays invalid
 *   - token holders can't sign URLs for gated files
 *
 * Requires the `20261111120000_invalidate_revoked_token_grants` migration on
 * the target project.
 *
 * Skipped unless ALL of the following env vars are set:
 *   SUPABASE_TEST_URL                            — project URL
 *   SUPABASE_TEST_ANON_KEY                       — anon / publishable key
 *   SUPABASE_TEST_SERVICE_ROLE_KEY               — service role key (users, fixtures, cleanup)
 *   RUN_TOKEN_GRANT_INVALIDATION_INTEGRATION=1   — explicit opt-in safety toggle
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateKeyPairSync } from "node:crypto";
import bs58 from "bs58";

const URL =
  process.env.SUPABASE_TEST_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const OPT_IN = process.env.RUN_TOKEN_GRANT_INVALIDATION_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);
const skipMessage = !OPT_IN
  ? "skipped: set RUN_TOKEN_GRANT_INVALIDATION_INTEGRATION=1 to enable"
  : "skipped: missing SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY";

const describeIntegration = ENABLED ? describe : describe.skip;

const randomAddress = () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const { x } = publicKey.export({ format: "jwk" }) as { x: string };
  return bs58.encode(Buffer.from(x, "base64url"));
};

describeIntegration(
  `Token grant invalidation — live backend (${skipMessage})`,
  () => {
    let admin: SupabaseClient;
    let creatorClient: SupabaseClient;
    let fanClient: SupabaseClient;
    let adminUserClient: SupabaseClient;
    let creatorId: string;
    let fanId: string;
    let adminUserId: string;
    let gatedWorkId: string;
    let gatedPath: string;

    const fanWallet = randomAddress();
    let liveMint: string;

    const submitToken = async (mint: string) => {
      const { error } = await creatorClient
        .from("profiles")
        .update({ token_mint_address: mint, token_ticker: "TKN" })
        .eq("user_id", creatorId);
      if (error) throw error;
    };

    const removeToken = async () => {
      const { error } = await creatorClient
        .from("profiles")
        .update({ token_mint_address: null, token_ticker: null })
        .eq("user_id", creatorId);
      if (error) throw error;
    };

    const approveToken = async (mint: string) => {
      await submitToken(mint);
      const { error } = await adminUserClient.rpc("review_token_submission", {
        _user_id: creatorId,
        _approve: true,
      });
      if (error) throw error;
    };

    const liveToken = async () => {
      const { data, error } = await admin
        .from("profiles")
        .select("token_mint_address, token_generation")
        .eq("user_id", creatorId)
        .single();
      if (error) throw error;
      return data as { token_mint_address: string | null; token_generation: number };
    };

    const seedGrant = async (mint: string, generation?: number | null) => {
      const tokenGeneration =
        generation === undefined ? (await liveToken()).token_generation : generation;
      const { error } = await admin.from("creator_token_grants").upsert(
        {
          user_id: fanId,
          creator_id: creatorId,
          wallet_address: fanWallet,
          mint_address: mint,
          token_generation: tokenGeneration,
          balance: 1,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "user_id,creator_id" },
      );
      if (error) throw error;
    };

    const fanSeesGatedWork = async () => {
      const { data, error } = await fanClient
        .from("works")
        .select("id")
        .eq("id", gatedWorkId);
      if (error) throw error;
      return (data ?? []).length === 1;
    };

    const fanSeesGrant = async () => {
      const { data, error } = await fanClient
        .from("creator_token_grants")
        .select("id")
        .eq("creator_id", creatorId);
      if (error) throw error;
      return (data ?? []).length === 1;
    };

    beforeAll(async () => {
      admin = createClient(URL, SERVICE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const password = `Tt!${crypto.randomUUID()}`;
      const signedInUser = async (role: string) => {
        const email = `token-invalidation-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@integration.test`;
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

      ({ id: creatorId, client: creatorClient } = await signedInUser("creator"));
      ({ id: fanId, client: fanClient } = await signedInUser("fan"));
      ({ id: adminUserId, client: adminUserClient } = await signedInUser("admin"));

      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: adminUserId, role: "admin" });
      if (roleErr) throw roleErr;

      const { error: walletErr } = await admin
        .from("profiles")
        .update({ wallet_address: fanWallet, wallet_locked: true })
        .eq("user_id", fanId);
      if (walletErr) throw walletErr;

      gatedPath = `${creatorId}/${crypto.randomUUID()}.txt`;
      const { error: uploadErr } = await creatorClient.storage
        .from("gated-works")
        .upload(gatedPath, new Blob(["gated"], { type: "text/plain" }));
      if (uploadErr) throw uploadErr;

      const { data: work, error: workErr } = await admin
        .from("works")
        .insert({
          user_id: creatorId,
          title: "Token invalidation integration work",
          content_hash: `token-invalidation-${crypto.randomUUID()}`,
          visibility: "subscribers",
          gating: { enabled: true, gated_path: gatedPath },
        })
        .select("id")
        .single();
      if (workErr) throw workErr;
      gatedWorkId = work.id;
    }, 60_000);

    beforeEach(async () => {
      // Every test starts with an approved live token and a current grant.
      await admin.from("creator_tokens").delete().eq("user_id", creatorId);
      await removeToken();
      liveMint = randomAddress();
      await approveToken(liveMint);
      await seedGrant(liveMint);
      expect(await fanSeesGatedWork()).toBe(true);
    }, 30_000);

    afterAll(async () => {
      try {
        const ids = [creatorId, fanId, adminUserId].filter(Boolean);
        await admin.from("creator_token_grants").delete().in("user_id", ids);
        await admin.from("creator_tokens").delete().in("user_id", ids);
        if (gatedWorkId) await admin.from("works").delete().eq("id", gatedWorkId);
        if (gatedPath) await admin.storage.from("gated-works").remove([gatedPath]);
        await admin.from("user_roles").delete().in("user_id", ids);
        await admin.from("profiles").delete().in("user_id", ids);
        for (const id of ids) await admin.auth.admin.deleteUser(id);
      } catch {
        // Best-effort cleanup — never mask the real assertion failure.
      }
    }, 30_000);

    it("doesn't revive grants when a replaced mint is re-approved", async () => {
      await approveToken(randomAddress());
      await approveToken(liveMint);

      expect((await liveToken()).token_mint_address).toBe(liveMint);
      expect(await fanSeesGatedWork()).toBe(false);
      expect(await fanSeesGrant()).toBe(false);

      await seedGrant(liveMint);
      expect(await fanSeesGatedWork()).toBe(true);
    });

    it("doesn't revive grants when a removed mint is re-approved", async () => {
      await removeToken();
      await approveToken(liveMint);

      expect((await liveToken()).token_mint_address).toBe(liveMint);
      expect(await fanSeesGatedWork()).toBe(false);
    });

    it("doesn't revive grants when a rejected primary coin is re-approved", async () => {
      const coinMint = randomAddress();
      const { error: insertErr } = await creatorClient
        .from("creator_tokens")
        .insert({ user_id: creatorId, mint_address: coinMint, ticker: "TK3", status: "pending" });
      if (insertErr) throw insertErr;
      const setCoin = async (patch: Record<string, unknown>) => {
        const { error } = await adminUserClient
          .from("creator_tokens")
          .update(patch)
          .eq("mint_address", coinMint);
        if (error) throw error;
      };

      await setCoin({ status: "approved", is_primary: true });
      await seedGrant(coinMint);
      expect(await fanSeesGatedWork()).toBe(true);

      await setCoin({ status: "rejected" });
      await setCoin({ status: "approved" });

      expect((await liveToken()).token_mint_address).toBe(coinMint);
      expect(await fanSeesGatedWork()).toBe(false);
    });

    it("ignores grants without a token generation", async () => {
      await seedGrant(liveMint, null);

      expect(await fanSeesGatedWork()).toBe(false);
      expect(await fanSeesGrant()).toBe(false);
    });

    it("keeps token generations out of client control", async () => {
      const { token_generation: generation } = await liveToken();
      await approveToken(randomAddress());
      await approveToken(liveMint);

      await creatorClient
        .from("profiles")
        .update({ token_generation: generation })
        .eq("user_id", creatorId);
      expect((await liveToken()).token_generation).toBe(generation + 2);

      const { error } = await fanClient
        .from("creator_token_grants")
        .update({ token_generation: generation + 2 })
        .eq("user_id", fanId);
      expect(error).not.toBeNull();
      expect(await fanSeesGatedWork()).toBe(false);
    });

    it("keeps a grant written from a pre-revocation snapshot invalid", async () => {
      const snapshot = await liveToken();
      await removeToken();
      await approveToken(liveMint);

      await seedGrant(liveMint, snapshot.token_generation);
      expect(await fanSeesGatedWork()).toBe(false);
    });

    it("doesn't let token holders sign URLs for gated files", async () => {
      const { data, error } = await fanClient.storage
        .from("gated-works")
        .createSignedUrl(gatedPath, 60 * 60 * 24 * 365);
      expect(error).not.toBeNull();
      expect(data?.signedUrl).toBeUndefined();

      const owner = await creatorClient.storage
        .from("gated-works")
        .createSignedUrl(gatedPath, 60);
      expect(owner.error).toBeNull();
    });
  },
);
