// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";
import { createAttachExternalPumpTokenHandler, type ExternalMintAttachmentRequest } from "../../../supabase/functions/_shared/attach-external-pump-token-handler";
import { verifyWalletMessage } from "../../../supabase/functions/_shared/wallet-signature-verifier";
import { getSupabaseTestConfig } from "./supabase-test-config";

const { url: URL, anonKey: ANON, serviceRoleKey: SERVICE, enabled: ENABLED } =
  getSupabaseTestConfig("RUN_EXTERNAL_MINT_ATTACHMENT_WORKFLOW_INTEGRATION");
const describeIntegration = ENABLED ? describe : describe.skip;

const MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TEST_RPC_URL = "https://solana.integration.invalid";
const TEST_GENESIS_HASH = "isolated-devnet-test-genesis";
const TOKEN_NAME = "Fixture Verified Coin";
const TOKEN_TICKER = "FIXTURE";
const TOKEN_IMAGE = "https://images.example.test/fixture.png";
const signerSeed = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const signerPublicKey = ed25519.getPublicKey(signerSeed);
const signerWallet = bs58.encode(signerPublicKey);

const isOwnablePublicKey = (address: string) => {
  try {
    const bytes = Uint8Array.from(bs58.decode(address));
    return bytes.length === 32 && !ed25519.ExtendedPoint.fromHex(bytes).isSmallOrder();
  } catch {
    return false;
  }
};

const signatureAdapter = {
  decodeBase58: (value: string) => Uint8Array.from(bs58.decode(value)),
  signatureLength: 64,
  publicKeyLength: 32,
  isOwnablePublicKey: (bytes: Uint8Array) => {
    try {
      return !ed25519.ExtendedPoint.fromHex(bytes).isSmallOrder();
    } catch {
      return false;
    }
  },
  verifyDetached: (message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) =>
    ed25519.verify(signature, message, publicKey),
};

const parseBody = (body: unknown) => {
  if (body && typeof body === "object" && "action" in body) {
    const action = (body as { action?: unknown }).action;
    if (action === "challenge" || action === "attach") {
      return { data: body as ExternalMintAttachmentRequest };
    }
  }
  return { details: { formErrors: ["Invalid request fixture"], fieldErrors: {} } };
};

describeIntegration("authenticated external mint attachment handler workflow", () => {
  let admin: SupabaseClient;
  let owner: SupabaseClient;
  let otherUser: SupabaseClient;
  let ownerId = "";
  let otherUserId = "";
  let ownerAccessToken = "";
  let otherAccessToken = "";
  let projectId = "";
  let challengeId = "";
  let handler: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    owner = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    otherUser = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

    const suffix = crypto.randomUUID();
    const ownerEmail = `external-workflow-owner-${suffix}@integration.test`;
    const otherEmail = `external-workflow-other-${suffix}@integration.test`;
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

    const [{ data: ownerSession, error: ownerSignInError }, { data: otherSession, error: otherSignInError }] =
      await Promise.all([
        owner.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword }),
        otherUser.auth.signInWithPassword({ email: otherEmail, password: otherPassword }),
      ]);
    if (ownerSignInError || !ownerSession.session) throw new Error(`Owner sign-in failed: ${ownerSignInError?.message}`);
    if (otherSignInError || !otherSession.session) throw new Error(`Second user sign-in failed: ${otherSignInError?.message}`);
    ownerAccessToken = ownerSession.session.access_token;
    otherAccessToken = otherSession.session.access_token;

    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({ user_id: ownerId, title: "External mint handler integration project" })
      .select("id")
      .single();
    if (projectError || !project) throw new Error(`Create Project failed: ${projectError?.message}`);
    projectId = project.id;

    const mintData = new Uint8Array(82);
    mintData[44] = 9;
    mintData[45] = 1;
    const encodedMintData = btoa(Array.from(mintData, (byte) => String.fromCharCode(byte)).join(""));

    handler = createAttachExternalPumpTokenHandler({
      getEnv: (name) => name === "SUPABASE_URL" ? URL : name === "SUPABASE_SERVICE_ROLE_KEY" ? SERVICE : undefined,
      createAdminClient: () => admin,
      parseBody,
      isOwnablePublicKey,
      encodeBase58: bs58.encode,
      isValidWalletSignature: (message, signature, walletAddress) =>
        verifyWalletMessage(message, signature, walletAddress, signatureAdapter),
      getSolanaConfig: () => ({ cluster: "devnet", rpcUrl: TEST_RPC_URL, tokenProgramId: TOKEN_PROGRAM }),
      clusterGenesisHashes: { devnet: TEST_GENESIS_HASH, "mainnet-beta": "isolated-mainnet-test-genesis" },
      // These fixtures replace only external Solana RPC and pump.fun calls.
      fetch: async (input, init) => {
        const requestUrl = String(input);
        if (requestUrl === TEST_RPC_URL) {
          const request = JSON.parse(String(init?.body)) as { method: string };
          const result = request.method === "getGenesisHash"
            ? TEST_GENESIS_HASH
            : {
              context: { slot: 123 },
              value: {
                owner: TOKEN_PROGRAM,
                executable: false,
                data: [encodedMintData, "base64"],
              },
            };
          return new Response(JSON.stringify({ jsonrpc: "2.0", result }), { status: 200 });
        }
        if (requestUrl === `https://frontend-api-v3.pump.fun/coins/${MINT}`) {
          return new Response(JSON.stringify({
            mint: MINT,
            creator: signerWallet,
            name: TOKEN_NAME,
            symbol: TOKEN_TICKER,
            image_uri: TOKEN_IMAGE,
          }), { status: 200 });
        }
        throw new Error(`Unexpected outbound URL in integration fixture: ${requestUrl}`);
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (otherUserId) await admin.auth.admin.deleteUser(otherUserId);
  }, 30_000);

  afterEach(async () => {
    if (challengeId) await admin.from("external_mint_attachment_challenges").delete().eq("id", challengeId);
    if (projectId) await admin.from("projects").delete().eq("id", projectId);
    challengeId = "";
    projectId = "";
  });

  const post = (token: string | null, body: unknown) => handler(new Request("http://edge-function.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }));

  it("authenticates, challenges, verifies the creator signature, attaches, and persists challenge metadata", async () => {
    expect(isOwnablePublicKey(signerWallet)).toBe(true);

    const unauthenticated = await post(null, {
      action: "challenge", mintAddress: MINT, targetType: "project", targetId: projectId, signerWallet,
    });
    expect(unauthenticated.status).toBe(401);

    const foreignTarget = await post(otherAccessToken, {
      action: "challenge", mintAddress: MINT, targetType: "project", targetId: projectId, signerWallet,
    });
    expect(foreignTarget.status).toBe(404);
    expect((await foreignTarget.json()).error).toBe("target not found or not owned by this account");

    const challengeResponse = await post(ownerAccessToken, {
      action: "challenge", mintAddress: MINT, targetType: "project", targetId: projectId, signerWallet,
    });
    expect(challengeResponse.status).toBe(200);
    const challenge = await challengeResponse.json();
    challengeId = challenge.challengeId;
    expect(challenge.creatorWallet).toBe(signerWallet);
    expect(challenge.message).toContain(`User ID: ${ownerId}`);
    expect(challenge.message).toContain(`Target ID: ${projectId}`);
    expect(challenge.message).toContain(`Mint: ${MINT}`);
    expect(challenge.token).toEqual({ mint: MINT, name: TOKEN_NAME, ticker: TOKEN_TICKER, imageUrl: TOKEN_IMAGE });

    const { data: persistedChallenge, error: challengeReadError } = await admin
      .from("external_mint_attachment_challenges")
      .select("user_id,target_type,target_id,mint_address,creator_wallet,token_name,token_ticker,token_image_url,consumed_at")
      .eq("id", challengeId)
      .single();
    expect(challengeReadError).toBeNull();
    expect(persistedChallenge).toEqual({
      user_id: ownerId,
      target_type: "project",
      target_id: projectId,
      mint_address: MINT,
      creator_wallet: signerWallet,
      token_name: TOKEN_NAME,
      token_ticker: TOKEN_TICKER,
      token_image_url: TOKEN_IMAGE,
      consumed_at: null,
    });

    const invalidSignature = bs58.encode(ed25519.sign(
      new TextEncoder().encode(`${challenge.message}\nchanged`),
      signerSeed,
    ));
    const rejectedAttach = await post(ownerAccessToken, {
      action: "attach", challengeId, signature: invalidSignature,
    });
    expect(rejectedAttach.status).toBe(401);
    expect((await rejectedAttach.json()).error).toBe("signature does not match the pump.fun creator wallet");
    const { data: unchangedProject } = await admin.from("projects")
      .select("linked_token_id,linked_token_mint")
      .eq("id", projectId)
      .single();
    expect(unchangedProject).toEqual({ linked_token_id: null, linked_token_mint: null });

    const signature = bs58.encode(ed25519.sign(new TextEncoder().encode(challenge.message), signerSeed));
    const attachResponse = await post(ownerAccessToken, { action: "attach", challengeId, signature });
    expect(attachResponse.status).toBe(200);
    expect(await attachResponse.json()).toEqual({
      attached: true,
      target: { target_type: "project", target_id: projectId, mint_address: MINT },
      token: { mint: MINT, name: TOKEN_NAME, ticker: TOKEN_TICKER, imageUrl: TOKEN_IMAGE },
    });

    const { data: project, error: projectReadError } = await admin.from("projects")
      .select("linked_token_id,linked_token_mint,linked_token_name,linked_token_ticker,linked_token_image_url")
      .eq("id", projectId)
      .single();
    expect(projectReadError).toBeNull();
    expect(project).toEqual({
      linked_token_id: null,
      linked_token_mint: MINT,
      linked_token_name: TOKEN_NAME,
      linked_token_ticker: TOKEN_TICKER,
      linked_token_image_url: TOKEN_IMAGE,
    });

    const { data: consumedChallenge, error: consumedReadError } = await admin.from("external_mint_attachment_challenges")
      .select("consumed_at")
      .eq("id", challengeId)
      .single();
    expect(consumedReadError).toBeNull();
    expect(consumedChallenge?.consumed_at).toBeTruthy();
  }, 60_000);
});
