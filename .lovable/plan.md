

## Plan: Add Visual Fee Breakdown to Revenue Sharing Deep-Dive Card

### What
Add a horizontal bar chart and percentage breakdown inside the existing "Revenue Sharing" deep-dive pillar card, visually showing the split between creator earnings, curator share, and buyback pool.

### Where
`src/pages/CreditShopPage.tsx` — Extend the Revenue Sharing pillar card (around line 488-498) to include a visual breakdown below the existing bullet points.

### Design

After the existing `<ul>` of bullet points, add:

1. **Horizontal stacked bar** — A single rounded bar split into three colored segments:
   - Creator (75%) — green
   - Curator (15%) — blue  
   - Buyback Pool (10%) — amber/gold

2. **Legend row** — Three labeled items below the bar showing icon, label, percentage, and a one-line description.

Uses the same `motion.div` animation pattern and existing color/spacing conventions. No new dependencies.

### Files Changed
- `src/pages/CreditShopPage.tsx` — Add ~30 lines of JSX inside the Revenue Sharing pillar card, after the bullet list.

