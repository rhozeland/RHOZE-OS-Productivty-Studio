# Pillar 1 — Project Flow Rewrite

Ship the new project creation + roadmap experience. Coin-gated fan club and education cards come in follow-up turns.

## 1. Budget = plain number, no slider

In `ProposalSheet.tsx` (the "Start a project" surface):

- Replace the credits/slider input with a single `<Input type="number">` for total budget in USD.
- Below it, a live visual breakdown card:
  ```text
  ┌────────────────────────────────────────┐
  │ $2,500  total budget                    │
  │ ────────────────────────────────        │
  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░               │
  │ $2,250 to creator (90%)                 │
  │ $250 Rhozeland fee (10%)                │
  └────────────────────────────────────────┘
  ```
- No min, no max, no tier math. Flat 10% (A&R upgrade later switches to 25% inside the project).
- "Credits" language removed from this surface entirely.

## 2. AI-drafted roadmap (Gemini Flash)

New edge function `draft-project-roadmap`:
- Input: `{ projectName, budget, clientProfile, specialistProfile, briefAnswers }`
- Calls Lovable AI Gateway with `google/gemini-3-flash-preview`, tool-calling for structured output.
- Returns 3–5 milestones: `{ title, deliverables[], suggested_amount, est_days }`.
- Wired into a new "Draft with AI" button at the top of the empty roadmap inside `ProjectDetailPage`.

After creation, project lands on the workspace with the AI draft already populated as editable goals. User can edit titles, reorder, change amounts, delete, add — same Square-invoice line-item feel.

## 3. Scope / accept screen (Square-style)

New component `<ProjectScopeReview />` mounted inside `ProjectDetailPage` above the roadmap when contract status is `draft`:

- Header: project title + service date
- Line items table: each milestone = one line (title · deliverables description · amount)
- Subtotal · Rhozeland fee · **Total**
- Deposit / balance breakdown (50/50 default, editable)
- Both parties must view + click "Accept scope" before the existing `RoadmapLockFlow` becomes available
- Stores acceptance in `project_approvals` with a new `scope_accepted_at` flag

## 4. Simplified ProposalSheet

After the rewrite, ProposalSheet is just:
1. **Name your project** (text)
2. **Set budget** (number + fee viz)
3. **Brief** (3 short prompts: what · when · vibe)
4. **Create** → routes to `/projects/:id` with an AI-draft trigger queued

No more credit math, no more sliders, no more milestone inputs inside the sheet — everything heavy moves into the project workspace.

## Technical notes

- DB: no schema changes needed. `projects.total_budget` already USD. Add `scope_accepted_at timestamptz` to `project_approvals` (nullable).
- Edge function `draft-project-roadmap`: ~80 lines, Zod input, tool-calling output, 402/429 handled, CORS shared headers.
- Client: `useAiRoadmapDraft()` hook wraps `supabase.functions.invoke`, returns `{ draft, isLoading, error, generate() }`.
- Existing `RoadmapLockFlow` stays intact — `<ProjectScopeReview />` sits above it as a soft gate.
- Platform fee read from existing `src/lib/platform-fee.ts` (already 10% baseline).

## Out of scope (next turns)
- Pillar 2: wallet-connect token gating for private feed
- Pillar 3: "Why launch a coin?" education card + live pump.fun creator rewards readout
- A&R in-project upsell card polish

## Files touched
- `src/components/proposals/ProposalSheet.tsx` — rewrite budget step
- `src/components/project/ProjectScopeReview.tsx` — NEW
- `src/components/project/AiRoadmapDraftButton.tsx` — NEW
- `src/hooks/useAiRoadmapDraft.ts` — NEW
- `src/pages/ProjectDetailPage.tsx` — mount scope review + AI draft button
- `supabase/functions/draft-project-roadmap/index.ts` — NEW
- Migration: add `scope_accepted_at` to `project_approvals`
