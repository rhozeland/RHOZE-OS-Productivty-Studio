import { FunctionsHttpError } from "@supabase/supabase-js";
import bs58 from "bs58";
import { supabase } from "@/integrations/supabase/client";

export type WalletVerificationIntent = "link" | "change";

type WalletVerificationOptions = {
  walletAddress: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  intent?: WalletVerificationIntent;
};

type ChallengeResponse = {
  challengeId: string;
  message: string;
  expiresAt: string;
};

export type WalletVerificationResponse = {
  verified: true;
  walletAddress: string;
  changeRequested?: true;
};

export class WalletVerificationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "WalletVerificationError";
  }
}

async function functionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.clone().json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        const code =
          "code" in body && typeof body.code === "string" ? body.code : undefined;
        return new WalletVerificationError(body.error, code);
      }
    } catch {
      // Fall back to the SDK error when the response is not JSON.
    }
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function verifyWalletOwnership({
  walletAddress,
  signMessage,
  intent = "link",
}: WalletVerificationOptions): Promise<WalletVerificationResponse> {
  if (!walletAddress || !signMessage) {
    throw new Error("Connect a wallet that supports message signing.");
  }

  const { data: challenge, error: challengeError } =
    await supabase.functions.invoke<ChallengeResponse>(
      "verify-wallet-ownership",
      {
        body: {
          action: "challenge",
          walletAddress,
          intent,
        },
      },
    );

  if (challengeError) throw await functionError(challengeError);
  if (!challenge?.challengeId || !challenge.message) {
    throw new Error("The server returned an invalid wallet verification challenge.");
  }

  const signature = bs58.encode(
    await signMessage(new TextEncoder().encode(challenge.message)),
  );

  const { data: result, error: verificationError } =
    await supabase.functions.invoke<WalletVerificationResponse>(
      "verify-wallet-ownership",
      {
        body: {
          action: "verify",
          challengeId: challenge.challengeId,
          walletAddress,
          message: challenge.message,
          signature,
        },
      },
    );

  if (verificationError) throw await functionError(verificationError);
  if (
    !result?.verified ||
    result.walletAddress !== walletAddress ||
    (intent === "change" && result.changeRequested !== true)
  ) {
    throw new Error("Wallet verification was not confirmed by the server.");
  }

  return result;
}
