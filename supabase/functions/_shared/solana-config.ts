export type SolanaEnvironment = "devnet" | "mainnet";
export type SolanaCluster = "devnet" | "mainnet-beta";

export interface SolanaConfig {
  environment: SolanaEnvironment;
  cluster: SolanaCluster;
  rpcUrl: string;
  rhozeMint: string;
  tokenProgramId: string;
  rhozeDecimals: number;
  treasuryAddress: string;
  payoutAddress: string;
  paymentsEnabled: boolean;
  claimsEnabled: boolean;
  anchoringEnabled: boolean;
}

export class SolanaConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid Solana configuration: ${issues.join("; ")}`);
    this.name = "SolanaConfigError";
    this.issues = issues;
  }
}

const parseRequiredEnv = (name: string, issues: string[]): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    issues.push(`${name} is required`);
    return "";
  }
  return value;
};

const parsePublicKey = (
  value: string,
  name: string,
  issues: string[],
): string => {
  if (!isSolanaPublicKey(value)) {
    issues.push(`${name} must be a valid Solana public key`);
  }
  return value;
};

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const isSolanaPublicKey = (value: string): boolean => {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;

  const bytes = [0];
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) return false;

    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (const character of value) {
    if (character !== "1") break;
    bytes.push(0);
  }

  return bytes.length === 32;
};

const parseBoolean = (name: string, defaultValue: boolean): boolean => {
  const value = Deno.env.get(name)?.trim().toLowerCase();
  return value === undefined || value === "" ? defaultValue : value === "true";
};

export const resolveSolanaConfig = (): SolanaConfig => {
  const issues: string[] = [];
  const environment = parseRequiredEnv("SOLANA_ENV", issues);

  if (environment !== "devnet" && environment !== "mainnet") {
    issues.push('SOLANA_ENV must be "devnet" or "mainnet"');
  }

  const resolvedEnvironment: SolanaEnvironment =
    environment === "mainnet" ? "mainnet" : "devnet";
  const cluster: SolanaCluster =
    resolvedEnvironment === "mainnet" ? "mainnet-beta" : "devnet";
  const rpcUrl = parseRequiredEnv("SOLANA_RPC_URL", issues);

  if (resolvedEnvironment === "devnet" && rpcUrl.includes("mainnet")) {
    issues.push("SOLANA_ENV=devnet cannot use a mainnet RPC URL");
  }
  if (resolvedEnvironment === "mainnet" && !rpcUrl) {
    issues.push("SOLANA_ENV=mainnet requires SOLANA_RPC_URL");
  }

  const rhozeMint = parsePublicKey(
    parseRequiredEnv("SOLANA_RHOZE_MINT", issues),
    "SOLANA_RHOZE_MINT",
    issues,
  );
  const tokenProgramId = parsePublicKey(
    parseRequiredEnv("SOLANA_TOKEN_PROGRAM_ID", issues),
    "SOLANA_TOKEN_PROGRAM_ID",
    issues,
  );
  const treasuryAddress = parsePublicKey(
    parseRequiredEnv("SOLANA_TREASURY_WALLET", issues),
    "SOLANA_TREASURY_WALLET",
    issues,
  );
  const payoutAddress = parsePublicKey(
    parseRequiredEnv("SOLANA_PAYOUT_WALLET", issues),
    "SOLANA_PAYOUT_WALLET",
    issues,
  );

  const decimalsValue = parseRequiredEnv("SOLANA_RHOZE_DECIMALS", issues);
  const rhozeDecimals = Number(decimalsValue);
  if (!Number.isInteger(rhozeDecimals) || rhozeDecimals < 0 || rhozeDecimals > 18) {
    issues.push("SOLANA_RHOZE_DECIMALS must be an integer between 0 and 18");
  }

  if (issues.length > 0) {
    throw new SolanaConfigError(issues);
  }

  return {
    environment: resolvedEnvironment,
    cluster,
    rpcUrl,
    rhozeMint,
    tokenProgramId,
    rhozeDecimals,
    treasuryAddress,
    payoutAddress,
    paymentsEnabled: parseBoolean("SOLANA_PAYMENTS_ENABLED", false),
    claimsEnabled: parseBoolean("SOLANA_CLAIMS_ENABLED", false),
    anchoringEnabled: parseBoolean("SOLANA_ANCHORING_ENABLED", false),
  };
};

let cachedConfig: SolanaConfig | null = null;

export const getSolanaConfig = (): SolanaConfig => {
  cachedConfig ??= resolveSolanaConfig();
  return cachedConfig;
};

export const solscanTransactionUrl = (
  signature: string,
  config = getSolanaConfig(),
): string => {
  const clusterSuffix = config.cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/tx/${signature}${clusterSuffix}`;
};
