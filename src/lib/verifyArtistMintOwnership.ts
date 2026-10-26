import { FunctionsHttpError } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { supabase } from "@/integrations/supabase/client";

type VerifyArtistMintOwnershipOptions = {
  mintAddress: string;
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};

type ChallengeResponse = {
  challengeId: string;
  message: string;
  creatorWallet: string;
  mintAddress: string;
};

type VerificationResponse = {
  verified: true;
  creatorWallet: string;
  mintAddress: string;
};

export class ArtistMintOwnershipError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ArtistMintOwnershipError";
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
        return new ArtistMintOwnershipError(body.error, code);
      }
    } catch {
      // Fall back to the SDK's error when the response is not JSON.
    }
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function verifyArtistMintOwnership({
  mintAddress,
  publicKey,
  signMessage,
}: VerifyArtistMintOwnershipOptions): Promise<VerificationResponse> {
  if (!publicKey || !signMessage) {
    throw new Error("Connect a wallet that supports message signing.");
  }

  const { data: challenge, error: challengeError } =
    await supabase.functions.invoke<ChallengeResponse>(
      "verify-artist-mint-ownership",
      {
        body: {
          action: "challenge",
          mintAddress,
          signerWallet: publicKey.toBase58(),
        },
      },
    );

  if (challengeError) throw await functionError(challengeError);
  if (!challenge?.challengeId || !challenge.message) {
    throw new Error("The server returned an invalid verification challenge.");
  }

  const signature = bs58.encode(
    await signMessage(new TextEncoder().encode(challenge.message)),
  );

  const { data: result, error: verificationError } =
    await supabase.functions.invoke<VerificationResponse>(
      "verify-artist-mint-ownership",
      {
        body: {
          action: "verify",
          challengeId: challenge.challengeId,
          signature,
        },
      },
    );

  if (verificationError) throw await functionError(verificationError);
  if (!result?.verified) {
    throw new Error("Mint ownership verification was not confirmed.");
  }

  return result;
}
