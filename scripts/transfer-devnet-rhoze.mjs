#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  transferChecked,
} from "@solana/spl-token";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const configPath = path.join(repoRoot, ".env.devnet.local");
const walletStatePath = path.join(repoRoot, "supabase/.temp/devnet-wallets.json");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${filePath}. Run the Devnet provisioning script first.`);
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line && !line.trimStart().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) {
          return null;
        }

        const key = line.slice(0, separator);
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        return [key, value];
      })
      .filter(Boolean),
  );
}

function parseArguments() {
  const args = process.argv.slice(2);
  const recipientIndex = args.indexOf("--recipient");
  const amountIndex = args.indexOf("--amount");

  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: npm run solana:transfer-devnet-rhoze -- --recipient PUBLIC_ADDRESS [--amount RHOZE]");
    process.exit(0);
  }

  const recipient = recipientIndex >= 0 ? args[recipientIndex + 1] : undefined;
  const amount = amountIndex >= 0 ? args[amountIndex + 1] : "1000";

  if (!recipient || recipient.startsWith("--")) {
    fail("Provide a Phantom public address with --recipient.");
  }

  if (!/^\d+(?:\.\d+)?$/.test(amount) || Number(amount) <= 0) {
    fail("--amount must be a positive decimal number.");
  }

  return { recipient, amount };
}

const { recipient: recipientAddress, amount: amountText } = parseArguments();
const config = readEnvFile(configPath);

if (config.VITE_SOLANA_ENV !== "devnet") {
  fail("The generated frontend configuration is not set to devnet.");
}

if (config.VITE_SOLANA_RPC_URL?.toLowerCase().includes("mainnet")) {
  fail("Refusing to use a mainnet RPC URL.");
}

if (!fs.existsSync(walletStatePath)) {
  fail(`Missing ${walletStatePath}. Run the Devnet provisioning script first.`);
}

const walletState = JSON.parse(fs.readFileSync(walletStatePath, "utf8"));
const payerSecretKey = walletState?.payer?.secretKey;
if (!Array.isArray(payerSecretKey) || payerSecretKey.length !== 64) {
  fail(`Invalid payer key in ${walletStatePath}.`);
}

const decimals = Number(config.VITE_SOLANA_RHOZE_DECIMALS);
if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
  fail("The generated RHOZE decimals configuration is invalid.");
}

let recipient;
let mint;
try {
  recipient = new PublicKey(recipientAddress);
  mint = new PublicKey(config.VITE_SOLANA_RHOZE_MINT);
} catch {
  fail("The recipient address or configured mint address is invalid.");
}

const amountParts = amountText.split(".");
const fractionalPart = (amountParts[1] || "").padEnd(decimals, "0");
if (fractionalPart.length > decimals) {
  fail(`--amount supports at most ${decimals} decimal places.`);
}
const amountInBaseUnits =
  BigInt(amountParts[0]) * 10n ** BigInt(decimals) +
  BigInt(fractionalPart || "0");

const connection = new Connection(config.VITE_SOLANA_RPC_URL, "confirmed");
const payer = Keypair.fromSecretKey(Uint8Array.from(payerSecretKey));

try {
  const sourceAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
  const destinationAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    recipient,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
  const payerBalance = await getAccount(
    connection,
    sourceAta.address,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );

  if (BigInt(payerBalance.amount) < amountInBaseUnits) {
    fail(`Payer does not have ${amountText} RHOZE available.`);
  }

  const signature = await transferChecked(
    connection,
    payer,
    sourceAta.address,
    mint,
    destinationAta.address,
    payer.publicKey,
    amountInBaseUnits,
    decimals,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  console.log(`Transferred ${amountText} RHOZE to ${recipientAddress}.`);
  console.log(`Mint: ${mint.toBase58()}`);
  console.log(`Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
