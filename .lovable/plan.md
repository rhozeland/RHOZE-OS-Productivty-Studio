# Pillar 7 — Ship the cleanup, then upgrade the roadmap

Splitting this into **two waves** so you actually see progress instead of one giant batch.

---

## Wave 1 — Visible cleanup (ships in this turn)

### 1. Sidebar = 5 tabs, not 3
`Discover · Feed · Connect · Messages · Creator Pass`

- **Discover** (`/discover`) — featured creators, Coins in Motion, lanes. Stays as-is.
- **Feed** (`/flow`) — Flow Mode is the Feed. Direct link from sidebar.
- **Connect** (`/market`) — Creators · Listings · Events (3 chips). Spaces gone from nav.
- **Messages** (`/messages`)
- **Creator Pass** (`/credits`)

### 2. Flow tabs moved up
On `/flow`, the `All / Following` (renamed from "For You / All") toggle moves into the top header strip, above the deck — not floating mid-card. "For You" → **Following** (= creators you follow).

### 3. Post button = direct upload, no settings detour
The `+ Post` dropdown stops being a router. It opens a **single inline "Share to Flow" sheet** (your screenshot 3 layout, but cleaner):
- **3 vibes only**: Music · Video · Photo. Design + Writing gone.
- File picker constrained per vibe (`audio/*`, `video/*`, `image/*`).
- One screen, vertical flow: vibe → file → optional title/caption → Post. No 3-step wizard, no settings redirect, no verification gate (verification only blocks the *Verified IP anchor* checkbox, not posting).
- Hashes in-browser, uploads to the existing `works` table, posts straight to Flow.
- Listing / Event / Space stay on the `+ Post` menu but as a secondary row below the upload sheet — not the primary path.

### 4. Connect page = 3 chips
`MarketRoomPage` chips collapse to **Creators · Listings · Events**. "Spaces" + "Live" filters removed (Spaces becomes a roadmap milestone category later).

---

## Wave 2 — Roadmap upgrades (next turn, after you confirm Wave 1 looks right)

These are bigger, and I want your sign-off on direction before I touch them:

### 5. Voice-to-roadmap
"Describe your project" button on the New Project dialog → opens a voice recorder → transcribes via Lovable AI (Gemini supports audio input directly) → feeds the transcript into the existing `draft-project-roadmap` edge fn as the brief. No new model needed.

### 6. Concierge CTA after AI draft
Right after `draft-project-roadmap` returns, show a banner on the roadmap: **"Want us to A&R this with you? Book a call →"** that opens the existing `<ConciergeIntakeSheet />` pre-filled with the project name + drafted milestones. One click to escalate from AI-drafted to human-managed.

### 7. On-chain proposal signatures
Today `project_proposals.sign_project_proposal` is a DB RPC — purely off-chain. Upgrade: when both parties sign, hash the proposal JSON (same SHA-256 path Verified IP uses) and anchor it via the existing `anchor-contribution` edge fn (Solana memo tx). Store `proposal_tx_signature` + `proposal_content_hash` on `project_proposals`. The "Both signed" pill becomes "Signed on-chain" with a Solscan link. Reuses the Verified IP plumbing exactly as you said.

### 8. Google Drive attach
Add Google Drive connector → "Attach from Drive" button on the upload sheet + project Vault. Picks a file, copies into our storage bucket, hashes it the same way as a direct upload. Standard OAuth picker flow — not hard, ~half a day of work.

---

## What I need from you

- **OK to ship Wave 1 now** as described?
- **For Wave 2** — any of the 4 items you want me to skip, reorder, or change?

(I'm doing Wave 1 immediately on approval. Wave 2 is the follow-up turn.)
