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

import { verifyArtistMintOwnership } from "./verifyArtistMintOwnership";

const mintAddress = "So11111111111111111111111111111111111111112";
const publicKey = new PublicKey("11111111111111111111111111111111");
const challenge = {
  challengeId: "d3f1e2a4-22c6-4a88-a620-263e48b956d9",
  message: "Rhozeland mint ownership challenge",
  creatorWallet: publicKey.toBase58(),
  mintAddress,
};
const signatureBytes = new Uint8Array(64).fill(7);

describe("verifyArtistMintOwnership", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("requests a challenge, signs its exact message, and submits the signature", async () => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    const result = {
      verified: true,
      creatorWallet: publicKey.toBase58(),
      mintAddress,
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
    const error = new FunctionsHttpError(
      new Response(
        JSON.stringify({
          error: "Connect the wallet used to launch this mint on Pump.fun.",
          code: "wallet_mismatch",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    invoke.mockResolvedValueOnce({ data: null, error });

    await expect(
      verifyArtistMintOwnership({ mintAddress, publicKey, signMessage }),
    ).rejects.toThrow("Connect the wallet used to launch this mint on Pump.fun.");
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
    const error = new FunctionsHttpError(
      new Response(JSON.stringify({ error: "signature does not match the mint creator wallet" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({ data: null, error });

    await expect(
      verifyArtistMintOwnership({ mintAddress, publicKey, signMessage }),
    ).rejects.toThrow("signature does not match the mint creator wallet");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("does not report success when the server response is not verified", async () => {
    const signMessage = vi.fn().mockResolvedValue(signatureBytes);
    invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({ data: { verified: false }, error: null });

    await expect(
      verifyArtistMintOwnership({ mintAddress, publicKey, signMessage }),
    ).rejects.toThrow("Mint ownership verification was not confirmed.");
  });
});
