

## Plan: Add "Platform Economics" Section to How It Works Tab

### What
Add a new visual section to the existing **How It Works** tab in the Creator Pass page (`/credits`) that explains the revenue flywheel from the **platform's perspective** — showing how fees, the buyback pool, and token demand create a sustainable business model.

### Where
Insert a new section between the existing "Deep Dive Pillars" and the "Flywheel Summary" in `src/pages/CreditShopPage.tsx` (around line 528).

### Design

**Section: "Platform Economics"**

A visually distinct card (gradient border or accent background) containing:

1. **Header**: "Platform Economics — What Powers the Engine" with a `CircleDollarSign` icon.

2. **Revenue Flow Diagram**: A horizontal (desktop) / vertical (mobile) visual showing the 4 revenue streams as connected step cards:
   - **Transaction Fees (5-15%)** — Every marketplace sale, studio booking, and service hire generates platform revenue.
   - **Credit Shop Sales** — Users purchase $RHOZE credits with SOL or card, creating direct revenue.
   - **Creator Pass Subscriptions** — Monthly tiers (Bloom/Glow/Play) provide recurring revenue.
   - **10% Buyback Pool** — A portion of all earnings flows back to buy $RHOZE, strengthening the token and treasury.

3. **"Why Rewards Pay for Themselves" mini-card**: A compact callout explaining the flywheel logic:
   - Rewards = low-cost user acquisition
   - Active users generate transactions → fees
   - Fees fund buyback → token demand rises
   - Rising token value → more creator retention

All cards use the same design language (rounded-2xl, border, motion animations) as the existing step cards and pillars.

### Files Changed
- `src/pages/CreditShopPage.tsx` — Add the Platform Economics section (~60 lines of JSX) between the Deep Dive Pillars and Flywheel Summary sections.

