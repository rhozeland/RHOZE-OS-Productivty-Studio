export interface WalletSignatureAdapter {
  decodeBase58(value: string): Uint8Array;
  signatureLength: number;
  publicKeyLength: number;
  isOwnablePublicKey(publicKeyBytes: Uint8Array): boolean;
  verifyDetached(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
}

export const verifyWalletMessage = (
  message: string,
  signature: string,
  walletAddress: string,
  adapter: WalletSignatureAdapter,
): boolean => {
  try {
    const signatureBytes = adapter.decodeBase58(signature);
    const publicKeyBytes = adapter.decodeBase58(walletAddress);
    if (signatureBytes.length !== adapter.signatureLength) return false;
    if (publicKeyBytes.length !== adapter.publicKeyLength) return false;
    if (!adapter.isOwnablePublicKey(publicKeyBytes)) return false;
    return adapter.verifyDetached(
      new TextEncoder().encode(message),
      signatureBytes,
      publicKeyBytes,
    );
  } catch {
    return false;
  }
};
