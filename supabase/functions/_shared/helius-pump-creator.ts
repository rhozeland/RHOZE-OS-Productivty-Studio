const HELIUS_SCAN_URL =
  "https://mainnet.helius-rpc.com/v1/parsed-events/scan";
const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const CREATE_INSTRUCTIONS = new Set(["create", "create_v2"]);

type CreatorLookupErrorCode =
  | "not_found"
  | "incomplete"
  | "invalid_response"
  | "unavailable";

export class CreatorLookupError extends Error {
  constructor(readonly code: CreatorLookupErrorCode, message: string) {
    super(message);
    this.name = "CreatorLookupError";
  }
}

type ParsedInstruction = {
  programId?: unknown;
  instructionName?: unknown;
  decoded?: {
    args?: Record<string, unknown>;
    accounts?: ParsedAccount[];
  };
};

type ParsedAccount = { name?: unknown; pubkey?: unknown };

type ParsedTransactionResult = {
  parserStatus?: unknown;
  parsed?: {
    transactionStatus?: unknown;
    instructions?: ParsedInstruction[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAccount(
  accounts: ParsedAccount[] | undefined,
  name: string,
): string | null {
  if (!Array.isArray(accounts)) return null;
  const account = accounts.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.name === name &&
      typeof candidate.pubkey === "string",
  );
  return account && typeof account.pubkey === "string" ? account.pubkey : null;
}

function getInstructionMint(instruction: ParsedInstruction): string | null {
  const mint = getAccount(instruction.decoded?.accounts, "mint");
  return mint;
}

function getInstructionCreator(instruction: ParsedInstruction): string | null {
  const args = instruction.decoded?.args;
  const creatorArg = args?.creator;
  if (typeof creatorArg === "string") return creatorArg;

  return getAccount(instruction.decoded?.accounts, "creator") ??
    getAccount(instruction.decoded?.accounts, "user");
}

function extractCreatorWallet(
  data: unknown,
  mintAddress: string,
): string | null {
  if (!Array.isArray(data)) {
    throw new CreatorLookupError(
      "invalid_response",
      "Helius returned an invalid scan result.",
    );
  }

  const creatorWallets = new Set<string>();
  for (const resultValue of data) {
    if (!isRecord(resultValue)) {
      throw new CreatorLookupError(
        "invalid_response",
        "Helius returned an invalid transaction result.",
      );
    }

    const result = resultValue as ParsedTransactionResult;
    if (result.parserStatus !== "OK" || result.parsed?.transactionStatus !== "OK") {
      throw new CreatorLookupError(
        "invalid_response",
        "Helius could not verify a Pump.fun creation transaction.",
      );
    }

    if (!Array.isArray(result.parsed.instructions)) {
      throw new CreatorLookupError(
        "invalid_response",
        "Helius returned no decoded transaction instructions.",
      );
    }

    for (const instructionValue of result.parsed.instructions) {
      if (!isRecord(instructionValue)) {
        throw new CreatorLookupError(
          "invalid_response",
          "Helius returned an invalid decoded instruction.",
        );
      }
      const instruction = instructionValue as ParsedInstruction;
      if (
        instruction.programId !== PUMP_PROGRAM_ID ||
        typeof instruction.instructionName !== "string" ||
        !CREATE_INSTRUCTIONS.has(instruction.instructionName) ||
        getInstructionMint(instruction) !== mintAddress
      ) {
        continue;
      }

      const creator = getInstructionCreator(instruction);
      if (!creator) {
        throw new CreatorLookupError(
          "invalid_response",
          "Helius did not identify the creator in the Pump.fun creation instruction.",
        );
      }
      creatorWallets.add(creator);
    }
  }

  if (creatorWallets.size > 1) {
    throw new CreatorLookupError(
      "invalid_response",
      "Helius returned conflicting creator wallets for this mint.",
    );
  }
  return creatorWallets.values().next().value ?? null;
}

export async function getHeliusPumpCreatorWallet(
  mintAddress: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const url = new URL(HELIUS_SCAN_URL);
  url.searchParams.set("api-key", apiKey);

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: mintAddress,
        match: {
          programs: [{
            programId: PUMP_PROGRAM_ID,
            instructions: [...CREATE_INSTRUCTIONS],
          }],
        },
        sortOrder: "asc",
        limit: 1,
        budget: { maxScannedTransactions: 10_000 },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new CreatorLookupError(
      "unavailable",
      error instanceof Error ? error.message : "Helius request failed.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new CreatorLookupError(
      "unavailable",
      `Helius returned HTTP ${response.status}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CreatorLookupError(
      "invalid_response",
      "Helius returned invalid JSON.",
    );
  }

  if (!isRecord(payload) || !isRecord(payload.scan)) {
    throw new CreatorLookupError(
      "invalid_response",
      "Helius returned an incomplete scan result.",
    );
  }

  const creatorWallet = extractCreatorWallet(payload.data, mintAddress);
  if (creatorWallet) return creatorWallet;

  if (payload.scan.stoppedOn !== "windowEnd" || payload.paginationToken) {
    throw new CreatorLookupError(
      "incomplete",
      "Helius did not finish searching this mint's creation history.",
    );
  }

  throw new CreatorLookupError(
    "not_found",
    "Helius found no successful Pump.fun creation transaction for this mint.",
  );
}
