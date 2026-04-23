

# Investor Deck — Rhozeland (Solana Incubator Cohort 5)

A 12-slide PDF deck tailored for the Solana Labs team, in the editorial B&W + aurora aesthetic that matches `rhozeland.app`. Pre-launch placeholders for traction/revenue/raise so you can edit before submitting.

## Deck structure (12 slides)

```text
01  Cover               — Rhozeland wordmark, aurora bloom, tagline
02  Problem             — Creative work is invisible; reputation lives in screenshots
03  Solution            — Decentralized productivity studio anchored on Solana
04  Product             — Flow Mode · Smartboards · Drop Rooms · Creator Pass
05  How it uses Solana  — Anchor memos, gas-sponsored contributions, $RHOZE utility
06  $RHOZE Economy      — 75/15/10 split, Admin Reward Gate, Creator Pass tiers
07  Market              — Creator economy + on-chain reputation TAM
08  Founder–Market Fit  — 2016 collective → 2020 Inc. → 2025 decentralized studio
09  Traction            — Live in production, pre-revenue [placeholders]
10  Competition         — vs. Patreon / Behance / Farcaster / Drip
11  Path to $10M ARR    — Creator Pass subs + 10% platform fee on paid projects
12  Ask & Vision        — Why Solana Labs, NYC relocation, what we need
```

## Visual system

- Background: deep black `#0A0A0A` with a soft animated-feel aurora gradient (purple → rose → cyan) baked as a static radial blur on each slide corner.
- Typography: Inter Bold for wordmark + slide titles (44–60pt), Inter Regular for body (16–18pt). Tight tracking on the wordmark per brand memory.
- Accent: rose gradient hairline rules and a single rose bloom motif on cover + closing slides.
- Layout: generous negative space, left-aligned body, 0.6" margins. One visual element per slide (stat callout, two-column, or icon row).
- Footer: small "Rhozeland · Solana Incubator Cohort 5 · 2026" right-aligned, page number left.

## Content sourcing

I'll pull verified facts from project memory: $RHOZE 75/15/10 split, Admin Reward Gate, Anchor contribution memos, Creator Pass Bloom/Glow/Play tiers, Flow Mode / Smartboards / Drop Rooms (LiveKit, 24h max), Supabase + Square + Solana JSON-RPC stack, founder timeline (2016 → 2020 → 2025).

Placeholders (clearly bracketed `[TBD]` so you can find and edit):
- Slide 9: active users, 6-mo growth, MRR
- Slide 11: pricing assumptions for the $10M math (I'll model two scenarios you can adjust)
- Slide 12: amount/terms of any raise to date

## Technical approach

1. Generate the PDF with **ReportLab** (Platypus) using a custom canvas for the aurora background and rose hairlines — gives precise control over the editorial layout and runs in the sandbox without browser dependencies.
2. Embed Inter (already used on-site) via Google Fonts TTF download.
3. Write to `/mnt/documents/rhozeland-investor-deck.pdf`.
4. Mandatory QA pass: render every page to JPG with `pdftoppm -r 150`, inspect each one for overflow / overlap / contrast / placeholder leftovers, fix and re-render until a full clean pass. Summarize QA findings in the final reply.
5. Deliver via `<lov-artifact>` so you can preview/download in one click.

## What you'll get back

- `rhozeland-investor-deck.pdf` — 12 pages, landscape 16:9, ready to attach to the Solana Incubator application URL field.
- A short summary of which slides contain `[TBD]` placeholders so you know exactly what to edit before submitting.
- Offer to also generate a matching 1-slide "teaser" cover image (PNG) for the application's intro video thumbnail, if useful.

