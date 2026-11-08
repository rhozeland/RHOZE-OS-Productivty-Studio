export interface VerifiedPumpCoin {
  mint: string;
  creatorWallet: string;
  name: string;
  ticker: string;
  imageUrl: string | null;
}

export const isInitializedSplMintAccount = (input: {
  owner: string | undefined;
  executable: boolean | undefined;
  data: Uint8Array | null;
}, tokenProgramId: string): boolean =>
  input.owner === tokenProgramId &&
  input.executable === false &&
  input.data !== null &&
  input.data.length >= 82 &&
  input.data[45] === 1 &&
  input.data[44] <= 18;

export const accountInfoValue = <T>(response: { value?: T | null } | null | undefined): T | null =>
  response?.value ?? null;

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Validate canonical Solana public-key length without assuming it is on-curve. */
export const isSolanaPublicKey = (value: string): boolean => {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;

  let decoded = 0n;
  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) return false;
    decoded = decoded * 58n + BigInt(digit);
  }

  let significantBytes = 0;
  for (let value = decoded; value > 0n; value >>= 8n) significantBytes += 1;
  let leadingZeroBytes = 0;
  while (value[leadingZeroBytes] === "1") leadingZeroBytes += 1;
  return significantBytes + leadingZeroBytes === 32;
};

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex -- Strip control characters from untrusted token labels.
  const clean = value.replace(/[\u0009-\u000d]/g, " ")
    // eslint-disable-next-line no-control-regex -- Remove non-whitespace control and bidi characters.
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return clean || null;
};

const cleanImageUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

/** Accept metadata only when pump.fun identifies the exact requested mint. */
export const parsePumpCoin = (
  payload: unknown,
  requestedMint: string,
): VerifiedPumpCoin | null => {
  if (!payload || typeof payload !== "object") return null;
  const coin = payload as Record<string, unknown>;
  if (coin.mint !== requestedMint || !isSolanaPublicKey(requestedMint)) return null;

  const creatorWallet = typeof coin.creator === "string" ? coin.creator : "";
  if (!isSolanaPublicKey(creatorWallet)) return null;

  const name = cleanText(coin.name, 128);
  const ticker = cleanText(coin.symbol, 24);
  if (!name || !ticker) return null;

  return {
    mint: requestedMint,
    creatorWallet,
    name,
    ticker,
    imageUrl: cleanImageUrl(coin.image_uri),
  };
};

export const buildExternalMintChallengeMessage = (input: {
  challengeId: string;
  userId: string;
  targetType: "project" | "work";
  targetId: string;
  mint: string;
  creatorWallet: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}): string => [
  "Rhozeland external pump.fun mint attachment verification",
  "Purpose: Attach the identified pump.fun mint to the specified Rhozeland target.",
  `User ID: ${input.userId}`,
  `Target type: ${input.targetType}`,
  `Target ID: ${input.targetId}`,
  `Mint: ${input.mint}`,
  `Creator wallet: ${input.creatorWallet}`,
  `Challenge: ${input.challengeId}`,
  `Nonce: ${input.nonce}`,
  `Issued: ${input.issuedAt}`,
  `Expires: ${input.expiresAt}`,
  "Sign this message to prove control of the creator wallet. This is not a transaction and does not spend SOL.",
].join("\n");
