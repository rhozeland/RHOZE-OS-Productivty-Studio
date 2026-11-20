import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { beforeAll, describe, expect, it } from "vitest";

const RUN_FLAG = "RUN_EXTERNAL_MINT_CHALLENGE_LOCK_INTEGRATION";
const MIGRATION_VERSION = "20261120120000";
const LOCK_HOLD_MS = 6_000;
const describeLocalIntegration = process.env[RUN_FLAG] === "1" ? describe : describe.skip;

type TargetType = "project" | "work";

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
    throw new Error("This concurrency suite only connects to the local loopback Supabase database.");
  }

  return connectionString;
};

const targetTable = (targetType: TargetType): "projects" | "works" =>
  targetType === "project" ? "projects" : "works";

describeLocalIntegration("external mint challenge expiry during local database lock waits", () => {
  let connectionString: string;

  beforeAll(async () => {
    connectionString = getLocalDatabaseUrl();
    const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 });
    await client.connect();
    try {
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

      const functionDefinition = await client.query<{ definition: string }>(
        "SELECT pg_get_functiondef('public.attach_verified_external_mint(uuid)'::regprocedure) AS definition",
      );
      const definition = functionDefinition.rows[0]?.definition ?? "";
      const relationshipCheck = definition.indexOf("IF v_previous_linked_token_id IS DISTINCT FROM");
      const refreshedTime = definition.indexOf("v_now := clock_timestamp();", relationshipCheck);
      const challengeConsumption = definition.indexOf(
        "UPDATE public.external_mint_attachment_challenges AS c",
        refreshedTime,
      );
      if (relationshipCheck < 0 || refreshedTime <= relationshipCheck || challengeConsumption <= refreshedTime) {
        throw new Error("The local attach_verified_external_mint function is not using the post-lock timestamp refresh.");
      }
    } finally {
      await client.end();
    }
  }, 20_000);

  it.each(["project", "work"] as const)(
    "rejects a challenge that expires while its %s target row is locked",
    async (targetType) => {
      const table = targetTable(targetType);
      const userId = randomUUID();
      const targetId = randomUUID();
      const challengeId = randomUUID();
      const email = `mint-lock-${randomUUID()}@integration.test`;
      const contentHash = randomUUID().replace(/-/g, "");
      const control = new Client({
        connectionString,
        connectionTimeoutMillis: 5_000,
        query_timeout: 20_000,
      });
      const locker = new Client({
        connectionString,
        connectionTimeoutMillis: 5_000,
        query_timeout: 20_000,
      });
      let controlConnected = false;
      let lockerConnected = false;
      let controlTransactionOpen = false;
      let lockerTransactionOpen = false;
      let releaseLock: Promise<void> | undefined;
      let lockerError: unknown;

      try {
        await control.connect();
        controlConnected = true;
        await locker.connect();
        lockerConnected = true;

        await control.query("SET statement_timeout = '20s'");
        await control.query("SET lock_timeout = '10s'");
        await locker.query("SET statement_timeout = '15s'");
        await locker.query("SET lock_timeout = '10s'");

        await control.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [userId, email]);
        if (targetType === "project") {
          await control.query(
            "INSERT INTO public.projects (id, user_id, title) VALUES ($1, $2, $3)",
            [targetId, userId, "External mint expiry lock test project"],
          );
        } else {
          await control.query(
            "INSERT INTO public.works (id, user_id, title, content_hash) VALUES ($1, $2, $3, $4)",
            [targetId, userId, "External mint expiry lock test work", contentHash],
          );
        }
        await control.query(
          `INSERT INTO public.external_mint_attachment_challenges (
             id, user_id, target_type, target_id, mint_address, creator_wallet,
             message, token_name, token_ticker, token_image_url, expires_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             clock_timestamp() + interval '1 minute'
           )`,
          [
            challengeId,
            userId,
            targetType,
            targetId,
            "So11111111111111111111111111111111111111112",
            "11111111111111111111111111111111",
            "local lock expiry regression test",
            "Expiry Test Coin",
            "EXPIRE",
            "https://images.example.test/expiry.png",
          ],
        );

        await locker.query("BEGIN");
        lockerTransactionOpen = true;
        await locker.query("SET LOCAL statement_timeout = '15s'");
        await locker.query("SET LOCAL lock_timeout = '10s'");
        const lockedTarget = await locker.query(
          `SELECT id FROM public.${table} WHERE id = $1 FOR UPDATE`,
          [targetId],
        );
        expect(lockedTarget.rowCount).toBe(1);

        releaseLock = (async () => {
          await locker.query("SELECT pg_sleep($1)", [LOCK_HOLD_MS / 1_000]);
          await locker.query("COMMIT");
          lockerTransactionOpen = false;
        })().catch((error: unknown) => {
          lockerError = error;
        });

        await control.query("BEGIN");
        controlTransactionOpen = true;
        await control.query("SET LOCAL statement_timeout = '20s'");
        await control.query("SET LOCAL lock_timeout = '10s'");
        await control.query("SELECT set_config('request.jwt.claim.role', 'service_role', true)");
        await control.query(
          "UPDATE public.external_mint_attachment_challenges SET expires_at = clock_timestamp() + interval '2 seconds' WHERE id = $1",
          [challengeId],
        );

        const startedAt = Date.now();
        let rpcError: unknown;
        try {
          await control.query("SELECT * FROM public.attach_verified_external_mint($1)", [challengeId]);
          await control.query("COMMIT");
          controlTransactionOpen = false;
        } catch (error) {
          rpcError = error;
          await control.query("ROLLBACK");
          controlTransactionOpen = false;
        }
        const elapsedMs = Date.now() - startedAt;

        await releaseLock;
        expect(lockerError).toBeUndefined();
        expect(elapsedMs).toBeGreaterThanOrEqual(4_500);
        expect((rpcError as { code?: string } | undefined)?.code).toBe("22023");

        const target = await control.query<{
          linked_token_id: string | null;
          linked_token_mint: string | null;
          linked_token_ticker: string | null;
          linked_token_name: string | null;
          linked_token_image_url: string | null;
        }>(
          `SELECT linked_token_id, linked_token_mint, linked_token_ticker, linked_token_name, linked_token_image_url
             FROM public.${table}
            WHERE id = $1`,
          [targetId],
        );
        expect(target.rows[0]).toEqual({
          linked_token_id: null,
          linked_token_mint: null,
          linked_token_ticker: null,
          linked_token_name: null,
          linked_token_image_url: null,
        });

        const challenge = await control.query<{ consumed_at: string | null }>(
          "SELECT consumed_at FROM public.external_mint_attachment_challenges WHERE id = $1",
          [challengeId],
        );
        expect(challenge.rows[0]?.consumed_at).toBeNull();
      } finally {
        if (releaseLock) await releaseLock;
        if (controlTransactionOpen) await control.query("ROLLBACK").catch(() => undefined);
        if (lockerTransactionOpen) await locker.query("ROLLBACK").catch(() => undefined);

        try {
          if (controlConnected) {
            await control.query("BEGIN");
            try {
              await control.query("DELETE FROM public.external_mint_attachment_challenges WHERE id = $1", [challengeId]);
              await control.query(`DELETE FROM public.${table} WHERE id = $1`, [targetId]);
              await control.query("DELETE FROM auth.users WHERE id = $1", [userId]);
              await control.query("COMMIT");
            } catch (error) {
              await control.query("ROLLBACK").catch(() => undefined);
              throw error;
            }
          }
        } finally {
          await Promise.all([
            controlConnected ? control.end() : Promise.resolve(),
            lockerConnected ? locker.end() : Promise.resolve(),
          ]);
        }
      }
    },
    25_000,
  );
});
