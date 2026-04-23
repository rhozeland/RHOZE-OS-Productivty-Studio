# Flow Mode RLS integration tests

End-to-end tests that exercise the **real** Supabase backend (the same one
this project is connected to in Lovable Cloud) to confirm the Flow Mode
feed loader returns multi-creator items for **anonymous** and
**authenticated** roles under the configured RLS policies.

These tests are deliberately **gated by environment variables** and
**skipped by default** so:

- `bun test` / `vitest` continue to pass with no extra config
- CI must opt in explicitly to avoid hammering Cloud on every PR
- Contributors without the service-role key are never blocked

## Required env vars

| Variable | Where to find it |
|---|---|
| `SUPABASE_TEST_URL` | The project's Supabase URL (`VITE_SUPABASE_URL` works too) |
| `SUPABASE_TEST_ANON_KEY` | The anon / publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY` works too) |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | **Service role** key — required to seed/teardown the test namespace and to create the throwaway auth user |

If any of those are missing, the integration suite calls `describe.skip()`
with a clear message and exits zero.

## Running

```bash
SUPABASE_TEST_URL=... \
SUPABASE_TEST_ANON_KEY=... \
SUPABASE_TEST_SERVICE_ROLE_KEY=... \
RUN_FLOW_RLS_INTEGRATION=1 \
  bunx vitest run src/test/integration
```

(`RUN_FLOW_RLS_INTEGRATION=1` is a final safety toggle — even with all the
keys present, the suite still requires this flag to be set so a
mistakenly-leaked secret in a dev shell doesn't run mutations against
Cloud unintentionally.)

## What it verifies

1. **Anonymous role** can `SELECT` from `flow_items` and receive items
   from **multiple distinct creators** (proves the global-feed RLS
   policy `Anyone can view flow items` is in force).
2. **Anonymous role** can resolve uploader attribution via the
   `profiles_public` view (proves the guest-safe view bypass is wired).
3. **Authenticated role** sees the same multi-creator set (proves
   auth doesn't accidentally narrow the result via a stale RLS policy).
4. **Anon role is blocked** from inserting into `flow_items` (negative
   control — confirms RLS is actually enforced and not silently disabled).

## Test data lifecycle

- All seeded rows live under a unique `tag` value
  `flow-rls-test-<timestamp>` written into the `tags` array column so
  teardown can target *only* the rows this run created — no risk of
  deleting unrelated production data.
- Two synthetic creator user_ids are generated per run (random UUIDs,
  no `auth.users` row required since `flow_items.user_id` has no FK
  constraint to `auth.users`).
- The throwaway auth user is created with `admin.createUser({
  email_confirm: true })`, signed in once, then deleted in
  `afterAll` — even if assertions fail.
