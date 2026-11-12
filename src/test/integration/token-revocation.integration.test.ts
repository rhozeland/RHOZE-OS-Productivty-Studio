/**
 * Token revocation rules — live backend integration test
 * Requires the `20261107120000_token_grant_revocation` and
 * `20261111120000_invalidate_revoked_token_grants` migrations on the target
 * project.
 *
 * Skipped unless ALL of the following env vars are set:
 *   SUPABASE_TEST_URL                          — project URL
 *   SUPABASE_TEST_ANON_KEY                     — anon / publishable key
 *   SUPABASE_TEST_SERVICE_ROLE_KEY             — service role key (users, fixtures, cleanup)
 *   RUN_TOKEN_REVOCATION_INTEGRATION=1         — explicit opt-in safety toggle
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
const OPT_IN = process.env.RUN_TOKEN_REVOCATION_INTEGRATION === "1";

const ENABLED = Boolean(URL && ANON && SERVICE && OPT_IN);
const skipMessage = !OPT_IN
  ? "skipped: set RUN_TOKEN_REVOCATION_INTEGRATION=1 to enable"
  : "skipped: missing SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY";

const describeIntegration = ENABLED ? describe : describe.skip;

// Solana addresses are base58 ed25519 public keys.
const randomAddress = () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const { x } = publicKey.export({ format: "jwk" }) as { x: string };
  return bs58.encode(Buffer.from(x, "base64url"));
};

describeIntegration(
  `Token revocation rules — live backend (${skipMessage})`,
  () => {
    let admin: SupabaseClient;
    let creatorClient: SupabaseClient;
    let fanClient: SupabaseClient;
    let otherClient: SupabaseClient;
    let adminUserClient: SupabaseClient;
    let creatorId: string;
    let fanId: string;
    let otherId: string;
    let adminUserId: string;
    let gatedWorkId: string;

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

    const reviewToken = async (approve: boolean) => {
      const { error } = await adminUserClient.rpc("review_token_submission", {
        _user_id: creatorId,
        _approve: approve,
      });
      if (error) throw error;
    };

    const currentMint = async () => {
      const { data, error } = await admin
        .from("profiles")
        .select("token_mint_address")
        .eq("user_id", creatorId)
        .single();
      if (error) throw error;
      return data.token_mint_address as string | null;
    };

    const seedGrant = async (mint: string) => {
      const { data: creator, error: genErr } = await admin
        .from("profiles")
        .select("token_generation")
        .eq("user_id", creatorId)
        .single();
      if (genErr) throw genErr;
      const { error } = await admin.from("creator_token_grants").upsert(
        {
          user_id: fanId,
          creator_id: creatorId,
          wallet_address: fanWallet,
          mint_address: mint,
          token_generation: creator.token_generation,
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
        const email = `token-revocation-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@integration.test`;
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user)
          throw new Error(`${role} create failed: ${error?.message}`);
        await admin.from("profiles").upsert([{ user_id: data.user.id }], {
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
        if (signInErr)
          throw new Error(`${role} sign-in failed: ${signInErr.message}`);
        return { id: data.user.id, client };
      };

      ({ id: creatorId, client: creatorClient } =
        await signedInUser("creator"));
      ({ id: fanId, client: fanClient } = await signedInUser("fan"));
      ({ id: otherId, client: otherClient } = await signedInUser("other"));
      ({ id: adminUserId, client: adminUserClient } =
        await signedInUser("admin"));

      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: adminUserId, role: "admin" });
      if (roleErr) throw roleErr;

      const { error: walletErr } = await admin
        .from("profiles")
        .update({ wallet_address: fanWallet, wallet_locked: true })
        .eq("user_id", fanId);
      if (walletErr) throw walletErr;

      const { data: work, error: workErr } = await admin
        .from("works")
        .insert({
          user_id: creatorId,
          title: "Token revocation integration work",
          content_hash: `token-revocation-${crypto.randomUUID()}`,
          visibility: "subscribers",
        })
        .select("id")
        .single();
      if (workErr) throw workErr;
      gatedWorkId = work.id;
    }, 60_000);

    beforeEach(async () => {
      // Every test starts with an approved live token and a fan grant for it.
      await admin.from("creator_tokens").delete().eq("user_id", creatorId);
      await removeToken();
      liveMint = randomAddress();
      await submitToken(liveMint);
      await reviewToken(true);
      expect(await currentMint()).toBe(liveMint);
      await seedGrant(liveMint);
    }, 30_000);

    afterAll(async () => {
      try {
        const ids = [creatorId, fanId, otherId, adminUserId].filter(Boolean);
        await admin.from("creator_token_grants").delete().in("user_id", ids);
        await admin.from("creator_tokens").delete().in("user_id", ids);
        if (gatedWorkId)
          await admin.from("works").delete().eq("id", gatedWorkId);
        await admin.from("user_roles").delete().in("user_id", ids);
        await admin.from("profiles").delete().in("user_id", ids);
        for (const id of ids) await admin.auth.admin.deleteUser(id);
      } catch {
        // Best-effort cleanup — never mask the real assertion failure.
      }
    }, 30_000);

    it("unlocks gated works for a grant on the live token", async () => {
      expect(await fanSeesGatedWork()).toBe(true);
      expect(await fanSeesGrant()).toBe(true);
    });

    it("keeps access while a replacement is pending or rejected", async () => {
      await submitToken(randomAddress());
      expect(await currentMint()).toBe(liveMint);
      expect(await fanSeesGatedWork()).toBe(true);

      await reviewToken(false);
      expect(await currentMint()).toBe(liveMint);
      expect(await fanSeesGatedWork()).toBe(true);
    });

    it("revokes grants for the old token once a replacement is approved", async () => {
      const newMint = randomAddress();
      await submitToken(newMint);
      await reviewToken(true);

      expect(await currentMint()).toBe(newMint);
      expect(await fanSeesGatedWork()).toBe(false);
      expect(await fanSeesGrant()).toBe(false);

      await seedGrant(newMint);
      expect(await fanSeesGatedWork()).toBe(true);
    });

    it("revokes every grant when the token is removed, until an admin approves one", async () => {
      await removeToken();
      expect(await currentMint()).toBeNull();
      expect(await fanSeesGatedWork()).toBe(false);

      await submitToken(liveMint);
      expect(await currentMint()).toBeNull();
      expect(await fanSeesGatedWork()).toBe(false);
    });

    it("revokes access when an admin rejects the primary coin in creator_tokens", async () => {
      const coinMint = randomAddress();
      const { error: insertErr } = await creatorClient
        .from("creator_tokens")
        .insert({
          user_id: creatorId,
          mint_address: coinMint,
          ticker: "TK3",
          status: "pending",
        });
      if (insertErr) throw insertErr;
      const { error: approveErr } = await adminUserClient
        .from("creator_tokens")
        .update({ status: "approved", is_primary: true })
        .eq("mint_address", coinMint);
      if (approveErr) throw approveErr;
      expect(await currentMint()).toBe(coinMint);
      await seedGrant(coinMint);
      expect(await fanSeesGatedWork()).toBe(true);

      const { error: rejectErr } = await adminUserClient
        .from("creator_tokens")
        .update({ status: "rejected" })
        .eq("mint_address", coinMint);
      if (rejectErr) throw rejectErr;

      expect(await currentMint()).toBeNull();
      expect(await fanSeesGatedWork()).toBe(false);
    });

    it("unlocks nothing for a grant on a mint that was never live", async () => {
      await seedGrant(randomAddress());

      expect(await fanSeesGatedWork()).toBe(false);
      expect(await fanSeesGrant()).toBe(false);
    });

    it("refuses unauthorized revocation and grant tampering", async () => {
      await otherClient
        .from("profiles")
        .update({ token_mint_address: null, token_ticker: null })
        .eq("user_id", creatorId);
      expect(await currentMint()).toBe(liveMint);

      const { error: insertErr } = await fanClient
        .from("creator_token_grants")
        .insert({
          user_id: fanId,
          creator_id: creatorId,
          wallet_address: fanWallet,
          mint_address: liveMint,
          balance: 1,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      expect(insertErr).not.toBeNull();

      const { error: updateErr } = await fanClient
        .from("creator_token_grants")
        .update({
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .eq("user_id", fanId);
      expect(updateErr).not.toBeNull();

      const { error: reviewErr } = await creatorClient.rpc(
        "review_token_submission",
        {
          _user_id: creatorId,
          _approve: true,
        },
      );
      expect(reviewErr).not.toBeNull();
    });
  },
);
