# Streamline Discover composer, project creation, and project detail

Big consolidation pass across four surfaces. Frontend-only.

## 1. Conversations — add a Flow tab

In `MessagesPage` tabs (currently DMs · Projects · Inquiries · Listings), add a new **Flow** tab that mounts `<HubFlowWidget />` (the same widget Discover uses). Opens Flow mode in-place; entering full-screen Flow still routes to `/flow`.

## 2. Discover composer (`StreamComposer`) — fewer, clearer kinds

Current chips: Drop · Offering · Opportunity · Event · Space · Work · Project.

New chips: **Update · Offering · Event · Space · Work**

- Rename "Drop" → **"Update"** (label + placeholder + button + footer copy: "Updates show up in Conversations and on your profile."). Same underlying `kind="drop"` in DB — pure relabel.
- **Merge Offering + Opportunity** into a single "Offering" chip. Keep `kind="offering"` and drop the opportunity branch. Any opportunity-only fields fold into offering's form.
- **Remove Project chip** entirely (creation still possible from Conversations → Projects tab).

## 3. New Project form — minimum viable

Condense `NewProjectDialog` (or wherever the form lives — likely `src/components/project/` or `ProjectsPage`) to **just**:

- Project name (required)
- Accent color

Remove from the create dialog: One-line summary, Project mode (Service vs Collaboration — default to `collaborative`), Vision, Scope for now, Budget timing block, Status on create (default `in_progress`).

After create → navigate straight to `/projects/:id` where all those fields are already editable in Scope / Roadmap / etc.

## 4. Project detail page — condense tabs

Current tabs: Roadmap · Tools · Scope · (Budget) · Team · Vault.

New tabs: **Roadmap · Scope · (Budget) · Team**

- **Remove Tools tab.** Smartboards move *into* Roadmap — when adding an item to a stage/goal you can attach/create a smartboard inline. The link-smartboard dialog and `smartboardDetails` query stay, just triggered from Roadmap.
- **Remove Vault tab.** (Attached works can resurface later if needed; for now the user wants it gone.)
- **Drop Room quick-launch in Progress Overview**: above/next to `<ProgressChart />`, add a small "Start a Drop Room" button that creates a room scoped to the project and opens it. Anyone on the project can spin one up anytime.

## Out of scope

- The "project creation is buggy / clipping" complaint — I'll inspect the dialog while editing it and fix obvious overflow/clipping I see, but a deeper bug hunt would be a separate pass if issues remain.
- Memory updates (navigation v8, project tabs canonical list) will be refreshed after the edits land.

## Technical notes

- Files likely touched: `src/pages/MessagesPage.tsx`, `src/components/stream/StreamComposer.tsx`, project create dialog component, `src/pages/ProjectDetailPage.tsx`, plus a small `ProjectDropRoomLauncher` component.
- No DB migrations. `kind` enum values reused (`drop` relabeled, `opportunity` either deprecated in UI or auto-mapped to `offering`).
- Memory files to update afterwards: `mem://index.md` (project tabs canonical list, composer kinds), and any pillars-v7 file referencing Tools/Vault.

Confirm and I'll ship it.