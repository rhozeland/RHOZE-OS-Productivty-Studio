

# End-to-End Reward System Test Plan

## Current State
- **Triggers**: All 6 reward triggers are active and correctly defined (reward_flow_post, reward_flow_interaction, reward_review, reward_drop_room_post, reward_milestone_approved, record_contribution_proof)
- **Data**: Zero reward transactions and zero contribution proofs exist — the triggers were added *after* the existing Flow posts, so they never fired
- **Edge Functions**: `anchor-contribution` is deployed but never called
- **UI**: CreatorReputation component is live on profile pages
- **Network**: All Solana calls point to devnet

## Test Steps

### Step 1: Post to Flow
- Navigate to Flow Mode and create a new post (any title/category/content)
- The `trg_reward_flow_post` trigger should fire → calls `award_rhoze(user_id, 2, 'Posted to Flow: ...')`
- This inserts into `user_credits` (+2 balance) and `credit_transactions` (type='reward')

### Step 2: Verify Credit Balance
- Check the credit balance updated (+2 from the post)
- Query `credit_transactions` for the new reward entry

### Step 3: Verify Contribution Proof
- The `trg_record_contribution` trigger fires on the reward transaction insert → creates a row in `contribution_proofs`
- Query `contribution_proofs` to confirm the proof was logged with correct action_type and metadata

### Step 4: View Reputation on Profile
- Navigate to the user's profile page
- The "On-Chain Reputation" section should show "0/1 verified" with the new proof card
- The proof should show an "Anchor" button (since no Solana signature yet)

### Step 5: Anchor to Solana Devnet
- Click "Anchor" on the proof card
- This calls the `anchor-contribution` edge function which:
  1. Authenticates the user
  2. Fetches the proof from DB
  3. Builds a JSON memo and signs it with the airdrop wallet
  4. Sends a Solana memo transaction on devnet
  5. Updates the proof with the transaction signature
- After success, the card should show a Solscan devnet link instead of the Anchor button

### Potential Issues to Watch For
- **Airdrop wallet SOL balance**: The wallet needs devnet SOL to pay transaction fees. If it has none, the anchor will fail. We may need to airdrop devnet SOL to it.
- **RLS on contribution_proofs**: The trigger uses `SECURITY DEFINER` so inserts bypass RLS — this should work fine.
- **Edge function auth**: The user must be logged in for the anchor call to succeed.

## Implementation
No code changes needed — this is a live test of existing functionality. I will:
1. Use the browser to log in, post to Flow, and walk through each step
2. Use database queries to verify data at each stage
3. Use edge function curl/logs to debug any failures
4. Fix any issues found along the way

