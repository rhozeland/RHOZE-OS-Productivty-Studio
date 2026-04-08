
## Track 1: $RHOZE Rewards Engine (Off-chain, database-driven)

### 1. Reward Triggers (DB triggers that auto-credit $RHOZE)
| Action | $RHOZE | Trigger |
|--------|--------|---------|
| Post to Flow | 2 | `flow_items` INSERT |
| Receive a like/save on Flow | 1 | `flow_interactions` INSERT (credited to post owner) |
| Complete a project milestone | 10 | `project_milestones` UPDATE to 'approved' |
| Leave a review | 3 | `reviews` INSERT |
| Post in Drop Room | 1 | `drop_room_posts` INSERT |
| Receive an upvote in Drop Room | 1 | `drop_room_posts` UPDATE (upvotes increase) |

Each trigger calls `adjust_user_credits` internally (via SECURITY DEFINER) and logs to `credit_transactions` with type = 'reward'.

### 2. Rewards Dashboard in Creators Hub
- **Earnings summary**: total earned, this week, streak counter
- **Activity breakdown**: chart showing rewards by category
- **Recent rewards feed**: list of recent credit_transactions where type = 'reward'
- **Leaderboard**: top earners by reward credits this week/month

### 3. Daily Streak Bonus
- Add `last_reward_login` and `reward_streak` columns to `user_credits`
- Check on app load — if 24h+ since last login, increment streak
- Every 7-day streak = 5 bonus $RHOZE

---

## Track 2: Hybrid On-Chain (Solana Program interactions)

### 4. On-Chain Escrow via Solana
- When a client locks escrow credits, optionally record a hash of the contract terms on-chain as a Solana memo transaction
- On milestone release, record the release as a Solana transfer memo — creating a verifiable audit trail
- This makes the escrow system "hybrid" — fast off-chain logic, with on-chain proof anchors

### 5. Creator Pass as Compressed NFT (cNFT)
- When a user upgrades their Creator Pass tier, mint a compressed NFT via Metaplex Bubblegum (Helius API)
- The NFT metadata includes: tier name, user display name, timestamp
- This gives holders a portable, tradeable proof of membership
- Requires: Helius API key (free tier available)

### 6. $RHOZE On-Chain Claim
- Users accumulate $RHOZE off-chain (fast, free)
- Periodically, they can "claim" to an SPL token on Solana (like a bridge)
- This keeps daily UX gas-free while giving on-chain utility for DeFi/trading
- Requires: deploying a simple SPL token (one-time setup)

---

## Recommended Build Order
1. **Reward triggers** (migration) — immediate, high impact for demo
2. **Rewards dashboard UI** — visible hackathon wow factor  
3. **On-chain escrow memos** — differentiator, uses existing wallet infra
4. **Creator Pass cNFT** — impressive but needs Helius API key
5. **$RHOZE SPL claim** — stretch goal, highest complexity

Steps 1-3 can ship in this session. Steps 4-5 need API keys and more planning.
