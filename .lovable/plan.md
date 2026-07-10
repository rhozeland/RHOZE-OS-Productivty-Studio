# Release Canvas — v1

Rebuild "open a project" as a **FigJam-lite board**: 4 lanes, freeform cards inside each, drop-anything ingestion, AI Copilot dock that acts on selection.

## 1. Entry flow

- `PostMenuButton` "Start a Project" → **removes the AI vs Blank picker**.
- One click creates a project via `create_project_with_owner` with `name = "Untitled release"` and navigates to `/projects/:id/canvas`.
- Canvas top-left shows an inline-editable title (click to rename, blur to save → `projects.name`).
- Old `StartProjectPicker` is kept but the AI/Blank fork collapses to a single "Create" primary; the invite step still runs after creation.

## 2. Canvas surface (`/projects/:id/canvas`)

Structured board — 4 lanes, freeform cards inside each lane:

```text
┌─────────────┬─────────────┬────────────────┬─────────────┐
│  Ideas      │  In progress│  Review        │  Released   │
│  (freeform  │  (freeform  │  (freeform     │  (freeform  │
│   cards)    │   cards)    │   cards)       │   cards)    │
└─────────────┴─────────────┴────────────────┴─────────────┘
```

- Lanes are fixed columns (horizontal scroll on small screens).
- Cards inside a lane have `{ x, y }` freeform positions (drag anywhere in the lane).
- Drag a card across lanes → updates `lane`.
- Marquee-select + multi-select with shift-click. Selected cards get a ring + are the target for the AI dock.
- Toolbar (top): `+ Node ▾` (Media, Milestone, Moodboard, Sticky, Contract), Undo/Redo, Zoom hint, Share.
- Drop zone: dragging files anywhere on the canvas creates a Media node at the drop point in the nearest lane.

## 3. Node types (v1)

| Type         | Renders as                                                             | Backed by                                                    |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `media`      | Cover / waveform / play tile with filename + type badge                | `work_attachments` row + Supabase Storage `project-files`    |
| `milestone`  | Title, phase pill, due date, progress bar, checklist count             | `project_goals` row (reuse existing schema)                  |
| `moodboard`  | 2×2 image cluster + note                                               | `moodboard_items` rows grouped by `cluster_id` on the card   |
| `sticky`     | Colored note, editable text                                            | new `canvas_cards.payload.text`                              |
| `contract`   | Contract title + signed/pending chip → opens SignedAgreementCard sheet | `project_contracts` row link                                 |
| `deliverable`| Title, status chip, attach button                                      | `project_deliverables` row                                   |

All cards share a single `canvas_cards` table (see Technical) that stores position + lane + reference to the domain row.

## 4. Ingestion — "just drop content in"

Three parallel paths, all end up as a `media` node on the board:

1. **Drag-drop from OS** → upload to `project-files/<projectId>/…` → create `work_attachments` row → create `canvas_cards` row at drop point.
2. **Toolbar → Upload** → same pipeline via file picker.
3. **Toolbar → From gallery** → sheet listing the user's existing `works` + recent `flow_items` → tap to attach (creates a card that references the existing work, no re-upload).

Progress + errors surface as a toast + a shimmer overlay on the placeholder card.

## 5. AI Copilot dock

Floating pill, bottom-right of the canvas:

- Collapsed: `✨ AI` button.
- Expanded: small chat surface with quick actions that operate on **currently selected cards** (or the whole board if nothing selected):
    - "Draft a rollout roadmap from these" → calls `draft-project-roadmap` edge fn with selected media titles/kinds → inserts `milestone` cards into the `In progress` lane, chained by `chainMilestoneDates`.
    - "Summarize this board" → posts a Sticky in Ideas.
    - "Suggest next milestone" → single milestone card.
    - Free prompt → same edge fn, prompt appended.
- Uses the existing `useAiRoadmapDraft` hook + `composeMilestoneDescription` helper — no new edge fn.
- Errors (402/429) rendered inline in the dock, matching existing copy.

## 6. Reuse of existing tools

- **Roadmap** → `milestone` cards on the canvas. The existing `/projects/:id` Roadmap tab stays as a *list view* of the same rows (Kanban ↔ Canvas, same data).
- **Smartboard** → the moodboard node uses `moodboard_items` primitives; the standalone `/smartboards/:id` route stays live.
- **Drop Rooms** → surfaced as a "Rooms" chip in the toolbar that opens the existing sheet.
- **Contracts / Deliverables** → reused as node types, no duplicate storage.

## 7. Routing + navigation

- New route: `/projects/:id/canvas` (default landing after "Start a Project").
- Existing `/projects/:id` Roadmap/Scope/Team tabs stay mounted; add a "Canvas" tab that deep-links to `/projects/:id/canvas`.
- Sidebar Projects list rows: primary click → canvas.

---

## Technical details

### New table

```sql
create table public.canvas_cards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  lane text not null check (lane in ('ideas','in_progress','review','released')) default 'ideas',
  x int not null default 0,
  y int not null default 0,
  w int not null default 240,
  h int not null default 160,
  kind text not null check (kind in ('media','milestone','moodboard','sticky','contract','deliverable')),
  -- links to existing domain rows (nullable, one populated per kind)
  work_attachment_id uuid references public.work_attachments(id) on delete cascade,
  goal_id uuid references public.project_goals(id) on delete cascade,
  contract_id uuid references public.project_contracts(id) on delete cascade,
  deliverable_id uuid references public.project_deliverables(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,   -- sticky text, moodboard cluster, etc.
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.canvas_cards to authenticated;
grant all on public.canvas_cards to service_role;
alter table public.canvas_cards enable row level security;

-- policies mirror projects visibility via project_member_role()
create policy "members read canvas" on public.canvas_cards for select to authenticated
  using (public.project_member_role(project_id, auth.uid()) is not null);
create policy "members write canvas" on public.canvas_cards for all to authenticated
  using (public.project_member_role(project_id, auth.uid()) is not null)
  with check (public.project_member_role(project_id, auth.uid()) is not null);
```

Position updates batched via `updated_at` with a 300ms debounce from `useCanvasCards`.

### New files

- `src/pages/ProjectCanvasPage.tsx` — page shell, header w/ inline title, toolbar, dock.
- `src/components/canvas/CanvasBoard.tsx` — 4-lane layout, drop handlers, marquee select.
- `src/components/canvas/CanvasCard.tsx` — polymorphic renderer by `kind`.
- `src/components/canvas/CanvasToolbar.tsx` — `+ Node`, Upload, From Gallery.
- `src/components/canvas/AiCopilotDock.tsx` — floating dock, wraps `useAiRoadmapDraft`.
- `src/components/canvas/GalleryPickerSheet.tsx` — pick from user's works/flow.
- `src/hooks/useCanvasCards.ts` — CRUD + realtime for `canvas_cards`.
- `supabase/migrations/<ts>_canvas_cards.sql` — schema above.

### Edited files

- `src/components/project/StartProjectPicker.tsx` — collapse AI/Blank fork into one primary create; navigate to canvas on success.
- `src/App.tsx` — mount `/projects/:id/canvas`.
- `src/pages/ProjectDetailPage.tsx` — add "Canvas" tab entry linking to the new route (no data changes).

### Out of scope (deferred)

- True infinite pan/zoom canvas (locked in as v2).
- Connecting arrows between cards.
- Realtime multi-user cursors.
- Slash-command AI.
- Voice input inside the dock (reuse existing mic in a later pass).

Once you approve, I'll ship the migration + files in one pass.
