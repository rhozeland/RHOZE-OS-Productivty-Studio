/**
 * Decode Anchor / SPL / native Solana program errors into human-friendly
 * messages using the active Launchpad IDL's `errors[]` array.
 *
 * Recognises:
 *   - Anchor "AnchorError caused by account: X. Error Code: Y. Error Number: N. Error Message: M."
 *   - Anchor "Program log: AnchorError ... Error Code: SlippageExceeded. Error Number: 6001."
 *   - "custom program error: 0x1771" (hex error code from the program)
 *   - SystemProgram errors: "insufficient funds", "InsufficientFundsForRent", etc.
 *   - SPL Token errors: "0x1" (insufficient funds), etc.
 *   - JSON-encoded errors from `confirmTransaction`: {"InstructionError":[0,{"Custom":6001}]}
 *   - Wallet rejections, blockhash expiry, simulation failures.
 *
 * Returns a structured result so the UI can show:
 *   - title  (short, friendly)
 *   - detail (one-liner, Anchor msg if known)
 *   - code   (numeric code if extracted)
 *   - source ("anchor" | "system" | "spl" | "wallet" | "network" | "unknown")
 */
import type { Idl } from "@coral-xyz/anchor";
import { getCachedIdl } from "./launchpad-idl-store";

export type ErrorSource = "anchor" | "system" | "spl" | "wallet" | "network" | "unknown";

export interface DecodedTradeError {
  title: string;
  detail: string;
  code: number | null;
  name: string | null;
  source: ErrorSource;
  raw: string;
}

interface IdlErrorEntry {
  code: number;
  name: string;
  msg?: string;
}

const getIdlErrors = (): IdlErrorEntry[] => {
  const idl = getCachedIdl() as (Idl & { errors?: IdlErrorEntry[] }) | null;
  return Array.isArray(idl?.errors) ? (idl!.errors as IdlErrorEntry[]) : [];
};

const findIdlErrorByCode = (code: number): IdlErrorEntry | null =>
  getIdlErrors().find((e) => e.code === code) ?? null;

const findIdlErrorByName = (name: string): IdlErrorEntry | null => {
  const norm = name.toLowerCase().replace(/[_\s]/g, "");
  return getIdlErrors().find((e) => e.name.toLowerCase().replace(/[_\s]/g, "") === norm) ?? null;
};

// --- Wallet / network heuristics (run before code extraction) ---

const WALLET_PATTERNS: Array<{ test: RegExp; title: string; detail: string }> = [
  { test: /user rejected|user denied|wallet.*reject/i, title: "Signature rejected", detail: "You rejected the transaction in your wallet." },
  { test: /wallet not connected|no wallet/i, title: "Wallet not connected", detail: "Connect a Solana wallet to trade." },
];

const NETWORK_PATTERNS: Array<{ test: RegExp; title: string; detail: string }> = [
  { test: /blockhash not found|block height exceeded|expired/i, title: "Network congested", detail: "The blockhash expired before the trade landed. Retry — usually clears in a few seconds." },
  { test: /timed? ?out|timeout/i, title: "Confirmation timeout", detail: "The validator did not confirm in time. The transaction may still settle — refresh shortly." },
  { test: /failed to fetch|network ?error|ECONNRESET|503|504/i, title: "RPC unreachable", detail: "Couldn't reach the Solana RPC. Check your connection and retry." },
];

const SPL_PATTERNS: Array<{ test: RegExp; title: string; detail: string }> = [
  { test: /insufficient (funds|lamports)/i, title: "Not enough SOL", detail: "Your wallet doesn't have enough SOL for this trade plus network fees and rent." },
  { test: /TokenAccountNotFoundError|account does not exist/i, title: "Missing token account", detail: "The token account hasn't been created yet — try again, the program will initialize it." },
  { test: /AccountOwnedByWrongProgram/i, title: "Wrong account owner", detail: "An account passed to the program is owned by the wrong program." },
];

// --- Code extractors ---

const extractAnchorErrorNumber = (raw: string, logs: string[]): number | null => {
  // "Error Number: 6001"
  for (const text of [raw, ...logs]) {
    const m = text.match(/Error Number:\s*(\d+)/i);
    if (m) return parseInt(m[1], 10);
  }
  return null;
};

const extractAnchorErrorName = (raw: string, logs: string[]): string | null => {
  // "Error Code: SlippageExceeded"
  for (const text of [raw, ...logs]) {
    const m = text.match(/Error Code:\s*([A-Za-z0-9_]+)/);
    if (m) return m[1];
  }
  return null;
};

const extractCustomHex = (raw: string, logs: string[]): number | null => {
  // "custom program error: 0x1771"
  for (const text of [raw, ...logs]) {
    const m = text.match(/custom program error:\s*0x([0-9a-fA-F]+)/);
    if (m) return parseInt(m[1], 16);
  }
  return null;
};

const extractInstructionErrorCustom = (raw: string): number | null => {
  // {"InstructionError":[0,{"Custom":6001}]} — string or stringified JSON
  const m = raw.match(/"Custom"\s*:\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  return null;
};

const extractAnchorMsg = (raw: string, logs: string[]): string | null => {
  // "Error Message: Slippage tolerance exceeded."
  for (const text of [raw, ...logs]) {
    const m = text.match(/Error Message:\s*(.+?)(?:\n|$)/);
    if (m) return m[1].trim().replace(/\.$/, "");
  }
  return null;
};

// --- Public entry point ---

export const decodeTradeError = (raw: unknown, logs: string[] = []): DecodedTradeError => {
  const rawStr = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : JSON.stringify(raw);
  const haystack = [rawStr, ...logs];

  // 1. Wallet rejections take priority — no point decoding further.
  for (const p of WALLET_PATTERNS) {
    if (haystack.some((t) => p.test.test(t))) {
      return { title: p.title, detail: p.detail, code: null, name: null, source: "wallet", raw: rawStr };
    }
  }

  // 2. Anchor program error (richest signal: name + number + msg)
  const anchorName = extractAnchorErrorName(rawStr, logs);
  const anchorNumber = extractAnchorErrorNumber(rawStr, logs);
  const anchorMsg = extractAnchorMsg(rawStr, logs);

  if (anchorName || anchorNumber !== null) {
    const idlEntry =
      (anchorNumber !== null ? findIdlErrorByCode(anchorNumber) : null) ??
      (anchorName ? findIdlErrorByName(anchorName) : null);
    const name = idlEntry?.name ?? anchorName ?? null;
    const detail = idlEntry?.msg ?? anchorMsg ?? "Program rejected the trade.";
    return {
      title: humaniseName(name) ?? "Program error",
      detail,
      code: idlEntry?.code ?? anchorNumber,
      name,
      source: "anchor",
      raw: rawStr,
    };
  }

  // 3. Custom hex / Instruction custom — look up in IDL even without name.
  const custom = extractCustomHex(rawStr, logs) ?? extractInstructionErrorCustom(rawStr);
  if (custom !== null) {
    const entry = findIdlErrorByCode(custom);
    if (entry) {
      return {
        title: humaniseName(entry.name) ?? "Program error",
        detail: entry.msg ?? `Program error code ${custom}.`,
        code: entry.code,
        name: entry.name,
        source: "anchor",
        raw: rawStr,
      };
    }
    // Anchor reserves codes < 6000 for framework errors; >= 6000 are program-defined.
    return {
      title: custom >= 6000 ? "Program error" : "Anchor framework error",
      detail: `Program returned error code ${custom}${custom >= 6000 ? " (no IDL entry — paste the latest IDL in Settings)." : "."}`,
      code: custom,
      name: null,
      source: "anchor",
      raw: rawStr,
    };
  }

  // 4. SPL / system heuristics
  for (const p of SPL_PATTERNS) {
    if (haystack.some((t) => p.test.test(t))) {
      return { title: p.title, detail: p.detail, code: null, name: null, source: "spl", raw: rawStr };
    }
  }

  // 5. Network / RPC heuristics
  for (const p of NETWORK_PATTERNS) {
    if (haystack.some((t) => p.test.test(t))) {
      return { title: p.title, detail: p.detail, code: null, name: null, source: "network", raw: rawStr };
    }
  }

  // 6. Simulation failure with logs — extract the last "Program log:" line as
  // a hint, otherwise return the raw message.
  if (logs.length > 0) {
    const lastProgramLog = [...logs].reverse().find((l) => /Program log: /i.test(l));
    if (lastProgramLog) {
      return {
        title: "Trade reverted",
        detail: lastProgramLog.replace(/^Program log:\s*/i, "").trim(),
        code: null,
        name: null,
        source: "anchor",
        raw: rawStr,
      };
    }
  }

  return {
    title: "Trade failed",
    detail: rawStr.length > 200 ? rawStr.slice(0, 200) + "…" : rawStr,
    code: null,
    name: null,
    source: "unknown",
    raw: rawStr,
  };
};

// CamelCase / snake_case → "Camel Case" / "Snake Case"
const humaniseName = (name: string | null): string | null => {
  if (!name) return null;
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
};
