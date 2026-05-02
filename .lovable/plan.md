
Five connected changes, all frontend-only — no DB, no edge functions.

## 1. Strip Settings modules

`src/pages/SettingsPage.tsx`

- Remove from the `SECTIONS` array: `appearance`, `dock`, `flow-cards`.
- Delete the `renderAppearance`, `renderDock`, `renderFlowCards` functions and their entries in the section dispatcher map (`appearance`, `dock`, `"flow-cards"`).
- Delete the now-unused imports: `DockCustomizer`, `FlowCardCustomizer`, `Palette` (if unused elsewhere in the file), `LayoutDashboard`, `Sparkles` (if only used by these sections).
- If theme toggle lived in Appearance, fold its contents into the existing top-of-page or into Account (theme toggle already exists in the header so we can drop it cleanly).
- Keep the component files (`DockCustomizer.tsx`, `FlowCardCustomizer.tsx`) on disk — they're not deleted, just unmounted. Reduces blast radius and keeps the option to revive.

## 2. Hide the bottom dock globally

`src/components/AppLayout.tsx`

- Replace the conditional `{user && !location.pathname.startsWith("/flow") && <DockBar />}` with nothing.
- Leave `DockBar.tsx` and `DockCustomizer.tsx` files untouched on disk — same rationale as above (revertable).
- Remove the `pb-32` padding bump on `<main>` since the dock no longer occupies the bottom: change `${user ? "pb-32" : "pb-8"}` → just `pb-8`.

## 3. Move Flow Mode into Hub (toggle + widget, kill flame button)

### Kill the search-bar flame
`src/components/AppLayout.tsx` — remove the entire `{user && (<Tooltip>…flame…</Tooltip>)}` block above the search button. Adjust the search button's left padding back to `pl-4` always (drop the `user ? "pl-11" : "pl-4"` ternary).

### Add Tile/Flow view toggle on Hub
`src/pages/HubPage.tsx` — at the top of the page (near the Lane chips row) add a small segmented control: `Tile · Flow`. State lives in component (`viewMode: "tile" | "flow"`), persisted to URL as `?view=flow`.

- `view=tile` (default) renders the existing lane grid unchanged.
- `view=flow` renders the embedded Flow widget (see next bullet) in fullscreen-within-page mode (replaces the lane grid, keeps Hub header + lane chips).

### Embedded Flow widget on Hub homepage
New file `src/components/hub/HubFlowWidget.tsx`:

- Compact card showing the top 3 Flow items (poster image + creator name + verified badge) using the existing `loadFlowFeed` helper. Keep it lazy/cheap.
- Click → navigates to `/hub?view=flow` (which renders the same widget enlarged).
- When `expanded` prop is true: renders the actual `<FlowModePage />` content full-bleed inside a card, OR — simpler — just `navigate("/flow")` for the enlarged experience and keep the widget as a teaser.

**Decision for v1**: Widget on the Conversations lane top, plus the toggle. The toggle's `flow` mode navigates to `/flow` (we don't try to embed the heavy swipe stack inside Hub yet — too much state). The widget is purely a 3-card teaser that links into either tile feed or `/flow` when "Open Flow" is tapped. This honours "both — toggle + widget" without rewriting FlowModePage.

### Side nav usage trace
- Update memory: Flow Mode now lives at `/flow` (still routable) AND as widget+toggle entry point on Hub. Remove the "/flow redirects to /projects" line in the Flow Mode memory (it's stale and incorrect).

## 4. Side nav rework + reframe Studio as "My Studio"

### `src/components/AppSidebar.tsx`
Replace `pillarItems` with the v7 IA (Spaces + Projects removed from primary nav):

```
[Discover, Hub, Inbox, Profile]
```

Replace `secondaryItems` with:

```
[My Studio (/dashboard), Creator Pass (/credits)]
```

- Drop `Spaces` from pillarItems.
- Drop `Projects` from secondaryItems (still routable via Inbox tab).
- Rename the Studio entry icon from `Home` to `Box` or `LayoutGrid` (something that reads as "your workspace") and label "My Studio".

### `src/pages/DashboardPage.tsx` — strip the dual-network framing

- Delete ACT 1 (split-screen Studios | Hub duo hero with shared search), ACT 2 (Nearby studios + Hub pulse stacked previews), ACT 3 (unified pulse feed Studios/Hub toggle), ACT 4 (Spaces by city + People grid).
- Replace with a clean "My Studio" header: greeting (kept) + tagline like "Your workspace. Drafts, drops, bookings, and what's next."
- Keep: FirstRunChecklist, the personal sections (Projects, Schedule, Messages), Customizer for those personal sections, GuestDashboardPreview branch.
- Remove the giant Hub/Spaces lane copy — "My Studio" is private and personal, not a public discovery surface.
- Anything pulling from `studios` table or "hub pulse" queries inside this page can be dropped (cuts a lot of code and queries).

### `src/components/AppLayout.tsx` header
- Keep the search and command palette as-is — it's still the global ⌘K. Studios remain searchable there.

## 5. Memory + verify

- Update `mem://arch/pillars-v7`: dock hidden globally, Stream is the only feed pillar, side nav now Discover · Hub · Inbox · Profile + My Studio + Creator Pass, Settings stripped to 8 modules, Flow accessible via Hub widget + toggle.
- Update `mem://arch/navigation`: dock removed; nav happens via side nav + header.
- Update `mem://features/user-settings`: 8 modules now (was 10): Profile · Display Picture · Banner & Background · Wallet · Verified IP · Shipping · Notifications · Security · Account. Removed Appearance, Dock Menu, Flow Cards.
- Update `mem://features/flow-mode`: `/flow` is a first-class page again; entered via Hub toggle (`/hub?view=flow`) and the HubFlowWidget. Search-bar flame button removed.
- Update `mem://features/dashboard`: reframed as "My Studio" personal workspace, dual-network Spaces/Hub framing removed.
- Update Core in `mem://index.md`: drop "Flow launcher lives in the top search bar (flame icon)." line, replace with "Flow Mode = entered via the Hub view toggle (`/hub?view=flow`) and the embedded HubFlowWidget; standalone /flow still routable."
- Update Core: dock = HIDDEN globally; nav happens via side nav (Discover · Hub · Inbox · Profile · My Studio · Creator Pass) + header search.
- Run `bunx tsc --noEmit` to verify zero type errors.

## Out of scope (not touched this pass)

- Routing aliases for `/spaces`, `/studios`, `/projects`, `/marketplace`, `/creators`, `/people` stay as-is — they already redirect to `/stream`. We're not deleting routes, just removing them from the primary nav.
- StudiosPage, SpacesPage, etc. remain on disk and routable (deep links survive).
- Stream composer and ProjectsInbox stay as shipped in v7 phases 1-2.
- DockBar.tsx + DockCustomizer.tsx + FlowCardCustomizer.tsx files stay on disk (just unmounted from UI). Easy to revive if user changes mind.

## Technical notes

- **Why keep `/flow` as a routable page** instead of embedding inside Hub? FlowModePage is 2000+ lines with its own swipe-state machine, file upload pipeline, calibration, and idle hints. Embedding would either crash or require a major refactor. Toggle+widget is the right pragmatic compromise.
- **Risk**: The DockBar tests (`nav-surface-parity.test.tsx`, `dock-active-parity.test.ts`) may fail if the dock is hidden globally. Either (a) update them to assert dock is hidden, or (b) leave them — they test the component's render parity, not whether AppLayout mounts it. They'll still pass since DockBar.tsx itself is unchanged.
- **Risk**: Removing `pb-32` could surface FAB-overlap issues on pages that assumed dock was there. Quick visual check after build.
