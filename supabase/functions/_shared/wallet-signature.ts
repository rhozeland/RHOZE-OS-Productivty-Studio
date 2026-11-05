import nacl from "https://esm.sh/tweetnacl@1.0.3";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { ed25519 } from "https://esm.sh/@noble/curves@1.4.0/ed25519";

// tweetnacl accepts small-order public keys, for which one fixed signature
// verifies every message. No private key stands behind them, so they can
// never prove ownership. fromHex also rejects off-curve and non-canonical
// encodings.
export const isOwnableWalletKey = (pubBytes: Uint8Array) => {
  try {
    return !ed25519.ExtendedPoint.fromHex(pubBytes).isSmallOrder();
  } catch {
    return false;
  }
};

export const isValidWalletSignature = (
  message: string,
  signature: string,
  walletAddress: string,
) => {
  try {
    const sigBytes = bs58.decode(signature);
    const pubBytes = bs58.decode(walletAddress);
    if (sigBytes.length !== nacl.sign.signatureLength) return false;
    if (pubBytes.length !== nacl.sign.publicKeyLength) return false;
    if (!isOwnableWalletKey(pubBytes)) return false;
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      sigBytes,
      pubBytes,
    );
  } catch {
    return false;
  }
};
