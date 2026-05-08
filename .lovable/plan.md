# Three-Room Restructure

Reorganize Rhozeland into three "Rooms" via a permanent bottom nav, plus a role-based onboarding step that routes Creators → Market and Investors → Scene. **No features are removed** — every existing route stays mounted; the Rooms are organizing front doors that link into them.

## Room mapping (existing routes preserved)

**Room 1 — THE SCENE** (Social / Discovery)
- Front door: `/scene` (new) → renders the existing Discover layout (globe + featured + Stream + Flow toggle)
- Links into: `/discover`, `/flow`, `/stream`, `/people`, `/profiles`, `/creators`

**Room 2 — THE MARKET** (Work / Utility)
- Front door: `/market` (new) → existing MarketplacePage content (mosaic with Drops · Offerings · Events · Spaces) + quick links to studios, services, projects
- Links into: `/marketplace`, `/spaces`, `/studios`, `/services`, `/projects`, `/bookings`, `/calendar`, `/messages`

**Room 3 — THE VAULT** (Finance / Growth)
- Front door: `/vault` (new) → portfolio dashboard pulling existing components: `RhozeBalanceChip`, `WithdrawalPanel`, coin holdings, purchases, credits/rewards
- Links into: `/credits`, `/purchases`, `/seller-dashboard`, `/swap-history`, profile Coin tab

## Implementation

### 1. Bottom nav bar (new)
New component `src/components/RoomsBottomNav.tsx` — fixed bottom, 3 large tabs (Scene · Market · Vault) with icons (Sparkles, Store, Coins). Mounted in `AppLayout.tsx` for authenticated users. Active state by route prefix. Mobile-first, but visible on all breakpoints (similar to existing DockBar styling, but always visible, three items only).

### 2. Three Room pages (new)
- `src/pages/SceneRoomPage.tsx` — renders `<DiscoverPage />` content (or re-exports it), header chip "THE SCENE".
- `src/pages/MarketRoomPage.tsx` — renders `<MarketplacePage />` content with header chip "THE MARKET".
- `src/pages/VaultRoomPage.tsx` — composes existing finance widgets: balance chip, credits summary, purchases link, withdrawal panel, swap history link, "Your coins" section.

Each Room page is a thin wrapper — no business logic moved, just composition.

### 3. Routes (App.tsx)
Add `/scene`, `/market`, `/vault` routes. Keep all existing routes intact.

### 4. Navigation config
Add three Room entries to `src/config/navigation.ts` so they're recognized. Don't change DEFAULT_DOCK_IDS yet.

### 5. Role-based onboarding
Add a new step to `WelcomeModal.tsx` (after username, before tour): "Are you here to **Create** or **Invest**?" — two large cards. Selection is saved to `profiles.primary_role` ('creator' | 'investor') via existing profiles update pattern. After onboarding completes:
- Creator → navigate to `/market`
- Investor → navigate to `/scene`

### 6. Database
Migration: add `primary_role text` column to `profiles` (nullable, no constraint — values 'creator' | 'investor').

## Technical notes
- Bottom nav uses `position: fixed; bottom: 0` with safe-area-inset padding; adds `pb-20` spacer to AppLayout main when present.
- Room pages reuse existing page components by importing and rendering them — zero duplication.
- Onboarding role choice stored both in modal state (immediate redirect) and persisted to profile (future personalization).
- Existing DockBar stays hidden (per memory: bottom dock currently hidden). The new Rooms bar is the replacement.

## Out of scope
- Renaming/removing existing routes
- Moving feature implementations between files
- Changing the side nav (AppSidebar) — Rooms are additive
