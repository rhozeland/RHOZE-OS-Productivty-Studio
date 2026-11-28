import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const RUN_FLAG = "RUN_CREATOR_TOKEN_MINT_UNIQUENESS_INTEGRATION";
const MIGRATION_VERSION = "20261127120000";
const APPROVED_INDEX = "creator_tokens_one_approved_per_mint";
const ACCOUNT_MINT_CONSTRAINT = "creator_tokens_one_mint_per_user";
const PRIMARY_INDEX = "creator_tokens_one_primary_per_user";
const describeLocalIntegration = process.env[RUN_FLAG] === "1" ? describe : describe.skip;

type TokenStatus = "pending" | "approved" | "rejected";
type PostgresError = Error & { code?: string; constraint?: string };

const getLocalDatabaseUrl = (): string => {
  let statusOutput: string;
  try {
    const command = process.platform === "win32"
      ? process.env.ComSpec ?? process.env.COMSPEC ?? "cmd.exe"
      : "npx";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npx.cmd --no-install supabase status --output env"]
      : ["--no-install", "supabase", "status", "--output", "env"];
    statusOutput = execFileSync(command, args, {
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Could not read local Supabase CLI status; start the local stack before running this suite.");
  }

  const dbUrlLine = statusOutput.split(/\r?\n/).find((line) => line.startsWith("DB_URL="));
  const connectionString = dbUrlLine?.slice("DB_URL=".length).trim().replace(/^["']|["']$/g, "");
  if (!connectionString) throw new Error("Supabase CLI status did not provide a local DB_URL.");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error("Supabase CLI returned an invalid local database URL.");
  }

  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
    !["127.0.0.1", "localhost", "::1"].includes(hostname) ||
    parsedUrl.pathname !== "/postgres"
  ) {
    throw new Error("This local database suite only connects to the loopback Supabase database.");
  }

  return connectionString;
};

describeLocalIntegration("creator-token mint uniqueness database regressions", () => {
  let client: Client;
  let connectionString: string;
  let clientConnected = false;
  let transactionOpen = false;

  const createClient = (): Client =>
    new Client({ connectionString, connectionTimeoutMillis: 5_000, query_timeout: 10_000 });

  beforeAll(async () => {
    connectionString = getLocalDatabaseUrl();
    client = createClient();
    await client.connect();
    clientConnected = true;

    const migration = await client.query<{ applied: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM supabase_migrations.schema_migrations
          WHERE version = $1
       ) AS applied`,
      [MIGRATION_VERSION],
    );
    if (!migration.rows[0]?.applied) {
      throw new Error(`Local Supabase is missing migration ${MIGRATION_VERSION}; apply local migrations first.`);
    }

    const uniqueness = await client.query<{
      approved_unique: boolean;
      approved_valid: boolean;
      approved_predicate: string | null;
      account_unique: boolean;
      account_validated: boolean;
      primary_unique: boolean;
      old_global_constraint: boolean;
    }>(
      `SELECT
         approved.indisunique AS approved_unique,
         approved.indisvalid AS approved_valid,
         pg_get_expr(approved.indpred, approved.indrelid) AS approved_predicate,
         account.conindid IS NOT NULL AS account_unique,
         account.convalidated AS account_validated,
         primary_index.indisunique AS primary_unique,
         old_constraint.oid IS NOT NULL AS old_global_constraint
       FROM pg_index AS approved
       JOIN pg_class AS approved_class ON approved_class.oid = approved.indexrelid
       LEFT JOIN pg_constraint AS account
         ON account.conrelid = 'public.creator_tokens'::regclass
        AND account.conname = $1
        AND account.contype = 'u'
       JOIN pg_index AS primary_index
         ON primary_index.indrelid = 'public.creator_tokens'::regclass
       JOIN pg_class AS primary_class
         ON primary_class.oid = primary_index.indexrelid
        AND primary_class.relname = $2
       LEFT JOIN pg_constraint AS old_constraint
         ON old_constraint.conrelid = 'public.creator_tokens'::regclass
        AND old_constraint.conname = 'creator_tokens_mint_address_key'
        AND old_constraint.contype = 'u'
       WHERE approved.indrelid = 'public.creator_tokens'::regclass
         AND approved_class.relname = $3
         AND primary_index.indisvalid`,
      [ACCOUNT_MINT_CONSTRAINT, PRIMARY_INDEX, APPROVED_INDEX],
    );
    const schema = uniqueness.rows[0];
    if (
      !schema?.approved_unique || !schema.approved_valid ||
      !schema.approved_predicate?.includes("status = 'approved'") ||
      !schema.account_unique || !schema.account_validated ||
      !schema.primary_unique || schema.old_global_constraint
    ) {
      throw new Error("The local creator_tokens uniqueness schema does not match the Task #158 migration.");
    }
  }, 20_000);

  beforeEach(async () => {
    if (!clientConnected) {
      try {
        await client.connect();
        clientConnected = true;
      } catch (error) {
        client = createClient();
        throw error;
      }
    }
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '10s'");
  });

  afterEach(async ({ task }) => {
    if (!transactionOpen) return;
    transactionOpen = false;

    try {
      await client.query("ROLLBACK");
    } catch (error) {
      const unsafeClient = client;
      client = createClient();
      clientConnected = false;

      let closeError: unknown;
      try {
        const disconnect = unsafeClient.end();
        unsafeClient.connection.stream.destroy();
        await disconnect;
      } catch (connectionError) {
        unsafeClient.connection.stream.destroy();
        closeError = connectionError;
      }

      const closeDetails = closeError ? `; discarded connection close failed: ${String(closeError)}` : "";
      const cleanupFailure = `Integration transaction rollback failed: ${String(error)}${closeDetails}`;
      if (task.result?.state === "fail") {
        console.error(cleanupFailure);
      } else {
        throw new Error(cleanupFailure, { cause: closeError ?? error });
      }
    }
  });

  afterAll(async () => {
    if (clientConnected) await client.end();
  });

  const createAccount = async (): Promise<string> => {
    const userId = randomUUID();
    await client.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [
      userId,
      `creator-token-uniqueness-${randomUUID()}@integration.test`,
    ]);
    return userId;
  };

  const createToken = async (
    userId: string,
    mintAddress: string,
    status: TokenStatus,
    isPrimary = false,
  ): Promise<string> => {
    const tokenId = randomUUID();
    await client.query(
      `INSERT INTO public.creator_tokens (id, user_id, mint_address, ticker, name, status, is_primary)
       VALUES ($1, $2, $3, 'TEST', 'Mint uniqueness fixture', $4, $5)`,
      [tokenId, userId, mintAddress, status, isPrimary],
    );
    return tokenId;
  };

  const createPendingTokenAsAuthenticatedUser = async (userId: string, mintAddress: string): Promise<string> => {
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("SELECT set_config('request.jwt.claim.role', 'authenticated', true)");
    await client.query("SET LOCAL ROLE authenticated");

    const identity = await client.query<{ role: string; user_id: string }>(
      "SELECT current_user AS role, auth.uid() AS user_id",
    );
    expect(identity.rows[0]).toEqual({ role: "authenticated", user_id: userId });

    const tokenId = randomUUID();
    await client.query(
      `INSERT INTO public.creator_tokens (id, user_id, mint_address, ticker, name, status, is_primary)
       VALUES ($1, $2, $3, 'TEST', 'Authenticated pending fixture', 'pending', false)`,
      [tokenId, userId, mintAddress],
    );
    await client.query("RESET ROLE");
    return tokenId;
  };

  const expectUniqueViolation = async (
    operation: () => Promise<unknown>,
    expectedConstraint: string,
  ): Promise<void> => {
    await client.query("SAVEPOINT expected_unique_violation");
    let caught: PostgresError | undefined;
    try {
      await operation();
    } catch (error) {
      caught = error as PostgresError;
    }
    await client.query("ROLLBACK TO SAVEPOINT expected_unique_violation");
    await client.query("RELEASE SAVEPOINT expected_unique_violation");
    expect(caught?.code).toBe("23505");
    expect(caught?.constraint).toBe(expectedConstraint);
  };

  it("allows different accounts to submit pending rows for the same mint", async () => {
    const firstAccount = await createAccount();
    const secondAccount = await createAccount();
    const mint = `pending-shared-${randomUUID()}`;

    await createPendingTokenAsAuthenticatedUser(firstAccount, mint);
    await createPendingTokenAsAuthenticatedUser(secondAccount, mint);

    const rows = await client.query("SELECT id FROM public.creator_tokens WHERE mint_address = $1", [mint]);
    expect(rows.rowCount).toBe(2);
  });

  it("allows another account to submit and approve after a rejected claim", async () => {
    const rejectedAccount = await createAccount();
    const claimantAccount = await createAccount();
    const mint = `rejected-reuse-${randomUUID()}`;

    await createToken(rejectedAccount, mint, "rejected");
    const pendingId = await createToken(claimantAccount, mint, "pending");
    await client.query("UPDATE public.creator_tokens SET status = 'approved' WHERE id = $1", [pendingId]);

    const rows = await client.query<{ status: TokenStatus }>(
      "SELECT status FROM public.creator_tokens WHERE mint_address = $1 ORDER BY status",
      [mint],
    );
    expect(rows.rows.map(({ status }) => status)).toEqual(["approved", "rejected"]);
  });

  it("rejects duplicate mint rows for one account with the per-account constraint", async () => {
    const account = await createAccount();
    const mint = `same-account-${randomUUID()}`;
    await createToken(account, mint, "pending");

    await expectUniqueViolation(
      () => createToken(account, mint, "pending"),
      ACCOUNT_MINT_CONSTRAINT,
    );
  });

  it("allows a different account to approve a mint while another account is pending", async () => {
    const pendingAccount = await createAccount();
    const approvedAccount = await createAccount();
    const mint = `pending-does-not-reserve-${randomUUID()}`;

    await createToken(pendingAccount, mint, "pending");
    const approvedId = await createToken(approvedAccount, mint, "approved");

    const approved = await client.query<{ status: TokenStatus }>(
      "SELECT status FROM public.creator_tokens WHERE id = $1",
      [approvedId],
    );
    expect(approved.rows[0]?.status).toBe("approved");
  });

  it("rejects a second approval with 23505 from the approved-mint index", async () => {
    const firstAccount = await createAccount();
    const secondAccount = await createAccount();
    const mint = `one-approved-${randomUUID()}`;
    await createToken(firstAccount, mint, "approved");
    const pendingId = await createToken(secondAccount, mint, "pending");

    await expectUniqueViolation(
      () => client.query("UPDATE public.creator_tokens SET status = 'approved' WHERE id = $1", [pendingId]),
      APPROVED_INDEX,
    );
  });

  it("continues enforcing one primary token per account", async () => {
    const account = await createAccount();
    await createToken(account, `primary-a-${randomUUID()}`, "pending", true);

    await expectUniqueViolation(
      () => createToken(account, `primary-b-${randomUUID()}`, "pending", true),
      PRIMARY_INDEX,
    );
  });

  it.each(["project", "work"] as const)(
    "links an approved token by ID to a %s while other accounts have pending rows for its mint",
    async (targetType) => {
      const tokenOwner = await createAccount();
      const pendingAccountA = await createAccount();
      const pendingAccountB = await createAccount();
      const mint = `attachment-with-pending-duplicates-${randomUUID()}`;
      const approvedTokenId = await createToken(tokenOwner, mint, "approved");
      await createToken(pendingAccountA, mint, "pending");
      await createToken(pendingAccountB, mint, "pending");

      const targetId = randomUUID();
      const targetTable = targetType === "project" ? "projects" : "works";
      if (targetType === "project") {
        await client.query(
          "INSERT INTO public.projects (id, user_id, title) VALUES ($1, $2, $3)",
          [targetId, tokenOwner, "Creator-token uniqueness attachment test"],
        );
      } else {
        await client.query(
          "INSERT INTO public.works (id, user_id, title, content_hash) VALUES ($1, $2, $3, $4)",
          [targetId, tokenOwner, "Creator-token uniqueness attachment test", randomUUID().replace(/-/g, "")],
        );
      }

      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [tokenOwner]);
      await client.query("SELECT set_config('request.jwt.claim.role', 'authenticated', true)");
      await client.query("SET LOCAL ROLE authenticated");
      await client.query(
        "SELECT public.link_approved_creator_token($1, $2, $3)",
        [approvedTokenId, targetType, targetId],
      );

      const linked = await client.query<{ linked_token_id: string }>(
        `SELECT linked_token_id FROM public.${targetTable} WHERE id = $1`,
        [targetId],
      );
      expect(linked.rows[0]?.linked_token_id).toBe(approvedTokenId);
    },
  );
});
