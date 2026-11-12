import nacl from "https://esm.sh/tweetnacl@1.0.3";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { ed25519 } from "https://esm.sh/@noble/curves@1.4.0/ed25519";
import { verifyWalletMessage } from "./wallet-signature-verifier.ts";

// tweetnacl accepts small-order public keys, for which one fixed signature
// can verify any message. Such a key cannot prove possession of a private key.
export const isOwnableWalletKey = (publicKeyBytes: Uint8Array): boolean => {
  try {
    return !ed25519.ExtendedPoint.fromHex(publicKeyBytes).isSmallOrder();
  } catch {
    return false;
  }
};

export const isValidWalletSignature = (
  message: string,
  signature: string,
  walletAddress: string,
): boolean => verifyWalletMessage(message, signature, walletAddress, {
  decodeBase58: bs58.decode,
  signatureLength: nacl.sign.signatureLength,
  publicKeyLength: nacl.sign.publicKeyLength,
  isOwnablePublicKey: isOwnableWalletKey,
  verifyDetached: nacl.sign.detached.verify,
});
