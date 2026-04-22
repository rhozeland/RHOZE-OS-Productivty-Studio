

## Fix: Hub Feed empty-looking carousel

### Problem
The Hub Feed carousel on the Home (Dashboard) page renders listings without cover images using a near-blank gradient + a faded shopping bag icon. With short titles like "Music Production" and no creator avatar attached, the whole card reads as broken or unstyled — exactly what your screenshot shows.

### Two fixes (do both)

**1. Make the image-less fallback look intentional, not broken**
Replace the washed-out gradient + faded ShoppingBag with a proper editorial placeholder:
- Use a richer branded gradient (primary → accent at higher opacity, or a deterministic per-listing gradient seeded from the listing id so each card looks unique)
- Drop the shopping bag icon entirely — replace with a large, low-opacity display-font glyph of the category initial (e.g. big "D" for Design) OR the Rhozeland rose mark watermark
- Add a subtle noise/grain texture overlay so it reads as a designed cover, not a missing asset

**2. Fix the foreground content so the card always feels populated**
- Always render the creator row (avatar + name) — if `creatorProfile` is missing, show a neutral skeleton avatar + "Rhozeland Creator" instead of hiding the whole row
- Add a 1-line description/excerpt below the title (truncated) pulled from `currentListing.description` so the card has body content
- Show price in $RHOZE OR USD (whichever exists) — currently only renders when `credits_price` is set
- Slightly reduce card height (`h-48` → `h-44`) so it feels tighter when content is light

### Optional polish
- Auto-advance the slideshow every 6s (pause on hover) so a single static empty-looking card isn't the only thing the user sees
- If ALL visible listings lack covers, surface a small dev-only hint in the card footer ("Add a cover image to your listing") — but only for the listing's own creator

### Files touched
- `src/pages/DashboardPage.tsx` — `renderHubSection` function (lines ~430-545) only

No DB, no schema, no new dependencies. Pure presentational fix.

