# 4 Step Visuals — Editorial 3D Objects

Generate one premium 3D-rendered object per step as a transparent PNG, sized for slide use (1024×1024, square). The brand palette stays consistent: soft cream/off-white surfaces, hot-pink (#EC4899) accents, amber highlights, subtle chrome — matching the existing deck visuals. Each render is a single hero object floating on a fully transparent background (no card, no shadow plate, no text baked in).

## The 4 visuals

**01 — Get verified**
A glossy ceramic-pink verification badge: rounded shield/seal with an embossed checkmark and a thin gold rim. Soft studio lighting, subtle subsurface glow. Conveys identity + trust.

**02 — Upload creations**
A levitating cream-white folder/document object with a faint pink hash pattern emerging from its edge into floating glyph particles, and a tiny chrome anchor pinning it. Conveys "hash & anchor IP."

**03 — Open economy**
A small editorial 3D storefront/kiosk pavilion in cream + pink, with miniature floating tags (ticket, coin, key) orbiting it. Conveys multi-format selling (access, coins, tickets, services).

**04 — Hold & earn**
A stack of glossy pink coins with a single $RHOZE coin tilting on top, a soft amber bloom behind it, hinting upward growth. Conveys accumulation + tier progression.

## Style rules (applied to all 4)

- Premium editorial 3D render (Octane / KeyShot vibe), matte-to-glossy mix
- Palette: cream (#F8F4EE), hot pink (#EC4899), soft amber (#F5C76A), warm white highlights, charcoal micro-details
- Single object centered, ~70% of frame, generous breathing room
- Fully transparent background (PNG alpha) — no shadow plate, no card, no text
- Consistent camera angle (~15° above, slight 3/4 turn) and lighting across all 4 so they read as a set

## Files

Saved as transparent PNGs in `src/assets/`:
- `src/assets/deck-step-01-verified.png`
- `src/assets/deck-step-02-upload.png`
- `src/assets/deck-step-03-economy.png`
- `src/assets/deck-step-04-hold-earn.png`

Generated with the `premium` model (best fidelity for sculptural/3D + clean alpha cutouts), `transparent_background: true`, 1024×1024.

## Delivery

After generation I'll QA each one (inspect for clean alpha edges, color consistency across the set, no baked-in shadows or text artifacts) and re-roll any that don't match. Then I'll list the 4 file paths so you can drop them straight into the deck in place of the current 01–04 cards. No code/UI changes in the app — these are deck assets only.
