# Rhozeland Pitch Decks — 4 Versions

Generate **4 separate .pptx files**, all 16:9 at 1920×1080, editable in Google Slides, matching the live app aesthetic (high-contrast B&W editorial, glassmorphism, Inter, $RHOZE accents). Built with `pptxgenjs` so every text box, shape, and image is fully editable after import to Google Slides.

## The 4 decks

| # | File | Audience | Emphasis |
|---|------|----------|----------|
| 1 | `rhozeland-investors-vc.pptx` | Investors / VCs / Solana Hackathon / Pump.fun | **Creator OS** product-led; Rhozeland Studio mentioned light |
| 2 | `rhozeland-partners-artists.pptx` | Partners + Artists | Same scope, reframed: "Own your audience, monetize your IP" |
| 3 | `rhozeland-general.pptx` | General / mixed audience | Balanced — Rhozeland Studio (production house) + Creator OS (app + $RHOZE credits) equally |
| 4 | `rhozeland-investors-studio.pptx` | Investors with studio focus | Investor framing but heavier weight on Rhozeland Studio (production → distribution flywheel) |

## Shared 15-slide structure

1. **Intro** — Wordmark, one-liner, Michael Lé Founder + PFP
2. **Problem**
3. **Value Proposition**
4. **Main Features** (app screenshots)
5. **Demo** (annotated screenshot walkthrough)
6. **Market** (TAM/SAM/SOM with researched numbers)
7. **Competition** (matrix: Patreon, Pump.fun, Bags.fm, Sound.xyz, Bandcamp)
8. **Business Model** — tier-based platform fee (Spark/Bloom 15% · Glow 10% · Play 7%) + coin launch fee + $RHOZE economy
9. **Traction** — Nomu-style colored card grid (the design from screenshot 3)
10. **Growth Strategy** — Studio→Content→Distribution flywheel: Rhozeland Studio produces for artists → app distributes → community + $RHOZE rewards drive retention. 3 solid channels (artist partnerships, Solana ecosystem co-marketing, IRL events / Spaces hosts)
11. **Roadmap** — Q-based timeline pulled from whitepaper/memory (Verified IP live → on-chain launchpad → Studio collabs → token-gated drops)
12. **Team** — 4–5 placeholder cards: name + role + "killer fact"
13. **The Ask** (investor decks) / **The Offer** (partners deck)
14. **Call-to-Action** — QR to app + $RHOZE signup reward + contact
15. **Thank You** — wordmark close

Per-audience slides swap framing (e.g. deck 2 replaces "Ask" with partnership tiers; deck 3 adds a Studio-vs-OS architecture slide; deck 4 adds a Studio P&L / production capacity slide).

## Design system (all decks)

- **Palette:** near-black `#0A0A0A` bg / off-white `#F5F3EE` content / $RHOZE accent `#FF4D8B` (or app's pink-amber gradient)
- **Type:** Inter (Bold for display, Regular for body) — universally available in Google Slides
- **Motif:** thin top-left wordmark + page number bottom-right; one bold accent shape per slide; Nomu-style rounded card grid for traction
- **Sandwich:** dark intro/closer, light content slides

## Technical approach

1. Use the `pptx` skill (`pptxgenjs`) — full editability in Google Slides preserved
2. Pull live app screenshots from preview URL (Discover, Profile, Creator Pass, Flow, Project Vault) embedded as base64
3. Generate one `buildDeck(audience)` builder + 4 thin config files
4. Output to `/mnt/documents/`
5. **Mandatory QA:** Convert each deck to PDF via LibreOffice → render every slide to JPG → inspect for clipping, overlap, contrast, leftover placeholders → fix → re-render until clean
6. Deliver via `<lov-artifact>` tags

## Open questions before I build

- **Roadmap quarters** — should I anchor to Q2 2026 (now) → Q4 2026 / Q1–Q2 2027 with milestones I infer from memory (Verified IP shipped, on-chain Launchpad next, Studio collabs, etc.)? Or do you have specific milestones to lock in?
- **The Ask** (deck 1 & 4) — raise amount + use of funds? If unknown I'll use clearly-marked placeholders (`[$X.XM seed]`, `40% product / 30% studio / 20% growth / 10% ops`) so you can edit.
- **Team placeholders** — 4 or 5 cards? I'll use Michael Lé (Founder) + 4 `[Name — Role]` slots with placeholder "killer fact" lines.
- **Contact** — for the CTA slide: telegram handle / email / app URL. I'll use `rhozeland.app` + `[contact placeholder]` if not provided.

I can proceed with sensible placeholders for all of the above (since the whole point is editability) — just confirm "go" or answer any of the four and I'll build all 4 decks in one pass.
