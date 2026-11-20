# Integration tests

This folder contains opt-in tests for Supabase auth, RLS, database functions,
and selected production request handlers. Suites are skipped by default.

| Suite | Opt-in flag | External services |
|---|---|---|
| `flow-rls.integration.test.ts` | `RUN_FLOW_RLS_INTEGRATION=1` | Supabase only |
| `curator-invite.integration.test.ts` | `RUN_CURATOR_INVITE_INTEGRATION=1` | Supabase only |
| `external-mint-attachment.integration.test.ts` | `RUN_EXTERNAL_MINT_ATTACHMENT_INTEGRATION=1` | Supabase only; seeds persistence challenges |
| `approved-token-attachment.integration.test.ts` | `RUN_APPROVED_TOKEN_ATTACHMENT_INTEGRATION=1` | Supabase only |
| `external-mint-attachment-workflow.integration.test.ts` | `RUN_EXTERNAL_MINT_ATTACHMENT_WORKFLOW_INTEGRATION=1` | Supabase plus mocked Solana RPC and pump.fun responses |

## Safe Supabase target

Mutating suites require an explicit `SUPABASE_TEST_URL`; they never use
`VITE_SUPABASE_URL` as the test target. They accept only a local Supabase
instance or a dedicated remote test project. They refuse to run against the
project ID in `supabase/config.toml`, `process.env.VITE_SUPABASE_URL`, or a
Supabase URL configured in Vite environment files (`.env`, `.env.local`,
`.env.[mode]`, or `.env.[mode].local`).

Required credentials:

| Variable | Value |
|---|---|
| `SUPABASE_TEST_URL` | Local or dedicated test project URL |
| `SUPABASE_TEST_ANON_KEY` | Test project's anon/publishable key |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | Test project's service-role key |

For local Supabase, set `SUPABASE_TEST_ENVIRONMENT=local`; the URL must resolve
to `localhost`, `127.0.0.1`, or `::1`.

For a dedicated remote test project, set
`SUPABASE_TEST_ENVIRONMENT=dedicated` and `SUPABASE_TEST_PROJECT_REF` to the
project ref in the test URL. The ref must not match an app-configured project.
Do not use production credentials or store test credentials in the repository.

Each suite also requires its own `RUN_*` flag as a final opt-in. If credentials
or the flag are missing, the suite skips. If a suite is enabled with an
unsafe/mismatched target, Vitest fails before creating test data.

## External attachment workflow boundary

`external-mint-attachment-workflow.integration.test.ts` runs the production
Edge Function request handler with real Supabase auth, challenge rows, signature
verification, the `attach_verified_external_mint` database RPC, and final row
reads. Its Solana `getGenesisHash`/`getAccountInfo` and pump.fun metadata
responses are deterministic fixtures. This verifies the authenticated handler
and database workflow, but it is not verification against live Solana or
pump.fun services.

The lower-level `external-mint-attachment.integration.test.ts` exercises the
real database persistence function directly with service-role-seeded
challenges. It remains useful for database-only enforcement and replay tests;
the handler workflow suite covers the authenticated challenge-to-attach path.

## Running

Configure the test credentials and safety declaration in the shell, then set
the desired `RUN_*` flags and run:

```sh
npm test -- src/test/integration
```

Do not put credentials in a committed `.env` file. The test suites create
throwaway users and unique rows and remove them in teardown.
