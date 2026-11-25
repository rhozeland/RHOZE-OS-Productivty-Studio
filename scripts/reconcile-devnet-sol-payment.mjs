#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localEnvPath = path.join(repoRoot, ".env.development.local");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${filePath}.`);
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line && !line.trimStart().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) return null;
        const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
        return [line.slice(0, separator), value];
      })
      .filter(Boolean),
  );
}

function parseArguments() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: npm run solana:reconcile-devnet -- --signature SIGNATURE [--signature SIGNATURE ...] [--expected-sol AMOUNT]",
    );
    console.log("Set SUPABASE_USER_ACCESS_TOKEN locally to your authenticated app session token.");
    process.exit(0);
  }

  const signatures = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--signature") {
      const signature = args[index + 1];
      if (!signature || signature.startsWith("--")) fail("--signature requires a transaction signature.");
      else signatures.push(signature);
    }
  }

  const amountIndex = args.indexOf("--expected-sol");
  const expectedSol = amountIndex >= 0 ? args[amountIndex + 1] : "0.4";
  if (amountIndex >= 0 && (!expectedSol || expectedSol.startsWith("--"))) {
    fail("--expected-sol requires a positive amount.");
  }
  if (!/^\d+(?:\.\d+)?$/.test(expectedSol) || Number(expectedSol) <= 0) {
    fail("--expected-sol must be a positive decimal number.");
  }
  if (signatures.length === 0) fail("Provide at least one --signature.");

  return { signatures, expectedSol: Number(expectedSol) };
}

const { signatures, expectedSol } = parseArguments();
const env = { ...readEnvFile(localEnvPath), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const accessToken = env.SUPABASE_USER_ACCESS_TOKEN;

if (!supabaseUrl || !publishableKey) {
  fail(`Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in ${localEnvPath}.`);
}
if (!accessToken) {
  fail("Set SUPABASE_USER_ACCESS_TOKEN to a valid authenticated Dev app session token.");
}

const endpoint = `${supabaseUrl}/functions/v1/verify-sol-payment`;
for (const signature of signatures) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) {
    console.error(`Skipped invalid Solana signature: ${signature}`);
    process.exitCode = 1;
    continue;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signature,
        expected_sol: expectedSol,
        description: "Devnet SOL payment reconciliation",
        type: "purchase",
        intent: "credits",
      }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`${signature}: ${body.error || `HTTP ${response.status}`}`);
      process.exitCode = 1;
      continue;
    }

    console.log(
      `${signature}: reconciled (${body.sol_received} SOL, ${body.credits_added} credits added)`,
    );
  } catch (error) {
    console.error(`${signature}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
