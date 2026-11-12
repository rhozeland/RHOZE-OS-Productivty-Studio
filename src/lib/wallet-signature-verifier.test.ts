import { describe, expect, it } from "vitest";
import bs58 from "bs58";
import { ed25519 } from "@noble/curves/ed25519";
import { verifyWalletMessage } from "../../supabase/functions/_shared/wallet-signature-verifier";

const adapter = {
  decodeBase58: (value: string) => bs58.decode(value),
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

describe("server wallet message signature verification", () => {
  const seed = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const publicKey = ed25519.getPublicKey(seed);
  const message = "Rhozeland one-time mint attachment challenge";
  const signature = bs58.encode(ed25519.sign(new TextEncoder().encode(message), seed));
  const walletAddress = bs58.encode(publicKey);

  it("accepts a valid signature from the exact wallet", () => {
    expect(verifyWalletMessage(message, signature, walletAddress, adapter)).toBe(true);
  });

  it("rejects an altered message, another wallet, and malformed signature", () => {
    const otherWallet = bs58.encode(ed25519.getPublicKey(Uint8Array.from(seed, (byte) => byte + 1)));
    expect(verifyWalletMessage(`${message}!`, signature, walletAddress, adapter)).toBe(false);
    expect(verifyWalletMessage(message, signature, otherWallet, adapter)).toBe(false);
    expect(verifyWalletMessage(message, "not-base58", walletAddress, adapter)).toBe(false);
  });

  it("rejects small-order public keys even when the signature encoding is valid", () => {
    const smallOrderKey = bs58.encode(new Uint8Array(32));
    expect(verifyWalletMessage(message, signature, smallOrderKey, adapter)).toBe(false);
  });
});
