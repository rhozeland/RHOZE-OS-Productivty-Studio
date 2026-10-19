import { PublicKey, clusterApiUrl } from "@solana/web3.js";

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

export interface SolanaConfigInput {
  environment?: string;
  rpcUrl?: string;
  rhozeMint?: string;
  tokenProgramId?: string;
  rhozeDecimals?: string | number;
  treasuryAddress?: string;
  payoutAddress?: string;
  paymentsEnabled?: string | boolean;
  claimsEnabled?: string | boolean;
  anchoringEnabled?: string | boolean;
}

export interface SolanaConnectionConfig {
  environment: SolanaEnvironment;
  cluster: SolanaCluster;
  rpcUrl: string;
}

export class SolanaConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid Solana configuration: ${issues.join("; ")}`);
    this.name = "SolanaConfigError";
    this.issues = issues;
  }
}

const PRODUCTION_ENVIRONMENT: SolanaEnvironment = "mainnet";

const isSolanaEnvironment = (
  value: string | undefined,
): value is SolanaEnvironment =>
  value === "devnet" || value === PRODUCTION_ENVIRONMENT;

const parseBoolean = (
  value: string | boolean | undefined,
  defaultValue: boolean,
): boolean => {
  if (typeof value === "boolean") return value;
  if (value === undefined || value.trim() === "") return defaultValue;
  return value.toLowerCase() === "true";
};

const parsePublicKey = (
  value: string | undefined,
  fieldName: string,
  issues: string[],
): string => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    issues.push(`${fieldName} is required`);
    return "";
  }

  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    issues.push(`${fieldName} must be a valid Solana public key`);
    return trimmed;
  }
};

const defaultEnvironment = (mode: string): SolanaEnvironment | undefined =>
  mode === "production" ? undefined : "devnet";

export const resolveSolanaConnectionConfig = (
  input: Pick<SolanaConfigInput, "environment" | "rpcUrl">,
  mode = "development",
): SolanaConnectionConfig => {
  const issues: string[] = [];
  const environment = input.environment?.trim() || defaultEnvironment(mode);

  if (!isSolanaEnvironment(environment)) {
    issues.push(
      `environment must be "devnet" or "mainnet"${
        mode === "production" ? " and must be explicitly set in production" : ""
      }`,
    );
  }

  const resolvedEnvironment = isSolanaEnvironment(environment)
    ? environment
    : "devnet";
  const cluster: SolanaCluster =
    resolvedEnvironment === PRODUCTION_ENVIRONMENT ? "mainnet-beta" : "devnet";
  const rpcUrl = input.rpcUrl?.trim() || clusterApiUrl(cluster);

  if (resolvedEnvironment === "devnet" && rpcUrl.includes("mainnet")) {
    issues.push("devnet cannot use a mainnet RPC URL");
  }
  if (resolvedEnvironment === PRODUCTION_ENVIRONMENT && !input.rpcUrl?.trim()) {
    issues.push("mainnet requires an explicit rpcUrl");
  }

  if (issues.length > 0) {
    throw new SolanaConfigError(issues);
  }

  return { environment: resolvedEnvironment, cluster, rpcUrl };
};

export const resolveSolanaConfig = (
  input: SolanaConfigInput,
  mode = "development",
): SolanaConfig => {
  const connectionConfig = resolveSolanaConnectionConfig(input, mode);
  const issues: string[] = [];
  const { environment: resolvedEnvironment, cluster, rpcUrl } = connectionConfig;

  const rhozeMint = parsePublicKey(input.rhozeMint, "rhozeMint", issues);
  const tokenProgramId = parsePublicKey(
    input.tokenProgramId,
    "tokenProgramId",
    issues,
  );
  const treasuryAddress = parsePublicKey(
    input.treasuryAddress,
    "treasuryAddress",
    issues,
  );
  const payoutAddress = parsePublicKey(
    input.payoutAddress,
    "payoutAddress",
    issues,
  );

  const rhozeDecimals = Number(input.rhozeDecimals ?? 6);
  if (
    !Number.isInteger(rhozeDecimals) ||
    rhozeDecimals < 0 ||
    rhozeDecimals > 18
  ) {
    issues.push("rhozeDecimals must be an integer between 0 and 18");
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
    paymentsEnabled: parseBoolean(input.paymentsEnabled, false),
    claimsEnabled: parseBoolean(input.claimsEnabled, false),
    anchoringEnabled: parseBoolean(input.anchoringEnabled, false),
  };
};

export const getSolanaConfig = (): SolanaConfig =>
  resolveSolanaConfig(
    {
      environment: import.meta.env.VITE_SOLANA_ENV,
      rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL,
      rhozeMint: import.meta.env.VITE_SOLANA_RHOZE_MINT,
      tokenProgramId: import.meta.env.VITE_SOLANA_TOKEN_PROGRAM_ID,
      rhozeDecimals: import.meta.env.VITE_SOLANA_RHOZE_DECIMALS,
      treasuryAddress: import.meta.env.VITE_SOLANA_TREASURY_WALLET,
      payoutAddress: import.meta.env.VITE_SOLANA_PAYOUT_WALLET,
      paymentsEnabled: import.meta.env.VITE_SOLANA_PAYMENTS_ENABLED,
      claimsEnabled: import.meta.env.VITE_SOLANA_CLAIMS_ENABLED,
      anchoringEnabled: import.meta.env.VITE_SOLANA_ANCHORING_ENABLED,
    },
    import.meta.env.MODE,
  );

export const getSolanaConnectionConfig = (): SolanaConnectionConfig =>
  resolveSolanaConnectionConfig(
    {
      environment: import.meta.env.VITE_SOLANA_ENV,
      rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL,
    },
    import.meta.env.MODE,
  );
