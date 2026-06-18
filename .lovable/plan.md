# Whiteboard Board tab

Replace the static masonry on each project's **Board** tab with a true shared whiteboard. One canvas per project, synced for the whole team.

## What you'll get

- **Infinite pannable canvas** with zoom (trackpad pinch + +/− buttons + space-drag to pan)
- **Drag, resize, rotate** every item (existing deliverables + new elements)
- **Sticky notes** — pick a color, type text, drop anywhere
- **Freehand draw** — pen tool with color + stroke width, eraser, undo
- **Background removal** on any image with one click ("Cutout") — runs in the browser, no API key, produces a transparent PNG that re-uploads to storage
- **Toolbar** floating at the bottom: Select · Pen · Note · Image · Cutout · Undo · Zoom
- **Falls back to the old masonry on mobile** (<640px) — touch whiteboard is its own beast; mobile users can still view + add, just no freeform editing
- **Shared** — every team member sees the same layout in real time

## Technical details

### Schema

New columns on `project_deliverables` (canvas position is opt-in; null = legacy masonry behavior):
- `board_x`, `board_y` `int` — top-left in canvas coords
- `board_width`, `board_height` `int`
- `board_rotation` `numeric default 0`
- `board_z` `int default 0`
- `bg_removed` `boolean default false` — set after a cutout pass

New table `project_board_elements` for whiteboard-native primitives (notes, ink, shapes) that aren't files:
```
id uuid pk, project_id uuid fk → projects, created_by uuid → auth.users,
kind text check in ('note','drawing','shape'),
x int, y int, width int, height int, rotation numeric default 0, z int default 0,
color text, payload jsonb,   -- note: {text}; drawing: {paths: [...]}; shape: {type,...}
created_at, updated_at
```
RLS: select for any project member/owner; insert/update/delete for members + owner. GRANTs to `authenticated` + `service_role`.

### Frontend

- New `src/components/project/board/ProjectBoardCanvas.tsx` — the whole canvas
- Sub-components: `BoardToolbar`, `BoardItemFrame` (drag/resize/rotate wrapper), `StickyNote`, `DrawingLayer` (SVG path renderer + pen capture), `useBoardSync` (one query merging deliverables + elements, mutation helpers)
- Background removal: dynamic `import("@imgly/background-removal")` only when the Cutout button is pressed (keeps initial bundle small). Result blob → upload to existing `project-deliverables` storage bucket → patch the row with new `file_url` + `bg_removed=true` + `content_hash` cleared
- Wire into `ProjectDetailPage` Board tab: keep `BoardMasonry` for the Overview preview + mobile; render `<ProjectBoardCanvas />` on the full Board tab at ≥sm breakpoint
- Keep `AddBoardAssetDialog` for adding files (now drops them at center of current viewport with sensible default size)

### Out of scope (this pass)

- Touch/pen support on phones (canvas is desktop/tablet only; mobile sees masonry)
- Real-time cursors / multi-cursor presence (positions still sync via tanstack-query refetch + supabase realtime on the two tables — but no live cursor avatars)
- Connectors/arrows between items
