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
 * It then performs the token submission and approval actions needed to test
 * the two security concerns.
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
  const serviceRoleClient = createClient(
    SUPABASE_TEST_URL!,
    SUPABASE_TEST_SERVICE_ROLE_KEY!,
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
    ); // Timestamp updated
  });

  it('(Concern B): creator can set own token_submission_status=\'approved\' directly', async () => {
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

    // Reset state for next test
    const { error: resetError } = await serviceRoleClient
      .from('profiles')
      .update({
        token_submission_status: 'pending',
        token_mint_address_pending: null,
        token_ticker_pending: null,
      })
      .eq('user_id', creatorUserId);
    if (resetError) throw new Error(`Failed to reset state: ${resetError.message}`);
  });

  it('(Concern A): admin approves the swapped token', async () => {
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
      .select('token_mint_address_pending, token_submitted_at')
      .eq('token_submission_status', 'pending')
      .eq('user_id', creatorUserId)
      .single();
    if (pendingRowsError) throw new Error(`Failed to fetch pending rows: ${pendingRowsError.message}`);

    const capturedPendingMint = pendingRows!.token_mint_address_pending;
    expect(capturedPendingMint).toBe(mintA); // Screen shows Token A

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
    const { error: rpcError } = await adminClient.rpc('review_token_submission', {
      _user_id: creatorUserId,
      _approve: true,
      _note: 'Approved',
    });

    expect(rpcError).toBeNull(); // RPC succeeds

    // (e) Assert approved token differs from what admin reviewed
    const { data: finalData, error: finalDataError } = await serviceRoleClient
      .from('profiles')
      .select('token_mint_address')
      .eq('user_id', creatorUserId)
      .single();
    if (finalDataError) throw new Error(`Failed to fetch final data: ${finalDataError.message}`);

    expect(finalData!.token_mint_address).toBe(mintB); // Live is Token B
    expect(capturedPendingMint).toBe(mintA); // Screen showed Token A
  });

  it('baseline: clean approve flow works', async () => {
    const mintC = `TEST-MINT-CCCC-${RUN_TAG}`;
    const tickerC = `TC-${RUN_TAG}`;

    // Fresh submission
    const { error: submitCError } = await creatorClient
      .from('profiles')
      .update({
        token_mint_address: mintC,
        token_ticker: tickerC,
      })
      .eq('user_id', creatorUserId);
    if (submitCError) throw new Error(`Failed to submit token C: ${submitCError.message}`);

    // Admin approves
    const { error: approveError } = await adminClient.rpc('review_token_submission', {
      _user_id: creatorUserId,
      _approve: true,
      _note: 'Approved',
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
    const { error: rejectSubmitError } = await creatorClient
      .from('profiles')
      .update({
        token_mint_address: 'REJECT-ME',
        token_ticker: 'RM',
      })
      .eq('user_id', creatorUserId);
    if (rejectSubmitError) throw new Error(`Failed to submit token for rejection: ${rejectSubmitError.message}`);

    const { error: rejectError } = await adminClient.rpc('review_token_submission', {
      _user_id: creatorUserId,
      _approve: false,
      _note: 'Rejected',
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
