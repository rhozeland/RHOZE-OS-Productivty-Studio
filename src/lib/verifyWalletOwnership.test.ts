import { beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import bs58 from "bs58";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  verifyWalletOwnership,
  WalletVerificationError,
} from "./verifyWalletOwnership";

const walletAddress = "11111111111111111111111111111111";
const challenge = {
  challengeId: "d3f1e2a4-22c6-4a88-a620-263e48b956d9",
  message: "Rhozeland wallet ownership challenge",
  expiresAt: "2026-11-18T12:05:00.000Z",
};
const signatureBytes = new Uint8Array(64).fill(7);

const functionError = (message: string, code: string, status = 400) =>
  new FunctionsHttpError(
    new Response(JSON.stringify({ error: message, code }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

describe("verifyWalletOwnership", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("requests a link challenge, signs its exact message, and verifies it", async () => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    const result = { verified: true, walletAddress };
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({ data: result, error: null });

    await expect(
      verifyWalletOwnership({ walletAddress, signMessage }),
    ).resolves.toEqual(result);

    expect(invoke).toHaveBeenNthCalledWith(
      1,
      "verify-wallet-ownership",
      {
        body: {
          action: "challenge",
          walletAddress,
          intent: "link",
        },
      },
    );
    expect(signMessage).toHaveBeenCalledWith(
      new TextEncoder().encode(challenge.message),
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "verify-wallet-ownership",
      {
        body: {
          action: "verify",
          challengeId: challenge.challengeId,
          walletAddress,
          message: challenge.message,
          signature: bs58.encode(signatureBytes),
        },
      },
    );
  });

  it("requests a change challenge when the change intent is selected", async () => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    const result = { verified: true, walletAddress, changeRequested: true };
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({ data: result, error: null });

    await expect(
      verifyWalletOwnership({ walletAddress, signMessage, intent: "change" }),
    ).resolves.toEqual(result);

    expect(invoke).toHaveBeenNthCalledWith(
      1,
      "verify-wallet-ownership",
      {
        body: {
          action: "challenge",
          walletAddress,
          intent: "change",
        },
      },
    );
  });

  it("preserves backend error messages and codes without prompting to sign", async () => {
    const signMessage = vi.fn();
    invoke.mockResolvedValueOnce({
      data: null,
      error: functionError(
        "This wallet is already linked to another Rhozeland account.",
        "wallet_already_in_use",
        409,
      ),
    });

    await expect(
      verifyWalletOwnership({ walletAddress, signMessage }),
    ).rejects.toMatchObject<Partial<WalletVerificationError>>({
      name: "WalletVerificationError",
      code: "wallet_already_in_use",
      message: "This wallet is already linked to another Rhozeland account.",
    });
    expect(signMessage).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed challenge responses without signing", async () => {
    const signMessage = vi.fn();
    invoke.mockResolvedValueOnce({
      data: { challengeId: challenge.challengeId },
      error: null,
    });

    await expect(
      verifyWalletOwnership({ walletAddress, signMessage }),
    ).rejects.toThrow(
      "The server returned an invalid wallet verification challenge.",
    );
    expect(signMessage).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("propagates wallet signing cancellation or failure", async () => {
    const signMessage = vi.fn().mockRejectedValue(new Error("User rejected request"));
    invoke.mockResolvedValueOnce({ data: challenge, error: null });

    await expect(
      verifyWalletOwnership({ walletAddress, signMessage }),
    ).rejects.toThrow("User rejected request");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ verified: false, walletAddress }],
    [{ verified: true, walletAddress: "different-wallet" }],
  ])("does not accept an unconfirmed verification result: %o", async (result) => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({ data: result, error: null });

    await expect(
      verifyWalletOwnership({ walletAddress, signMessage }),
    ).rejects.toThrow("Wallet verification was not confirmed by the server.");
  });

  it("requires the server to confirm that a wallet change was requested", async () => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({ data: { verified: true, walletAddress }, error: null });

    await expect(
      verifyWalletOwnership({ walletAddress, signMessage, intent: "change" }),
    ).rejects.toThrow("Wallet verification was not confirmed by the server.");
  });
});
