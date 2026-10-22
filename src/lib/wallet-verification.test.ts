import { describe, it, expect, vi } from "vitest";
import bs58 from "bs58";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import {
  VERIFY_WALLET_FUNCTION,
  WalletVerificationError,
  runWalletVerificationOnce,
  verifyWalletOwnership,
  type InvokeFn,
} from "./wallet-verification";

/**
 * Client half of the wallet ownership handshake. The backend does
 * the real verification; these tests pin down that the client relays the
 * server's exact challenge, never skips the signature step, and never
 * reports success unless the backend confirmed it.
 */

const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const CHALLENGE_ID = "6f1c9a52-4d0b-4b8e-9a51-2f1b7c3e8d10";
const MESSAGE =
  "Rhozeland wants you to verify ownership of this Solana wallet.\nNonce: abc";
const SIGNATURE_BYTES = new Uint8Array(64).fill(7);

const httpError = (status: number, body: unknown) => ({
  name: "FunctionsHttpError",
  message: "Edge Function returned a non-2xx status code",
  context: new Response(JSON.stringify(body), { status }),
});

const happyInvoke = () =>
  vi.fn<InvokeFn>(async (_name, { body }) => {
    if (body.action === "challenge") {
      return {
        data: { challengeId: CHALLENGE_ID, message: MESSAGE },
        error: null,
      };
    }
    return { data: { verified: true, walletAddress: WALLET }, error: null };
  });

const expectVerificationError = async (
  promise: Promise<unknown>,
  reason: WalletVerificationError["reason"],
) => {
  const err = await promise.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(WalletVerificationError);
  expect((err as WalletVerificationError).reason).toBe(reason);
  return err as WalletVerificationError;
};

describe("verifyWalletOwnership", () => {
  it("signs the server's exact challenge and links only after the backend verifies", async () => {
    const invoke = happyInvoke();
    const signMessage = vi.fn(async (_message: Uint8Array) => SIGNATURE_BYTES);

    await expect(
      verifyWalletOwnership({ walletAddress: WALLET, signMessage, invoke }),
    ).resolves.toBe(WALLET);

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(1, VERIFY_WALLET_FUNCTION, {
      body: { action: "challenge", walletAddress: WALLET },
    });

    const signed = signMessage.mock.calls[0][0];
    expect(new TextDecoder().decode(signed)).toBe(MESSAGE);

    expect(invoke).toHaveBeenNthCalledWith(2, VERIFY_WALLET_FUNCTION, {
      body: {
        action: "verify",
        challengeId: CHALLENGE_ID,
        walletAddress: WALLET,
        message: MESSAGE,
        signature: bs58.encode(SIGNATURE_BYTES),
      },
    });
  });

  it("fails before contacting the backend when the wallet can't sign messages", async () => {
    const invoke = happyInvoke();
    await expectVerificationError(
      verifyWalletOwnership({
        walletAddress: WALLET,
        signMessage: undefined,
        invoke,
      }),
      "unsupported",
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("never submits a verification when the wallet refuses to sign", async () => {
    const invoke = happyInvoke();
    const signMessage = vi.fn(async () => {
      throw new Error("User rejected the request.");
    });

    await expectVerificationError(
      verifyWalletOwnership({ walletAddress: WALLET, signMessage, invoke }),
      "declined",
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body.action).toBe("challenge");
  });

  it("surfaces the backend's reason when the signature is refused", async () => {
    const invoke = vi.fn<InvokeFn>(async (_name, { body }) =>
      body.action === "challenge"
        ? { data: { challengeId: CHALLENGE_ID, message: MESSAGE }, error: null }
        : {
            data: null,
            error: httpError(401, {
              error: "The signature could not be verified for this wallet.",
              code: "invalid_signature",
            }),
          },
    );

    const err = await expectVerificationError(
      verifyWalletOwnership({
        walletAddress: WALLET,
        signMessage: async () => SIGNATURE_BYTES,
        invoke,
      }),
      "rejected",
    );
    expect(err.code).toBe("invalid_signature");
    expect(err.message).toBe(
      "The signature could not be verified for this wallet.",
    );
  });

  it("does not ask the wallet to sign when the challenge request is refused", async () => {
    const invoke = vi.fn<InvokeFn>(async () => ({
      data: null,
      error: httpError(409, {
        error: "Already linked",
        code: "wallet_already_linked",
      }),
    }));
    const signMessage = vi.fn(async () => SIGNATURE_BYTES);

    const err = await expectVerificationError(
      verifyWalletOwnership({ walletAddress: WALLET, signMessage, invoke }),
      "rejected",
    );
    expect(err.code).toBe("wallet_already_linked");
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("does not sign a malformed challenge", async () => {
    const invoke = vi.fn<InvokeFn>(async () => ({
      data: { message: MESSAGE },
      error: null,
    }));
    const signMessage = vi.fn(async () => SIGNATURE_BYTES);

    await expectVerificationError(
      verifyWalletOwnership({ walletAddress: WALLET, signMessage, invoke }),
      "rejected",
    );
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("does not report success unless the backend confirms this wallet", async () => {
    const invoke = vi.fn<InvokeFn>(async (_name, { body }) =>
      body.action === "challenge"
        ? { data: { challengeId: CHALLENGE_ID, message: MESSAGE }, error: null }
        : {
            data: {
              verified: true,
              walletAddress: "SomeOtherWallet111111111111111111111111111",
            },
            error: null,
          },
    );

    await expectVerificationError(
      verifyWalletOwnership({
        walletAddress: WALLET,
        signMessage: async () => SIGNATURE_BYTES,
        invoke,
      }),
      "rejected",
    );
  });
});

describe("runWalletVerificationOnce", () => {
  it("shares one in-flight verification per key and clears it when settled", async () => {
    let resolve!: (v: string) => void;
    const run = vi.fn(() => new Promise<string>((r) => (resolve = r)));

    const a = runWalletVerificationOnce("user-1:wallet", run);
    const b = runWalletVerificationOnce("user-1:wallet", run);
    expect(run).toHaveBeenCalledTimes(1);

    resolve(WALLET);
    await expect(a).resolves.toBe(WALLET);
    await expect(b).resolves.toBe(WALLET);

    const rerun = vi.fn(async () => WALLET);
    await runWalletVerificationOnce("user-1:wallet", rerun);
    expect(rerun).toHaveBeenCalledTimes(1);
  });

  it("clears the key after a failure so the user can retry", async () => {
    await expect(
      runWalletVerificationOnce("user-2:wallet", async () => {
        throw new Error("declined");
      }),
    ).rejects.toThrow("declined");

    const retry = vi.fn(async () => WALLET);
    await expect(
      runWalletVerificationOnce("user-2:wallet", retry),
    ).resolves.toBe(WALLET);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
