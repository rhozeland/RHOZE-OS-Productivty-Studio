#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  getAssociatedTokenAddress,
  mintTo,
} from "@solana/spl-token";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const defaultRpcUrl = "https://api.devnet.solana.com";
const intendedDevnetEnv = process.env.SOLANA_ENV || "devnet";
const rpcUrl = process.env.SOLANA_DEVNET_RPC_URL || process.env.SOLANA_RPC_URL || defaultRpcUrl;
const decimals = Number(process.env.SOLANA_RHOZE_DECIMALS || "6");
const walletStatePath = path.join(repoRoot, "supabase/.temp/devnet-wallets.json");
const minimumBalanceSol = Number(process.env.SOLANA_DEVNET_MIN_BALANCE_SOL || "0.5");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (intendedDevnetEnv === "mainnet") {
  fail("Refusing to provision Devnet assets while SOLANA_ENV=mainnet");
}

if (rpcUrl.includes("mainnet")) {
  fail(`Refusing to use a mainnet RPC URL for Devnet provisioning: ${rpcUrl}`);
}

if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
  fail("SOLANA_RHOZE_DECIMALS must be an integer between 0 and 18");
}

if (!Number.isFinite(minimumBalanceSol) || minimumBalanceSol <= 0) {
  fail("SOLANA_DEVNET_MIN_BALANCE_SOL must be a positive number");
}

const connection = new Connection(rpcUrl, "confirmed");

const loadOrCreateWallet = (label) => {
  if (!fs.existsSync(walletStatePath)) {
    return Keypair.generate();
  }

  const state = JSON.parse(fs.readFileSync(walletStatePath, "utf8"));
  const secretKey = state?.[label]?.secretKey;
  if (!Array.isArray(secretKey) || secretKey.length !== 64) {
    fail(`Invalid ${walletStatePath}: expected a 64-byte ${label} secret key`);
  }

  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
};

const payer = loadOrCreateWallet("payer");
const treasury = loadOrCreateWallet("treasury");
const payout = loadOrCreateWallet("payout");

const persistWalletState = () => {
  fs.mkdirSync(path.dirname(walletStatePath), { recursive: true });
  const state = {
    createdAt: new Date().toISOString(),
    network: "devnet",
    payer: {
      publicKey: payer.publicKey.toBase58(),
      secretKey: Array.from(payer.secretKey),
    },
    treasury: {
      publicKey: treasury.publicKey.toBase58(),
      secretKey: Array.from(treasury.secretKey),
    },
    payout: {
      publicKey: payout.publicKey.toBase58(),
      secretKey: Array.from(payout.secretKey),
    },
  };
  fs.writeFileSync(walletStatePath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(walletStatePath, 0o600);
};

const getBalances = async () => {
  const wallets = [
    ["payer", payer],
    ["treasury", treasury],
    ["payout", payout],
  ];
  return Promise.all(
    wallets.map(async ([label, wallet]) => ({
      label,
      wallet,
      balance: await connection.getBalance(wallet.publicKey),
    })),
  );
};

const requireFunding = async () => {
  const minimumLamports = minimumBalanceSol * LAMPORTS_PER_SOL;
  const balances = await getBalances();
  const unfunded = balances.filter(({ balance }) => balance < minimumLamports);

  if (unfunded.length === 0) {
    for (const { label, balance } of balances) {
      console.log(`${label} has ${balance / LAMPORTS_PER_SOL} Devnet SOL`);
    }
    return true;
  }

  console.log("\nThe project wallets need Devnet SOL before provisioning can continue.");
  for (const { label, wallet, balance } of unfunded) {
    const shortfall = Math.max(0, minimumLamports - balance) / LAMPORTS_PER_SOL;
    console.log(`- ${label}: ${wallet.publicKey.toBase58()} (${balance / LAMPORTS_PER_SOL} SOL; needs about ${shortfall} more)`);
  }
  console.log("\nFrom your funded Phantom Devnet wallet, send at least");
  console.log(`${minimumBalanceSol} SOL to each address above.`);
  console.log(`Wallet state saved locally at ${walletStatePath}`);
  console.log("Run this same command again after the transfers confirm.");
  return false;
};

const logStatus = (message) => console.log(message);

try {
  logStatus("Provisioning a dedicated Solana Devnet wallet set...");
  persistWalletState();

  if (!(await requireFunding())) {
    process.exit(2);
  }

  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    decimals,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  const payerAta = await createAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  const treasuryAta = await createAssociatedTokenAccount(
    connection,
    payer,
    mint,
    treasury.publicKey,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  const payoutAta = await createAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payout.publicKey,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  const initialTokenSupply = 1_000_000n * 10n ** BigInt(decimals);
  await mintTo(
    connection,
    payer,
    mint,
    payerAta,
    payer.publicKey,
    initialTokenSupply,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  await mintTo(
    connection,
    payer,
    mint,
    treasuryAta,
    payer.publicKey,
    initialTokenSupply / 10n,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  await mintTo(
    connection,
    payer,
    mint,
    payoutAta,
    payer.publicKey,
    initialTokenSupply / 10n,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  const mintAddress = new PublicKey(mint).toBase58();
  const treasuryAddress = treasury.publicKey.toBase58();
  const payoutAddress = payout.publicKey.toBase58();
  const tokenProgramId = TOKEN_2022_PROGRAM_ID.toBase58();

  const frontendConfig = [
    'VITE_SOLANA_ENV="devnet"',
    `VITE_SOLANA_RPC_URL="${rpcUrl}"`,
    `VITE_SOLANA_RHOZE_MINT="${mintAddress}"`,
    `VITE_SOLANA_TOKEN_PROGRAM_ID="${tokenProgramId}"`,
    `VITE_SOLANA_RHOZE_DECIMALS="${decimals}"`,
    `VITE_SOLANA_TREASURY_WALLET="${treasuryAddress}"`,
    `VITE_SOLANA_PAYOUT_WALLET="${payoutAddress}"`,
    'VITE_SOLANA_SOL_PAYMENTS_ENABLED="false"',
    'VITE_SOLANA_RHOZE_PAYMENTS_ENABLED="false"',
    'VITE_SOLANA_PAYMENTS_ENABLED="false"',
    'VITE_SOLANA_CLAIMS_ENABLED="false"',
    'VITE_SOLANA_ANCHORING_ENABLED="false"',
    '',
  ].join("\n");

  const serverConfig = [
    "SOLANA_ENV=devnet",
    `SOLANA_RPC_URL=${rpcUrl}`,
    `SOLANA_RHOZE_MINT=${mintAddress}`,
    `SOLANA_TOKEN_PROGRAM_ID=${tokenProgramId}`,
    `SOLANA_RHOZE_DECIMALS=${decimals}`,
    `SOLANA_TREASURY_WALLET=${treasuryAddress}`,
    `SOLANA_PAYOUT_WALLET=${payoutAddress}`,
    `RHOZE_AIRDROP_PRIVATE_KEY=${Buffer.from(JSON.stringify(Array.from(payout.secretKey))).toString("base64")}`,
    "SOLANA_SOL_PAYMENTS_ENABLED=false",
    "SOLANA_RHOZE_PAYMENTS_ENABLED=false",
    "SOLANA_PAYMENTS_ENABLED=false",
    "SOLANA_CLAIMS_ENABLED=false",
    "SOLANA_ANCHORING_ENABLED=false",
    '',
  ].join("\n");

  const localEnvPath = path.join(repoRoot, ".env.devnet.local");
  const secretsPath = path.join(repoRoot, "supabase/.temp/devnet-secrets.env");

  fs.writeFileSync(localEnvPath, frontendConfig, "utf8");
  fs.writeFileSync(secretsPath, serverConfig, "utf8");

  console.log("\nDevnet configuration generated.");
  console.log(`Frontend config: ${localEnvPath}`);
  console.log(`Edge function secrets: ${secretsPath}`);
  console.log("\nGenerated identities:");
  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  console.log(`Treasury: ${treasuryAddress}`);
  console.log(`Payout: ${payoutAddress}`);
  console.log(`Mint: ${mintAddress}`);
  console.log(`Token program: ${tokenProgramId}`);
  console.log(`Wallet state: ${walletStatePath}`);
  console.log("\nSafety note: keep the generated private key in server-side secrets only; do not expose it in VITE_* variables.");
} catch (error) {
  console.error(error);
  fail(`Devnet provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
}
