import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Header comment: these tests document the insecure status quo as a baseline.
// After the Task #84 fix (expected-value binding in review_token_submission + trigger hardening),
// the tests marked VULNERABILITY-CHARACTERIZATION must be updated to expect rejection instead.

/**
 * ============================================================================
 * TOKEN APPROVAL SECURITY INTEGRATION TESTS
 * ============================================================================
 *
 * PURPOSE:
 * These tests check the security of Rhozeland's creator-token approval system.
 *
 * The tests cover:
 * 1. Normal creator token submission and admin approval.
 * 2. Concern A - A race condition where a creator changes their token
 *    after the admin has already reviewed the original token.
 * 3. Concern B - A creator being able to modify fields that should only
 *    be controlled by the admin approval process.
 *
 *
 * IMPORTANT:
 * ONLY RUN THESE TESTS AGAINST THE RHOZELAND TEST DATABASE.
 * DO NOT RUN THEM AGAINST PRODUCTION.
 *
 * Test Supabase project:
 * Project: Rhozeland's dev
 * Project ID: rodqmawdrsafmwjeuqjz
 * URL: https://rodqmawdrsafmwjeuqjz.supabase.co
 *
 *
 * --------------------------------------------------------------------------
 * STEP 1 - OPEN POWERSHELL
 * --------------------------------------------------------------------------
 *
 * Open PowerShell inside the Rhozeland repository. 
 *
 *
 * --------------------------------------------------------------------------
 * STEP 2 - CONNECT THE TEST TO THE TEST DATABASE
 * --------------------------------------------------------------------------
 *
 * Set the test database URL:
 *
 * $env:SUPABASE_TEST_URL="<TEST_DATABASE_URL>"
 *
 * Set the test database publishable key:
 *
 * $env:SUPABASE_TEST_ANON_KEY="<TEST_PUBLISHABLE_KEY>"
 *
 * Set the test database service role key:
 *
 * $env:SUPABASE_TEST_SERVICE_ROLE_KEY="<TEST_SERVICE_ROLE_KEY>"
 *
 * Get these values from the Rhozeland development Supabase project or ask me them on Slack (Gina)
 *
 * Do not put the service role key directly inside this test file.
 * Do not commit the service role key to GitHub.
 *
 *
 * --------------------------------------------------------------------------
 * STEP 3 - TURN ON THE INTEGRATION TEST
 * --------------------------------------------------------------------------
 *
 * The test is disabled by default so it cannot accidentally run.
 *
 * Turn it on with:
 *
 * $env:RUN_TOKEN_TOCTOU_INTEGRATION="1"
 *
 *
 * --------------------------------------------------------------------------
 * STEP 4 - CHECK THAT EVERYTHING IS SET
 * --------------------------------------------------------------------------
 *
 * Run:
 *
 * Write-Host "Test URL:" ([bool]$env:SUPABASE_TEST_URL)
 * Write-Host "Publishable key:" ([bool]$env:SUPABASE_TEST_ANON_KEY)
 * Write-Host "Service role:" ([bool]$env:SUPABASE_TEST_SERVICE_ROLE_KEY)
 * Write-Host "Testing enabled:" $env:RUN_TOKEN_TOCTOU_INTEGRATION
 *
 * Expected:
 *
 * Test URL: True
 * Publishable key: True
 * Service role: True
 * Testing enabled: 1
 *
 *
 * --------------------------------------------------------------------------
 * STEP 5 - RUN THE TEST
 * --------------------------------------------------------------------------
 *
 * npx vitest run src/test/integration/token-approval-toctou.integration.test.ts
 *
 *
 * --------------------------------------------------------------------------
 * WHAT THE TEST DOES
 * --------------------------------------------------------------------------
 *
 * The test creates temporary creator and admin accounts in the test database.
 * It then performs the token submission and approval actions needed to test:
 * 1. Baseline trigger behavior (creator submits, admin approves/rejects).
 * 2. Concern A - TOCTOU race condition where a creator changes their token
 *    after the admin has already reviewed the original token. This is now
 *    EXPECTED TO BE PROTECTED by the Task #108 binding migration (20261027034058)
 *    that added strict mode with expected-value validation.
 * 3. Concern B - A creator being able to modify fields that should only
 *    be controlled by the admin approval process. This is STILL UNFIXED
 *    and remains a characterization-only test pending trigger hardening.
 * 4. A Phase 1 legacy-compat test that is temporary (will be removed when
 *    the Phase 2 migration flips _strict DEFAULT true).
 *
 */



const RUN_TAG = `toctou-${Date.now()}`;

// My (GINA) Supabase info - This is a test database has hold no data related to the production databse.
const SUPABASE_TEST_URL = process.env.SUPABASE_TEST_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_TEST_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const RUN_TOKEN_TOCTOU_INTEGRATION = process.env.RUN_TOKEN_TOCTOU_INTEGRATION === '1';

const EXPECTED_TEST_PROJECT_ID = 'rodqmawdrsafmwjeuqjz';

// Prevents tests from running on the prod DB
const IS_EXPECTED_TEST_DATABASE =
  SUPABASE_TEST_URL?.includes(EXPECTED_TEST_PROJECT_ID) ?? false;

if (
  RUN_TOKEN_TOCTOU_INTEGRATION &&
  !IS_EXPECTED_TEST_DATABASE
) {
  throw new Error(
    `SAFETY CHECK FAILED: These tests can only run against the Rhozeland test database (${EXPECTED_TEST_PROJECT_ID}).`
  );
}

// Skip tests unless the test database is fully set up and testing is tunred on
const describeIntegration = RUN_TOKEN_TOCTOU_INTEGRATION && SUPABASE_TEST_URL && SUPABASE_TEST_ANON_KEY && SUPABASE_TEST_SERVICE_ROLE_KEY ? describe: describe.skip;

describeIntegration('Token Approval TOCTOU Integration Tests', () => {
  // Placeholder credentials keep module collection from throwing when the
  // suite is skipped (no env vars set) — the clients are never used unless
  // every gate above passed.
  const serviceRoleClient = createClient(
    SUPABASE_TEST_URL ?? 'https://placeholder.supabase.co',
    SUPABASE_TEST_SERVICE_ROLE_KEY ?? 'placeholder-service-role-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `toctou-service-${RUN_TAG}`,
      },
    }
  );
  let creatorClient: ReturnType<typeof createClient>;
  let adminClient: ReturnType<typeof createClient>;
  let creatorUserId: string;
  let adminUserId: string;
  // Projects seeded for the coin_launched fan-out assertions (deleted in afterAll)
  const seededProjectIds: string[] = [];

  interface ProfileRow {
    id: number;
    user_id: string;
    token_mint_address: string | null;
    token_ticker: string | null;
    token_mint_address_pending: string | null;
    token_ticker_pending: string | null;
    token_submission_status: 'none' | 'pending' | 'approved' | 'rejected';
    token_submitted_at: string | null;
    token_reviewed_at: string | null;
    token_review_note: string | null;
  }

  // Shared helpers
  async function submitToken(mint: string | null, ticker: string | null): Promise<{
    mint: string | null;
    ticker: string | null;
    submittedAt: string;
    status: ProfileRow['token_submission_status'];
  }> {
    const { data, error } = await creatorClient
      .from('profiles')
      .update({
        token_mint_address: mint,
        token_ticker: ticker,
      })
      .eq('user_id', creatorUserId)
      .select('token_mint_address, token_ticker, token_mint_address_pending, token_ticker_pending, token_submission_status, token_submitted_at')
      .single();

    if (error) throw new Error(`Failed to submit token: ${error.message}`);

    return {
      mint: data.token_mint_address_pending,
      ticker: data.token_ticker_pending,
      submittedAt: data.token_submitted_at!,
      status: data.token_submission_status,
    };
  }

  async function getProfileRow(): Promise<ProfileRow> {
    const { data, error } = await serviceRoleClient
      .from('profiles')
      .select('*')
      .eq('user_id', creatorUserId)
      .single();

    if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
    return data as ProfileRow;
  }

  async function callReview(args: {
    _user_id: string;
    _approve: boolean;
    _note: string | null;
    _expected_mint?: string | null;
    _expected_ticker?: string | null;
    _expected_submitted_at?: string | null;
    _strict?: boolean;
  }) {
    const result = await adminClient.rpc('review_token_submission', args);
    return result;
  }

  async function seedFanNotificationContext(): Promise<string> {
    // Insert a public project owned by the creator
    const { data: project, error: projectError } = await serviceRoleClient
      .from('projects')
      .insert({
        user_id: creatorUserId,
        title: `Test Project ${RUN_TAG}`,
        status: 'active',
        is_public: true,
        total_budget: 0,
        is_estimate: true,
        currency: 'CAD',
      })
      .select('id')
      .single();

    if (projectError) throw new Error(`Failed to create project: ${projectError.message}`);

    // Add a cheer from the admin user
    const { error: cheerError } = await serviceRoleClient
      .from('project_cheers')
      .insert({
        project_id: project.id,
        user_id: adminUserId,
      });

    if (cheerError) throw new Error(`Failed to create cheer: ${cheerError.message}`);

    seededProjectIds.push(project.id);

    return project.id;
  }

  async function countCoinLaunchedNotifications(): Promise<number> {
    const { count, error } = await serviceRoleClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', adminUserId)
      .eq('type', 'coin_launched')
      .eq('link', `/profiles/${creatorUserId}`);

    if (error) throw new Error(`Failed to count notifications: ${error.message}`);
    return count || 0;
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isTransportError(e: unknown): boolean {
    const msg = String(e);
    return msg.includes('fetch failed') || msg.includes('ETIMEDOUT') || msg.includes('network');
  }

  async function resetToCleanSlate() {
    const { error } = await serviceRoleClient
      .from('profiles')
      .update({
        token_submission_status: 'none',
        token_mint_address: null,
        token_ticker: null,
        token_mint_address_pending: null,
        token_ticker_pending: null,
        token_submitted_at: null,
        token_reviewed_at: null,
        token_review_note: null,
      })
      .eq('user_id', creatorUserId);

    if (error) throw new Error(`Failed to reset state: ${error.message}`);
  }

beforeAll(async () => {

  // Create throwaway auth users
  const creatorEmail = `toctou-creator-${RUN_TAG}@test.local`;
  const adminEmail = `toctou-admin-${RUN_TAG}@test.local`;

  // Create creator
  const { data: creatorUser, error: creatorError } =
    await serviceRoleClient.auth.admin.createUser({
      email: creatorEmail,
      password: 'test-password',
      email_confirm: true,
    });

  if (creatorError) {
    throw new Error(
      `Failed to create creator user: ${creatorError.message}`
    );
  }

  if (!creatorUser.user) {
    throw new Error('Creator user was not returned');
  }

  creatorUserId = creatorUser.user.id;

  // Create admin
  const { data: adminUser, error: adminError } =
    await serviceRoleClient.auth.admin.createUser({
      email: adminEmail,
      password: 'test-password',
      email_confirm: true,
    });

  if (adminError) {
    throw new Error(
      `Failed to create admin user: ${adminError.message}`
    );
  }

  if (!adminUser.user) {
    throw new Error('Admin user was not returned');
  }

  adminUserId = adminUser.user.id;

  // Update auto-created profiles

  const RUN_NUM = Date.now().toString().slice(-8);

  const { error: creatorProfileError } = await serviceRoleClient
    .from('profiles')
    .update({
      username: `toctou_c_${RUN_NUM}`,
      display_name: 'TOCTOU Test Creator',
    })
    .eq('user_id', creatorUserId);


  if (creatorProfileError) {
    throw new Error(
      `Failed to update creator profile: ${creatorProfileError.message}`
    );
  }


  const { error: adminProfileError } = await serviceRoleClient
    .from('profiles')
    .update({
      username: `toctou_a_${RUN_NUM}`,
      display_name: 'TOCTOU Test Admin',
    })
    .eq('user_id', adminUserId);


  if (adminProfileError) {
    throw new Error(
      `Failed to update admin profile: ${adminProfileError.message}`
    );
  }

  // Assign admin role
  const { error: roleError } = await serviceRoleClient
    .from('user_roles')
    .insert([
      {
        user_id: adminUserId,
        role: 'admin',
      },
    ]);

  if (roleError) {
    throw new Error(
      `Failed to assign admin role: ${roleError.message}`
    );
  }

  creatorClient = createClient(
    SUPABASE_TEST_URL!,
    SUPABASE_TEST_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { error: creatorSignInError } =
    await creatorClient.auth.signInWithPassword({
      email: creatorEmail,
      password: 'test-password',
    });

  if (creatorSignInError) {
    throw new Error(
      `Failed to sign in creator: ${creatorSignInError.message}`
    );
  }

  adminClient = createClient(
    SUPABASE_TEST_URL!,
    SUPABASE_TEST_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { error: adminSignInError } =
    await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: 'test-password',
    });

  if (adminSignInError) {
    throw new Error(
      `Failed to sign in admin: ${adminSignInError.message}`
    );
  }

});

  afterAll(async () => {
    // Cleanup: delete notifications for both users (no FK cascade)
    try {
      if (creatorUserId) {
        await serviceRoleClient
          .from('notifications')
          .delete()
          .eq('user_id', creatorUserId)
          .catch(e => console.error('Failed to delete creator notifications:', e));
      }
      if (adminUserId) {
        await serviceRoleClient
          .from('notifications')
          .delete()
          .eq('user_id', adminUserId)
          .catch(e => console.error('Failed to delete admin notifications:', e));
      }
    } catch (error) {
      console.error('Notification cleanup failed:', error);
    }

    // Cleanup: delete seeded projects (cascades to project_cheers)
    try {
      for (const projectId of seededProjectIds) {
        await serviceRoleClient
          .from('projects')
          .delete()
          .eq('id', projectId)
          .catch(e => console.error('Failed to delete seeded project:', e));
      }
    } catch (error) {
      console.error('Project cleanup failed:', error);
    }

    // Cleanup: delete auth users (cascades to profiles and user_roles)
    try {
      if (creatorUserId) {
        await serviceRoleClient.auth.admin.deleteUser(creatorUserId).catch(e => console.error('Failed to delete creator user:', e));
      }
      if (adminUserId) {
        await serviceRoleClient.auth.admin.deleteUser(adminUserId).catch(e => console.error('Failed to delete admin user:', e));
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

it('baseline: when a creator submits a token, it should wait for admin approval before becoming their official token', async () => { 
    const mintA = `TEST-MINT-AAAA-${RUN_TAG}`;
    const tickerA = `TA-${RUN_TAG}`;

    const { data, error } = await creatorClient
      .from('profiles')
      .update({
        token_mint_address: mintA,
        token_ticker: tickerA,
      })
      .eq('user_id', creatorUserId)
      .select('token_mint_address, token_ticker, token_mint_address_pending, token_ticker_pending, token_submission_status, token_submitted_at')
      .single();

    if (error) throw new Error(`Failed to submit token: ${error.message}`);
    expect(data.token_mint_address).toBeNull(); // Trigger reverts live columns
    expect(data.token_ticker).toBeNull();
    expect(data.token_mint_address_pending).toBe(mintA); // Trigger stashes into pending
    expect(data.token_ticker_pending).toBe(tickerA);
    expect(data.token_submission_status).toBe('pending'); // Trigger sets status
    expect(data.token_submitted_at).not.toBeNull(); // Trigger sets timestamp
  });

  it('resubmission while pending is allowed and replaces the pending value', async () => {
    const mintB = `TEST-MINT-BBBB-${RUN_TAG}`;
    const tickerB = `TB-${RUN_TAG}`;

    // First submission
    const { error: firstError } = await creatorClient
      .from('profiles')
      .update({
        token_mint_address: mintB,
        token_ticker: tickerB,
      })
      .eq('user_id', creatorUserId);
    if (firstError) throw new Error(`Failed to submit token: ${firstError.message}`);

    const { data: firstData, error: firstDataError } = await creatorClient
      .from('profiles')
      .select('token_submitted_at')
      .eq('user_id', creatorUserId)
      .single();
    if (firstDataError) throw new Error(`Failed to fetch first submission data: ${firstDataError.message}`);

    // Space the two submissions apart on the wall clock: now() has
    // microsecond precision, so back-to-back writes could land on the
    // same timestamp and make the "bumped" assertion flaky.
    await sleep(25);

    // Second submission
    const { data, error } = await creatorClient
      .from('profiles')
      .update({
        token_mint_address: mintB,
        token_ticker: tickerB,
      })
      .eq('user_id', creatorUserId)
      .select('token_mint_address_pending, token_ticker_pending, token_submission_status, token_submitted_at')
      .single();

    if (error) throw new Error(`Failed to submit token: ${error.message}`);
    expect(data.token_mint_address_pending).toBe(mintB);
    expect(data.token_ticker_pending).toBe(tickerB);
    expect(data.token_submission_status).toBe('pending');
    expect(new Date(data.token_submitted_at!).getTime()).toBeGreaterThan(
      new Date(firstData!.token_submitted_at!).getTime()
  );
});
  it('(Concern B): creator can set own token_submission_status=\'approved\' directly', async () => {
    // VULNERABILITY-CHARACTERIZATION: Concern B is STILL UNFIXED pending
    // trigger hardening. The enforce_token_approval trigger only intercepts
    // changes to the live token columns, so direct writes to
    // token_submission_status / token_*_pending pass straight through when
    // the live columns are unchanged. This test documents that open hole.
    // Direct write to status
    const { data, error } = await creatorClient
      .from('profiles')
      .update({ token_submission_status: 'approved' })
      .eq('user_id', creatorUserId)
      .select('token_submission_status')
      .single();

    if (error) throw new Error(`Failed to update status: ${error.message}`);
    expect(data.token_submission_status).toBe('approved'); // Direct write passes through

    // Direct write to pending
    const { data: pendingData, error: pendingError } = await creatorClient
      .from('profiles')
      .update({ token_mint_address_pending: 'DIRECT-PENDING' })
      .eq('user_id', creatorUserId)
      .select('token_mint_address_pending')
      .single();

    if (pendingError) throw new Error(`Failed to update pending: ${pendingError.message}`);
    expect(pendingData.token_mint_address_pending).toBe('DIRECT-PENDING'); // Direct write passes through

    // Reset to a full clean slate for the next test (status 'none' and all
    // five token columns null) via serviceRoleClient.
    await resetToCleanSlate();
  });

it('(Concern A): stale admin approval rejects a changed token submission', async () => {
    // TASK #108 FIX: this documents the protection now in place via migration
    // 20261027034058. With _strict: true the RPC binds the approval to the
    // exact pending values the admin saw; if the creator swapped the
    // submission in between, the approve fails with 'submission_changed'.

    const mintA = `TEST-MINT-AAAA-${RUN_TAG}`;
    const mintB = `TEST-MINT-BBBB-${RUN_TAG}`;

    // (a) Creator submits Token A
    const { error: submitAError } = await creatorClient
      .from('profiles')
      .update({
        token_mint_address: mintA,
        token_ticker: `TA-${RUN_TAG}`,
      })
      .eq('user_id', creatorUserId);
    if (submitAError) throw new Error(`Failed to submit token A: ${submitAError.message}`);

    // (b) Admin fetches pending rows (simulating UI fetch)
   const { data: pendingRows, error: pendingRowsError } = await adminClient
  .from('profiles')
  .select(
    'token_mint_address_pending, token_ticker_pending, token_submitted_at'
  )
  .eq('token_submission_status', 'pending')
  .eq('user_id', creatorUserId)
  .single();
    if (pendingRowsError) throw new Error(`Failed to fetch pending rows: ${pendingRowsError.message}`);

    const capturedPendingMint = pendingRows!.token_mint_address_pending;
    const capturedPendingTicker = pendingRows!.token_ticker_pending;
    const capturedSubmittedAt = pendingRows!.token_submitted_at;

    expect(capturedPendingMint).toBe(mintA);
    expect(capturedPendingTicker).toBe(`TA-${RUN_TAG}`);
    expect(capturedSubmittedAt).not.toBeNull();

    // Snapshot the coin_launched fan-out count before the FAILED approve
    const notificationsBefore = await countCoinLaunchedNotifications();

    // (c) Creator swaps pending to Token B
    const { error: swapError } = await creatorClient
      .from('profiles')
      .update({
        token_mint_address: mintB,
        token_ticker: `TB-${RUN_TAG}`,
      })
      .eq('user_id', creatorUserId);
    if (swapError) throw new Error(`Failed to swap token: ${swapError.message}`);

    // (d) Admin approves WITHOUT refetching
   const { error: rpcError } = await adminClient.rpc(
  'review_token_submission',
  {
    _user_id: creatorUserId,
    _approve: true,
    _note: 'Approved',

    _expected_mint: capturedPendingMint,
    _expected_ticker: capturedPendingTicker,
    _expected_submitted_at: capturedSubmittedAt,
    _strict: true,
  }
);

expect(rpcError).not.toBeNull();
expect(rpcError?.message).toContain('submission_changed');

// (e) A failed approve must not resolve the submission or fan out notifications
    const notificationsAfter = await countCoinLaunchedNotifications();
    expect(notificationsAfter).toBe(notificationsBefore);

    // Assert approved token differs from what admin reviewed
    const { data: finalData, error: finalDataError } = await serviceRoleClient
      .from('profiles')
      .select('token_mint_address, token_ticker, token_mint_address_pending, token_ticker_pending, token_submission_status, token_review_note')
      .eq('user_id', creatorUserId)
      .single();
    if (finalDataError) throw new Error(`Failed to fetch final data: ${finalDataError.message}`);

  expect(finalData!.token_mint_address).not.toBe(mintB);

  expect(finalData!.token_mint_address_pending).toBe(mintB);

  expect(finalData!.token_ticker_pending).toBe(
    `TB-${RUN_TAG}`
  );

  expect(finalData!.token_submission_status).toBe(
    'pending'
  );

  expect(finalData!.token_review_note).toBeNull(); // no review note written on failure
});
  it('(Task #108) strict clean approval succeeds', async () => {
    await resetToCleanSlate();
    const captured = await submitToken(`TEST-MINT-STRICTA-${RUN_TAG}`, `TSA-${RUN_TAG}`);

    const { error } = await callReview({
      _user_id: creatorUserId,
      _approve: true,
      _note: 'Approved (strict)',
      _expected_mint: captured.mint,
      _expected_ticker: captured.ticker,
      _expected_submitted_at: captured.submittedAt, // raw ISO string from the fetch
      _strict: true,
    });

    expect(error).toBeNull();

    const profile = await getProfileRow();
    expect(profile.token_mint_address).toBe(captured.mint); // live promoted
    expect(profile.token_ticker).toBe(captured.ticker);
    expect(profile.token_mint_address_pending).toBeNull(); // pending cleared
    expect(profile.token_ticker_pending).toBeNull();
    expect(profile.token_submission_status).toBe('approved');
    expect(profile.token_reviewed_at).not.toBeNull();
    expect(profile.token_review_note).toBe('Approved (strict)');
  });

  it('(Task #108) strict stale rejection is rejected', async () => {
    await resetToCleanSlate();
    const captured = await submitToken(`TEST-MINT-STALEB-${RUN_TAG}`, `TSB-${RUN_TAG}`);

    // Creator swaps the pending submission after the admin captured Token A
    const swapped = await submitToken(`TEST-MINT-SWAPB-${RUN_TAG}`, `TSW-${RUN_TAG}`);

    const { error } = await callReview({
      _user_id: creatorUserId,
      _approve: false,
      _note: 'Stale reject',
      _expected_mint: captured.mint,
      _expected_ticker: captured.ticker,
      _expected_submitted_at: captured.submittedAt,
      _strict: true,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('submission_changed');

    const profile = await getProfileRow();
    expect(profile.token_submission_status).toBe('pending'); // submission still pending
    expect(profile.token_mint_address_pending).toBe(swapped.mint); // pending untouched
    expect(profile.token_ticker_pending).toBe(swapped.ticker);
    expect(profile.token_review_note).toBeNull(); // no note written on failure
    expect(profile.token_mint_address).toBeNull(); // live columns untouched
    expect(profile.token_ticker).toBeNull();
  });

  it('(Task #108) strict clean rejection succeeds', async () => {
    await resetToCleanSlate();
    const captured = await submitToken(`TEST-MINT-STRICTC-${RUN_TAG}`, `TSC-${RUN_TAG}`);

    const { error } = await callReview({
      _user_id: creatorUserId,
      _approve: false,
      _note: 'Rejected (strict)',
      _expected_mint: captured.mint,
      _expected_ticker: captured.ticker,
      _expected_submitted_at: captured.submittedAt,
      _strict: true,
    });

    expect(error).toBeNull();

    const profile = await getProfileRow();
    expect(profile.token_submission_status).toBe('rejected');
    expect(profile.token_mint_address_pending).toBeNull(); // pending cleared
    expect(profile.token_ticker_pending).toBeNull();
    expect(profile.token_mint_address).toBeNull(); // reject leaves live columns alone
    expect(profile.token_ticker).toBeNull();
    expect(profile.token_reviewed_at).not.toBeNull();
    expect(profile.token_review_note).toBe('Rejected (strict)');
  });

  it('(Task #108) double strict approval: second returns submission_already_resolved', async () => {
    // Deterministic via FOR UPDATE serialization: the second caller blocks on
    // the profile row lock until the first approve commits, then sees
    // status <> 'pending' and raises submission_already_resolved.
    await resetToCleanSlate();

    // Clean notification baseline so the fan-out count is exact
    const { error: cleanupError } = await serviceRoleClient
      .from('notifications')
      .delete()
      .eq('user_id', adminUserId)
      .eq('type', 'coin_launched')
      .eq('link', `/profiles/${creatorUserId}`);
    if (cleanupError) throw new Error(`Failed to clean notifications: ${cleanupError.message}`);

    await seedFanNotificationContext();

    const captured = await submitToken(`TEST-MINT-DOUBLE-${RUN_TAG}`, `TSD-${RUN_TAG}`);

    const countBefore = await countCoinLaunchedNotifications();
    expect(countBefore).toBe(0);

    const strictArgs = {
      _user_id: creatorUserId,
      _approve: true,
      _note: 'Approved once (strict)',
      _expected_mint: captured.mint,
      _expected_ticker: captured.ticker,
      _expected_submitted_at: captured.submittedAt,
      _strict: true,
    };

    const first = await callReview(strictArgs);
    expect(first.error).toBeNull();

    const countAfterFirst = await countCoinLaunchedNotifications();
    expect(countAfterFirst).toBe(1); // 0 -> 1 fan-out on success

    const second = await callReview(strictArgs);
    expect(second.error).not.toBeNull();
    expect(second.error!.message).toContain('submission_already_resolved');

    // No second fan-out, and the submission is still approved
    expect(await countCoinLaunchedNotifications()).toBe(1);
    const profile = await getProfileRow();
    expect(profile.token_submission_status).toBe('approved');
  });

  it('(Task #108) strict NULL expected values are not wildcards', async () => {
    // (a) A pending submission WITH a mint must not match _expected_mint: null.
    // IS NOT DISTINCT FROM makes NULL equality strict, not a wildcard.
    await resetToCleanSlate();
    const captured = await submitToken(`TEST-MINT-NULLW-${RUN_TAG}`, `TNW-${RUN_TAG}`);

    const { error } = await callReview({
      _user_id: creatorUserId,
      _approve: true,
      _note: null,
      _expected_mint: null, // wrong: the pending mint is not NULL
      _expected_ticker: captured.ticker,
      _expected_submitted_at: captured.submittedAt,
      _strict: true,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('submission_changed');
    expect((await getProfileRow()).token_submission_status).toBe('pending');

    // (b) The NULL pending-mint state is reachable via the real trigger path,
    // not artificially: submitting a ticker-only change while the live mint
    // is NULL stashes pending_mint = NULL. Strict mode must still accept it
    // when the expected values match exactly (NULL == NULL).
    await resetToCleanSlate();
    const tickerOnly = await submitToken(null, 'TA-ONLY');
    expect(tickerOnly.mint).toBeNull();

    const { error: okError } = await callReview({
      _user_id: creatorUserId,
      _approve: true,
      _note: null,
      _expected_mint: tickerOnly.mint, // null
      _expected_ticker: tickerOnly.ticker,
      _expected_submitted_at: tickerOnly.submittedAt,
      _strict: true,
    });

    expect(okError).toBeNull();

    const profile = await getProfileRow();
    expect(profile.token_ticker).toBe('TA-ONLY'); // live ticker promoted
    expect(profile.token_mint_address).toBeNull(); // live mint stays NULL
    expect(profile.token_mint_address_pending).toBeNull();
    expect(profile.token_submission_status).toBe('approved');
  });

  it('(Task #108) wrong expected ticker rejected independently', async () => {
    await resetToCleanSlate();
    const captured = await submitToken(`TEST-MINT-TICK-${RUN_TAG}`, `TT-${RUN_TAG}`);

    const { error } = await callReview({
      _user_id: creatorUserId,
      _approve: true,
      _note: null,
      _expected_mint: captured.mint, // correct
      _expected_ticker: 'WRONG', // stale
      _expected_submitted_at: captured.submittedAt, // correct
      _strict: true,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('submission_changed');
    expect((await getProfileRow()).token_submission_status).toBe('pending');
  });

  it('(Task #108) wrong expected timestamp rejected independently', async () => {
    await resetToCleanSlate();
    const captured = await submitToken(`TEST-MINT-TIME-${RUN_TAG}`, `TTM-${RUN_TAG}`);

    const { error } = await callReview({
      _user_id: creatorUserId,
      _approve: true,
      _note: null,
      _expected_mint: captured.mint, // correct
      _expected_ticker: captured.ticker, // correct
      _expected_submitted_at: new Date(Date.now() + 60_000).toISOString(), // stale
      _strict: true,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('submission_changed');
    expect((await getProfileRow()).token_submission_status).toBe('pending');
  });

  it('(Task #108) non-admin cannot call the review RPC', async () => {
    // SECURITY DEFINER still enforces has_role: the RPC rejects callers
    // without the admin role even with perfectly matching expected values.
    await resetToCleanSlate();
    const captured = await submitToken(`TEST-MINT-NONADM-${RUN_TAG}`, `TNA-${RUN_TAG}`);

    const { error } = await creatorClient.rpc('review_token_submission', {
      _user_id: creatorUserId,
      _approve: true,
      _note: 'Self-approve attempt',
      _expected_mint: captured.mint,
      _expected_ticker: captured.ticker,
      _expected_submitted_at: captured.submittedAt,
      _strict: true,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('admin only');

    const profile = await getProfileRow();
    expect(profile.token_submission_status).toBe('pending'); // untouched
    expect(profile.token_mint_address_pending).toBe(captured.mint);
    expect(profile.token_ticker_pending).toBe(captured.ticker);
    expect(profile.token_review_note).toBeNull();
  });
// *****************************************************************************
// Phase 2 regression test.
//
// _strict now defaults to true. A caller that omits _strict and the expected
// submission values must no longer fall back to the old unbound approval
// behavior. The review should fail with submission_changed.
// *****************************************************************************
it('(Phase 2) unbound review call defaults to strict validation', async () => {
  await resetToCleanSlate();

  const capturedA = await submitToken(
    `TEST-MINT-LEGA-${RUN_TAG}`,
    `TLA-${RUN_TAG}`,
  );

  // Creator swaps to Token B after the hypothetical admin captured Token A.
  const capturedB = await submitToken(
    `TEST-MINT-LEGB-${RUN_TAG}`,
    `TLB-${RUN_TAG}`,
  );

  expect(capturedB.mint).not.toBe(capturedA.mint);

  // No expected values or _strict are supplied.
  // Phase 2 defaults _strict to true, so this unbound review must fail.
  const { error } = await adminClient.rpc('review_token_submission', {
    _user_id: creatorUserId,
    _approve: true,
    _note: 'Legacy approve',
  });

  expect(error).not.toBeNull();
  expect(error?.message).toContain('submission_changed');

  const profile = await getProfileRow();

  // Token B must remain pending and must NOT be promoted to live.
  expect(profile.token_submission_status).toBe('pending');
  expect(profile.token_mint_address).not.toBe(capturedB.mint);
  expect(profile.token_mint_address_pending).toBe(capturedB.mint);
});

  it('(Task #108) concurrent strict approvals: exactly one wins', async () => {
    // Deterministic via FOR UPDATE serialization inside the RPC: the losing
    // caller sees status <> 'pending' and gets submission_already_resolved.
    // If this ever flakes from transport errors, move it to a DB-level test.
    await resetToCleanSlate();

    // Clean notification baseline so the fan-out count is exact
    const { error: cleanupError } = await serviceRoleClient
      .from('notifications')
      .delete()
      .eq('user_id', adminUserId)
      .eq('type', 'coin_launched')
      .eq('link', `/profiles/${creatorUserId}`);
    if (cleanupError) throw new Error(`Failed to clean notifications: ${cleanupError.message}`);

    await seedFanNotificationContext();

    const captured = await submitToken(`TEST-MINT-RACE-${RUN_TAG}`, `TRC-${RUN_TAG}`);

    const countBefore = await countCoinLaunchedNotifications();
    expect(countBefore).toBe(0);

    const strictArgs = {
      _user_id: creatorUserId,
      _approve: true,
      _note: 'Race winner',
      _expected_mint: captured.mint,
      _expected_ticker: captured.ticker,
      _expected_submitted_at: captured.submittedAt,
      _strict: true,
    };

    const settled = await Promise.allSettled([
      adminClient.rpc('review_token_submission', strictArgs),
      adminClient.rpc('review_token_submission', strictArgs),
    ]);

    const outcomes = settled.map((result) => {
      if (result.status === 'rejected') {
        // A rejected promise means a transport-level failure, not a security
        // assertion — rethrow so the failure is visible as infrastructure noise.
        if (isTransportError(result.reason)) {
          throw new Error(`TRANSPORT ERROR (not a security assertion failure): ${String(result.reason)}`);
        }
        return { error: { message: String(result.reason) } };
      }
      return {
        error: result.value.error ? { message: result.value.error.message } : null,
      };
    });

    const winners = outcomes.filter((o) => o.error === null);
    const losers = outcomes.filter((o) => o.error !== null);

    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);
    expect(losers[0]!.error!.message).toContain('submission_already_resolved');

    const profile = await getProfileRow();
    expect(profile.token_submission_status).toBe('approved');

    // Exactly one fan-out notification despite two approve attempts
    expect(await countCoinLaunchedNotifications()).toBe(1);
  });

  it('(Task #108) strict clean approve then strict clean reject, end to end', async () => {
    // Proves the strict path handles the full approve-then-reject lifecycle without breaking legacy assertions
    // (live promotion, pending cleared, reviewed_at/note stored, reject never touches live columns).
    const mintC = `TEST-MINT-CCCC-${RUN_TAG}`;
    const tickerC = `TC-${RUN_TAG}`;

    // Fresh submission
    const captured = await submitToken(mintC, tickerC);

    // Admin approves (strict)
    const { error: approveError } = await callReview({
      _user_id: creatorUserId,
      _approve: true,
      _note: 'Approved',
      _expected_mint: captured.mint,
      _expected_ticker: captured.ticker,
      _expected_submitted_at: captured.submittedAt,
      _strict: true,
    });

    expect(approveError).toBeNull();

    const { data: finalRow } = await serviceRoleClient
      .from('profiles')
      .select('*')
      .eq('user_id', creatorUserId)
      .single();
    const finalData = finalRow as unknown as ProfileRow;

    expect(finalData.token_mint_address).toBe(mintC); // Live = submitted
    expect(finalData.token_submission_status).toBe('approved');
    expect(finalData.token_mint_address_pending).toBeNull(); // Pending cleared
    expect(finalData.token_reviewed_at).not.toBeNull(); // Review timestamp set

    // Reject path
    const capturedReject = await submitToken('REJECT-ME', 'RM');

    const { error: rejectError } = await callReview({
      _user_id: creatorUserId,
      _approve: false,
      _note: 'Rejected',
      _expected_mint: capturedReject.mint,
      _expected_ticker: capturedReject.ticker,
      _expected_submitted_at: capturedReject.submittedAt,
      _strict: true,
    });

    expect(rejectError).toBeNull();

    const { data: rejectRow } = await serviceRoleClient
      .from('profiles')
      .select('*')
      .eq('user_id', creatorUserId)
      .single();
    const rejectData = rejectRow as unknown as ProfileRow;

    expect(rejectData.token_submission_status).toBe('rejected');
    expect(rejectData.token_mint_address).toBe(mintC); // Reject must not touch live columns
    expect(rejectData.token_mint_address_pending).toBeNull(); // Pending cleared
    expect(rejectData.token_review_note).toBe('Rejected'); // Note stored
  });
});
