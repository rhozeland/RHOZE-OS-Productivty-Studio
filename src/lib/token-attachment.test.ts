import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import bs58 from "bs58";
import {
  attachExternalPumpToken,
  invalidateTokenAttachmentQueries,
  linkApprovedCreatorToken,
  tokenAttachmentErrorMessage,
  WalletSignatureRejectedError,
  type ExternalAttachmentBody,
  type FunctionInvoker,
  type MessageSigner,
  type RpcInvoker,
  type TokenTargetType,
} from "@/lib/token-attachment";

const challenge = {
  challengeId: "d1047077-8fb1-4ddf-9c43-ccf713a3ebf4",
  message: "Rhozeland external mint attachment verification\nMint: authoritative-server-value",
  creatorWallet: "CreatorWallet1111111111111111111111111111111",
  expiresAt: "2026-11-14T22:00:00.000Z",
  token: { mint: "Mint111111111111111111111111111111111111111", name: "Verified Coin", ticker: "VERI", imageUrl: null },
};

const attached = {
  attached: true,
  target: { target_type: "project", target_id: "target-id", mint_address: challenge.token.mint },
  token: challenge.token,
};

const invokeWithSuccessfulResponses = () => {
  const invoke = vi.fn<FunctionInvoker>();
  invoke.mockResolvedValueOnce({ data: challenge, error: null });
  invoke.mockResolvedValueOnce({ data: attached, error: null });
  return invoke;
};

describe("shared secure token attachment logic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves a PostgREST message from a plain error object", () => {
    expect(tokenAttachmentErrorMessage({
      message: "Token is not eligible for this target",
      code: "42501",
    })).toBe("Token is not eligible for this target");
  });

  it("preserves a nonempty JavaScript Error message", () => {
    expect(tokenAttachmentErrorMessage(new Error("RPC authorization failed")))
      .toBe("RPC authorization failed");
  });

  it.each([new Error(""), { message: "" }])(
    "uses the generic fallback for an empty message",
    (error) => {
      expect(tokenAttachmentErrorMessage(error)).toBe("Token attachment failed. Please try again.");
    },
  );

  it.each([new Error("   "), { message: "   " }])(
    "uses the generic fallback for a whitespace-only message",
    (error) => {
      expect(tokenAttachmentErrorMessage(error)).toBe("Token attachment failed. Please try again.");
    },
  );

  it.each([null, undefined, "RPC failed", 42501, {}, { message: 42501 }])(
    "uses the generic fallback for unknown or malformed error values",
    (error) => {
      expect(tokenAttachmentErrorMessage(error)).toBe("Token attachment failed. Please try again.");
    },
  );

  it.each(["project", "work"] as TokenTargetType[])("uses the approved-token RPC for a %s target", async (targetType) => {
    const rpc = vi.fn<RpcInvoker>().mockResolvedValue({ error: null });
    await linkApprovedCreatorToken(rpc, {
      tokenId: "approved-token-id",
      targetType,
      targetId: "target-id",
    });

    expect(rpc).toHaveBeenCalledExactlyOnceWith("link_approved_creator_token", {
      p_token_id: "approved-token-id",
      p_target_type: targetType,
      p_target_id: "target-id",
    });
  });

  it.each(["project", "work"] as TokenTargetType[])("uses the external challenge function for a %s target and signs the exact message", async (targetType) => {
    const invoke = invokeWithSuccessfulResponses();
    const signatureBytes = Uint8Array.from([1, 2, 3, 4]);
    const signMessage = vi.fn<MessageSigner>().mockResolvedValue(signatureBytes);

    const result = await attachExternalPumpToken({
      invoke,
      mintAddress: "client-input-mint",
      target: { targetType, targetId: "target-id" },
      signerWallet: "connected-wallet-address",
      signMessage,
    });

    expect(invoke).toHaveBeenNthCalledWith(1, {
      action: "challenge",
      mintAddress: "client-input-mint",
      targetType,
      targetId: "target-id",
      signerWallet: "connected-wallet-address",
    });
    expect(signMessage).toHaveBeenCalledExactlyOnceWith(new TextEncoder().encode(challenge.message));
    expect(invoke).toHaveBeenNthCalledWith(2, {
      action: "attach",
      challengeId: challenge.challengeId,
      signature: bs58.encode(signatureBytes),
    });
    expect(result.token).toEqual(challenge.token);
  });

  it("does not submit an attach action when the wallet rejects the signature", async () => {
    const invoke = vi.fn<FunctionInvoker>().mockResolvedValue({ data: challenge, error: null });
    const signMessage = vi.fn<MessageSigner>().mockRejectedValue({ code: 4001, message: "User rejected the request" });

    await expect(attachExternalPumpToken({
      invoke,
      mintAddress: "client-input-mint",
      target: { targetType: "work", targetId: "target-id" },
      signerWallet: "connected-wallet-address",
      signMessage,
    })).rejects.toBeInstanceOf(WalletSignatureRejectedError);

    expect(invoke).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ action: "challenge" }));
  });

  it("reports expired challenges and requires the caller to begin again", async () => {
    const invoke = vi.fn<FunctionInvoker>();
    invoke.mockResolvedValueOnce({ data: challenge, error: null });
    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({ error: "verification challenge expired; request a new one" }), { status: 410 }),
      },
    });
    const signMessage = vi.fn<MessageSigner>().mockResolvedValue(new Uint8Array([8, 9]));

    await expect(attachExternalPumpToken({
      invoke,
      mintAddress: "client-input-mint",
      target: { targetType: "project", targetId: "target-id" },
      signerWallet: "connected-wallet-address",
      signMessage,
    })).rejects.toMatchObject({ status: 410, message: "The verification challenge expired. Retry to request a fresh challenge." });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("surfaces an unauthorized target response without asking the wallet to sign", async () => {
    const invoke = vi.fn<FunctionInvoker>().mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: new Response(JSON.stringify({ error: "target not found or not owned by this account" }), { status: 404 }),
      },
    });
    const signMessage = vi.fn<MessageSigner>();

    await expect(attachExternalPumpToken({
      invoke,
      mintAddress: "client-input-mint",
      target: { targetType: "project", targetId: "foreign-target-id" },
      signerWallet: "connected-wallet-address",
      signMessage,
    })).rejects.toMatchObject({ status: 404, message: "target not found or not owned by this account" });
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("keeps approved-token and external attachment failures on their own backend path", async () => {
    const rpc = vi.fn<RpcInvoker>().mockResolvedValue({ error: new Error("RPC failed") });
    await expect(linkApprovedCreatorToken(rpc, {
      tokenId: "approved-token-id",
      targetType: "work",
      targetId: "target-id",
    })).rejects.toThrow("RPC failed");

    const invoke = vi.fn<FunctionInvoker>().mockResolvedValue({ data: null, error: {
      message: "Function unavailable",
      context: new Response(JSON.stringify({ error: "external mint verification is unavailable right now" }), { status: 500 }),
    } });
    const signMessage = vi.fn<MessageSigner>();
    await expect(attachExternalPumpToken({
      invoke,
      mintAddress: "client-input-mint",
      target: { targetType: "project", targetId: "target-id" },
      signerWallet: "connected-wallet-address",
      signMessage,
    })).rejects.toThrow("external mint verification is unavailable right now");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(signMessage).not.toHaveBeenCalled();
  });

  it.each(["project", "work"] as TokenTargetType[])("unlinks a %s with the null-token RPC", async (targetType) => {
    const rpc = vi.fn<RpcInvoker>().mockResolvedValue({ error: null });
    await linkApprovedCreatorToken(rpc, { tokenId: null, targetType, targetId: "target-id" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("link_approved_creator_token", {
      p_token_id: null,
      p_target_type: targetType,
      p_target_id: "target-id",
    });
  });

  it.each([
    ["project", ["project", "project-linked-token", "release-linked-token", "launcher-projects", "my-projects"]],
    ["work", ["works-lightbox", "work-token-chip", "launcher-works", "works-mine", "works-registry"]],
  ] as [TokenTargetType, string[]][])("invalidates active %s display query families after a link change", async (targetType, expectedFamilies) => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    await invalidateTokenAttachmentQueries({ invalidateQueries }, { targetType, targetId: "target-id" }, challenge.token.mint);

    const invalidated = invalidateQueries.mock.calls.map(([options]) => options.queryKey);
    for (const family of expectedFamilies) {
      expect(invalidated).toContainEqual(expect.arrayContaining([family]));
    }
    expect(invalidated).toContainEqual(["creator-token-metrics", challenge.token.mint]);
  });

  it.each([
    "../components/coin/AttachCoinLauncher.tsx",
    "../components/project/ProjectCoinPanel.tsx",
    "../components/works/AttachCoinToWorkButton.tsx",
    "../components/coin/TokenAttachmentDialog.tsx",
  ])("keeps protected Project/Work link fields off direct table updates (%s)", (relativePath) => {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    expect(source).not.toMatch(/\.from\(["'](?:projects|works)["']\)\s*\.update\s*\(/s);
    expect(source).not.toMatch(/\.update\s*\(\s*\{[\s\S]{0,500}linked_token_/s);
  });
});
