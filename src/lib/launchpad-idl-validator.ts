/**
 * Launchpad IDL validator — structured checks against the Anchor IDL we
 * expect for the Rhozeland Launchpad program. Returns granular issues so
 * the UI can highlight precisely which required fields are missing or
 * malformed before flipping into on-chain trading mode.
 *
 * Required for on-chain trading:
 *   - `address`            (program ID baked into the IDL — Anchor 0.30+)
 *   - `instructions[]`     with at least one of buy/sell/create_launch
 *   - `accounts[]`         (PDA layouts the client decodes)
 *
 * Recommended (warnings, not blockers):
 *   - `metadata.name` / `metadata.version`
 *   - `events[]`           (TradeExecuted, LaunchCreated, Graduated)
 *   - `errors[]`           (so decodeError can surface friendly messages)
 */

export type IdlIssueSeverity = "error" | "warning";

export interface IdlIssue {
  severity: IdlIssueSeverity;
  field: string;
  message: string;
}

export interface IdlValidationResult {
  ok: boolean;             // true ⇒ safe to enable on-chain trading
  parsed: unknown | null;  // null when JSON parse failed
  issues: IdlIssue[];
  summary: {
    address: string | null;
    instructionCount: number;
    accountCount: number;
    eventCount: number;
    errorCount: number;
    foundIxAliases: string[]; // matched aliases for buy/sell/create
  };
}

const IX_ALIASES: Record<string, string[]> = {
  create_launch: ["create_launch", "createLaunch", "initialize_launch", "initializeLaunch"],
  buy: ["buy", "buy_tokens", "buyTokens", "swap_in", "swapIn"],
  sell: ["sell", "sell_tokens", "sellTokens", "swap_out", "swapOut"],
};

const normaliseName = (s: string) => s.toLowerCase().replace(/_/g, "");

const findAlias = (instructions: Array<{ name?: unknown }>, aliases: string[]): string | null => {
  const wanted = new Set(aliases.map(normaliseName));
  for (const ix of instructions) {
    if (typeof ix?.name === "string" && wanted.has(normaliseName(ix.name))) return ix.name;
  }
  return null;
};

const isBase58Like = (s: string): boolean => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

export const validateLaunchpadIdl = (raw: string | unknown): IdlValidationResult => {
  const issues: IdlIssue[] = [];
  let parsed: Record<string, unknown> | null = null;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {
        ok: false,
        parsed: null,
        issues: [{ severity: "error", field: "(root)", message: "IDL is empty." }],
        summary: { address: null, instructionCount: 0, accountCount: 0, eventCount: 0, errorCount: 0, foundIxAliases: [] },
      };
    }
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch (e) {
      return {
        ok: false,
        parsed: null,
        issues: [
          {
            severity: "error",
            field: "(root)",
            message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        summary: { address: null, instructionCount: 0, accountCount: 0, eventCount: 0, errorCount: 0, foundIxAliases: [] },
      };
    }
  } else if (raw && typeof raw === "object") {
    parsed = raw as Record<string, unknown>;
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      parsed: null,
      issues: [{ severity: "error", field: "(root)", message: "IDL must be a JSON object." }],
      summary: { address: null, instructionCount: 0, accountCount: 0, eventCount: 0, errorCount: 0, foundIxAliases: [] },
    };
  }

  // address (Anchor 0.30+)
  const address = typeof parsed.address === "string" ? parsed.address.trim() : null;
  if (!address) {
    issues.push({
      severity: "error",
      field: "address",
      message: "Missing top-level `address` (program ID). Required by Anchor 0.30+.",
    });
  } else if (!isBase58Like(address)) {
    issues.push({
      severity: "error",
      field: "address",
      message: "`address` is not a valid base58 program ID.",
    });
  }

  // instructions
  const instructionsRaw = parsed.instructions;
  let instructions: Array<{ name?: unknown }> = [];
  if (!Array.isArray(instructionsRaw)) {
    issues.push({
      severity: "error",
      field: "instructions",
      message: "Missing `instructions` array.",
    });
  } else {
    instructions = instructionsRaw as Array<{ name?: unknown }>;
    if (instructions.length === 0) {
      issues.push({
        severity: "error",
        field: "instructions",
        message: "`instructions` array is empty.",
      });
    }
  }

  const foundAliases: string[] = [];
  for (const [canon, aliases] of Object.entries(IX_ALIASES)) {
    const match = findAlias(instructions, aliases);
    if (match) {
      foundAliases.push(`${canon} → ${match}`);
    } else {
      issues.push({
        severity: "error",
        field: `instructions.${canon}`,
        message: `No instruction matching \`${canon}\` (aliases: ${aliases.join(", ")}).`,
      });
    }
  }

  // accounts
  const accountsRaw = parsed.accounts;
  let accountCount = 0;
  if (!Array.isArray(accountsRaw)) {
    issues.push({
      severity: "error",
      field: "accounts",
      message: "Missing `accounts` array (PDA layouts the client decodes).",
    });
  } else {
    accountCount = accountsRaw.length;
    if (accountCount === 0) {
      issues.push({
        severity: "warning",
        field: "accounts",
        message: "`accounts` array is empty — client cannot decode PDAs.",
      });
    }
  }

  // events / errors / metadata — warnings only
  const eventsRaw = parsed.events;
  const eventCount = Array.isArray(eventsRaw) ? eventsRaw.length : 0;
  if (!Array.isArray(eventsRaw)) {
    issues.push({
      severity: "warning",
      field: "events",
      message: "No `events` array — trade confirmations won't surface event data.",
    });
  }

  const errorsRaw = parsed.errors;
  const errorCount = Array.isArray(errorsRaw) ? errorsRaw.length : 0;
  if (!Array.isArray(errorsRaw)) {
    issues.push({
      severity: "warning",
      field: "errors",
      message: "No `errors` array — failed trades will show raw program logs.",
    });
  }

  const metadata = parsed.metadata as { name?: unknown; version?: unknown } | undefined;
  if (!metadata || typeof metadata !== "object") {
    issues.push({
      severity: "warning",
      field: "metadata",
      message: "Missing `metadata` block (name/version).",
    });
  }

  const ok = issues.every((i) => i.severity !== "error");

  return {
    ok,
    parsed,
    issues,
    summary: {
      address,
      instructionCount: instructions.length,
      accountCount,
      eventCount,
      errorCount,
      foundIxAliases: foundAliases,
    },
  };
};
