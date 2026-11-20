export interface VerifiedPumpCoin {
  mint: string;
  creatorWallet: string;
  name: string;
  ticker: string;
  imageUrl: string | null;
}

const SPL_MINT_BASE_SIZE = 82;
const SPL_TOKEN_ACCOUNT_BASE_SIZE = 165;
const SPL_MULTISIG_SIZE = 355;
const TOKEN_2022_MINT_ACCOUNT_TYPE = 1;
const TOKEN_2022_MINT_TLV_START = SPL_TOKEN_ACCOUNT_BASE_SIZE + 1;
const MINT_INITIALIZED_OFFSET = 45;

// ExtensionType values that Token-2022 permits on mints. Account-only and
// unknown extension types must not make a mint layout appear valid.
const SUPPORTED_MINT_EXTENSION_TYPES = new Set([
  1, 3, 4, 6, 9, 10, 12, 14, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28,
]);

const hasValidCOptionTag = (data: Uint8Array, offset: number): boolean =>
  data[offset] <= 1 && data[offset + 1] === 0 && data[offset + 2] === 0 && data[offset + 3] === 0;

const hasValidMintExtensionTlv = (data: Uint8Array): boolean => {
  const extensionTypes = new Set<number>();
  let offset = 0;

  while (offset < data.length) {
    const remaining = data.length - offset;
    if (remaining < 2) {
      // Token-2022 permits one trailing byte as reallocation capacity.
      return extensionTypes.size > 0;
    }

    const extensionType = data[offset] | (data[offset + 1] << 8);
    if (extensionType === 0) {
      return extensionTypes.size > 0 && data.subarray(offset).every((byte) => byte === 0);
    }
    if (remaining < 4 || !SUPPORTED_MINT_EXTENSION_TYPES.has(extensionType) || extensionTypes.has(extensionType)) {
      return false;
    }

    const extensionLength = data[offset + 2] | (data[offset + 3] << 8);
    const valueEnd = offset + 4 + extensionLength;
    if (valueEnd > data.length) return false;

    extensionTypes.add(extensionType);
    offset = valueEnd;
  }

  return extensionTypes.size > 0;
};

export const isInitializedSplMintAccount = (input: {
  owner: string | undefined;
  executable: boolean | undefined;
  data: Uint8Array | null;
}, tokenProgramId: string): boolean => {
  const { data } = input;
  if (input.owner !== tokenProgramId || input.executable !== false || !data) return false;
  if (data.length < SPL_MINT_BASE_SIZE || data.length === SPL_MULTISIG_SIZE) return false;
  if (
    !hasValidCOptionTag(data, 0) ||
    !hasValidCOptionTag(data, 46) ||
    data[MINT_INITIALIZED_OFFSET] !== 1
  ) return false;

  if (data.length === SPL_MINT_BASE_SIZE) return true;
  if (data.length < TOKEN_2022_MINT_TLV_START) return false;

  // Token-2022 pads an extended mint to the base token-account size, stores
  // AccountType::Mint at byte 165, then starts the TLV entries at byte 166.
  if (data.subarray(SPL_MINT_BASE_SIZE, SPL_TOKEN_ACCOUNT_BASE_SIZE).some((byte) => byte !== 0)) return false;
  if (data[SPL_TOKEN_ACCOUNT_BASE_SIZE] !== TOKEN_2022_MINT_ACCOUNT_TYPE) return false;

  return hasValidMintExtensionTlv(data.subarray(TOKEN_2022_MINT_TLV_START));
};

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
