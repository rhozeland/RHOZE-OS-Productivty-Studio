/**
 * Wallet ownership verification - client half of the
 * `verify-wallet-ownership` edge function handshake:
 *
 *   1. Ask the backend for a one-time challenge bound to this user + wallet.
 *   2. Have the connected wallet sign the exact challenge text.
 *   3. Send the signature back. The backend verifies it and only then links
 *      the wallet to the profile.
 *
 * The client never decides whether a signature is valid — it only relays the
 * server's challenge and the wallet's signature.
 */
import bs58 from "bs58";
import { supabase } from "@/integrations/supabase/client";

export const VERIFY_WALLET_FUNCTION = "verify-wallet-ownership";

/**
 * - unsupported: the wallet adapter has no signMessage()
 * - declined:    the wallet refused or failed to sign
 * - rejected:    the backend refused the request or the signature
 */
export type WalletVerificationErrorReason =
  | "unsupported"
  | "declined"
  | "rejected";

export class WalletVerificationError extends Error {
  readonly reason: WalletVerificationErrorReason;
  /** Machine-readable code from the edge function, when it sent one. */
  readonly code?: string;

  constructor(
    reason: WalletVerificationErrorReason,
    message: string,
    code?: string,
  ) {
    super(message);
    this.name = "WalletVerificationError";
    this.reason = reason;
    this.code = code;
  }
}

export type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;
export type InvokeFn = (
  name: string,
  options: { body: Record<string, unknown> },
) => Promise<{ data: unknown; error: unknown }>;

const defaultInvoke: InvokeFn = (name, options) =>
  supabase.functions.invoke(name, options);

const GENERIC_FAILURE = "Wallet verification failed. Please try again.";

// supabase-js wraps non-2xx as FunctionsHttpError and hides the body.
// Pull the JSON body so the UI can show the backend's reason.
async function readFunctionError(
  error: unknown,
): Promise<{ message: string; code?: string }> {
  let message = GENERIC_FAILURE;
  let code: string | undefined;
  try {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } })
      ?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json()) as {
        error?: unknown;
        code?: unknown;
      } | null;
      if (typeof body?.error === "string") message = body.error;
      if (typeof body?.code === "string") code = body.code;
    }
  } catch {
    /* keep the generic message */
  }
  return { message, code };
}

async function callVerifyFunction(
  invoke: InvokeFn,
  body: Record<string, unknown>,
) {
  const { data, error } = await invoke(VERIFY_WALLET_FUNCTION, { body });
  if (error) {
    const { message, code } = await readFunctionError(error);
    throw new WalletVerificationError("rejected", message, code);
  }
  return (data ?? {}) as Record<string, unknown>;
}

/**
 * Runs the full challenge → sign → verify handshake for `walletAddress`.
 * Resolves with the linked address only after the backend confirms it;
 * throws WalletVerificationError otherwise. Nothing is linked on failure.
 */
export async function verifyWalletOwnership({
  walletAddress,
  signMessage,
  invoke = defaultInvoke,
}: {
  walletAddress: string;
  signMessage?: SignMessageFn | null;
  invoke?: InvokeFn;
}): Promise<string> {
  if (!signMessage) {
    throw new WalletVerificationError(
      "unsupported",
      "This wallet can't sign messages, so it can't be verified. Try Phantom or Solflare.",
    );
  }

  const challenge = await callVerifyFunction(invoke, {
    action: "challenge",
    walletAddress,
  });
  const { challengeId, message } = challenge;
  if (typeof challengeId !== "string" || typeof message !== "string") {
    throw new WalletVerificationError(
      "rejected",
      "Couldn't start wallet verification. Please try again.",
    );
  }

  let signature: string;
  try {
    signature = bs58.encode(
      await signMessage(new TextEncoder().encode(message)),
    );
  } catch {
    throw new WalletVerificationError(
      "declined",
      "Signature request was declined — your wallet was not linked.",
    );
  }

  const result = await callVerifyFunction(invoke, {
    action: "verify",
    challengeId,
    walletAddress,
    message,
    signature,
  });
  if (result.verified !== true || result.walletAddress !== walletAddress) {
    throw new WalletVerificationError("rejected", GENERIC_FAILURE);
  }
  return walletAddress;
}

// WalletButton is mounted in several places at once (header, wallet panel,
// portfolio). Share one in-flight verification per key so the wallet only
// shows a single signature prompt.
const inFlight = new Map<string, Promise<string>>();

export function runWalletVerificationOnce(
  key: string,
  run: () => Promise<string>,
): Promise<string> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
