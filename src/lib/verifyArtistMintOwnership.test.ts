import { beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  ArtistMintOwnershipError,
  verifyArtistMintOwnership,
} from "./verifyArtistMintOwnership";

const mintAddress = "So11111111111111111111111111111111111111112";
const publicKey = new PublicKey("11111111111111111111111111111111");
const challenge = {
  challengeId: "d3f1e2a4-22c6-4a88-a620-263e48b956d9",
  message: "Rhozeland mint ownership challenge",
  creatorWallet: publicKey.toBase58(),
  mintAddress,
  ticker: "RHOZE",
};
const signatureBytes = new Uint8Array(64).fill(7);

const functionError = (message: string, code: string, status = 400) =>
  new FunctionsHttpError(
    new Response(JSON.stringify({ error: message, code }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

describe("verifyArtistMintOwnership", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("requests a challenge, signs its exact message, and submits the signature", async () => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    const result = {
      verified: true,
      approved: true,
      creatorWallet: publicKey.toBase58(),
      mintAddress,
      ticker: "RHOZE",
      approvedAt: "2026-10-21T12:00:00.000Z",
    };
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({ data: result, error: null });

    await expect(
      verifyArtistMintOwnership({ mintAddress, publicKey, signMessage }),
    ).resolves.toEqual(result);

    expect(invoke).toHaveBeenNthCalledWith(
      1,
      "verify-artist-mint-ownership",
      {
        body: {
          action: "challenge",
          mintAddress,
          signerWallet: publicKey.toBase58(),
        },
      },
    );
    expect(signMessage).toHaveBeenCalledWith(
      new TextEncoder().encode(challenge.message),
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "verify-artist-mint-ownership",
      {
        body: {
          action: "verify",
          challengeId: challenge.challengeId,
          signature: bs58.encode(signatureBytes),
        },
      },
    );
  });

  it("surfaces the backend wallet-mismatch message and does not prompt for a signature", async () => {
    const signMessage = vi.fn();
    invoke.mockResolvedValueOnce({
      data: null,
      error: functionError(
        "Connect the wallet used to launch this mint on Pump.fun.",
        "wallet_mismatch",
        409,
      ),
    });

    await expect(
      verifyArtistMintOwnership({ mintAddress, publicKey, signMessage }),
    ).rejects.toMatchObject({
      name: "ArtistMintOwnershipError",
      code: "wallet_mismatch",
      message: "Connect the wallet used to launch this mint on Pump.fun.",
    });
    expect(signMessage).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["mint_not_found", "Pump.fun could not find this mint."],
    [
      "pump_lookup_failed",
      "Could not retrieve token details from Pump.fun. Try again later.",
    ],
    [
      "pump_invalid_response",
      "Pump.fun did not return a valid creator wallet.",
    ],
    ["wallet_lookup_failed", "Unable to retrieve the account wallet"],
    [
      "profile_not_found",
      "Account profile could not be found. Complete your profile before submitting a token.",
    ],
    ["wallet_not_linked", "Verify and link your wallet before submitting the token."],
    [
      "account_wallet_mismatch",
      "The mint creator wallet must match the wallet connected to the account.",
    ],
    [
      "submission_not_pending",
      "Submit this mint for review before verifying ownership.",
    ],
  ])("preserves the %s backend error code", async (code, message) => {
    const signMessage = vi.fn();
    invoke.mockResolvedValueOnce({
      data: null,
      error: functionError(message, code, code === "mint_not_found" ? 404 : 409),
    });

    const error = await verifyArtistMintOwnership({
      mintAddress,
      publicKey,
      signMessage,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ArtistMintOwnershipError);
    expect(error).toMatchObject({ code, message });
    expect(signMessage).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid challenge response without signing", async () => {
    const signMessage = vi.fn();
    invoke.mockResolvedValueOnce({
      data: { challengeId: challenge.challengeId },
      error: null,
    });

    await expect(
      verifyArtistMintOwnership({ mintAddress, publicKey, signMessage }),
    ).rejects.toThrow("The server returned an invalid verification challenge.");
    expect(signMessage).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("propagates wallet signing cancellation or failure", async () => {
    const signMessage = vi.fn().mockRejectedValue(new Error("User rejected request"));
    invoke.mockResolvedValueOnce({ data: challenge, error: null });

    await expect(
      verifyArtistMintOwnership({ mintAddress, publicKey, signMessage }),
    ).rejects.toThrow("User rejected request");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("surfaces server signature-verification errors", async () => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: new FunctionsHttpError(
          new Response(
            JSON.stringify({
              error: "signature does not match the mint creator wallet",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      });

    await expect(verifyArtistMintOwnership({
      mintAddress,
      publicKey,
      signMessage,
    })).rejects.toThrow("signature does not match the mint creator wallet");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("does not report success unless the server confirms approval", async () => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({
        data: {
          verified: true,
          approved: false,
        },
        error: null,
      });

    await expect(
      verifyArtistMintOwnership({ mintAddress, publicKey, signMessage }),
    ).rejects.toThrow(
      "Mint ownership verification and approval were not confirmed.",
    );
  });
});
