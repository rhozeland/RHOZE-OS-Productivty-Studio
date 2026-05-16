/**
 * Rhozeland gradient palette — single source of truth.
 *
 * Pulled from the official Rhozeland brand site (mint 170 · pink 300 ·
 * lavender 260 · peach 20) and extended with the in-app accents
 * (fuchsia 292 · amber 38 · rose 330 · sky 200) so the same warm/pastel
 * family carries from the marketing site into the app.
 *
 * One colourway is picked per UTC day → the platform gets a fresh
 * personality every morning while still reading as Rhozeland.
 */

export type RhozeGradient = {
  /** Stable id (used for keys / debugging) */
  id: string;
  /** Display name */
  name: string;
  /** Vivid 3-stop linear gradient — for headlines, active pills, accents */
  text: string;
  /** Pastel multi-radial — for canvas backgrounds (behind globe, hero) */
  surface: string;
  /** Soft glow halo — sits behind floating UI (dock, FAB) */
  halo: string;
  /** Tailwind-style stop trio for arbitrary 3-stop linears */
  stops: [string, string, string];
};

/** Helper — build a 3-stop linear given hsl triples. */
const linear = (a: string, b: string, c: string, angle = 135) =>
  `linear-gradient(${angle}deg, hsl(${a}), hsl(${b}), hsl(${c}))`;

/** Helper — soft pastel surface (low-saturation radial wash). */
const surface = (a: string, b: string, c: string) =>
  [
    `radial-gradient(ellipse 60% 50% at 20% 25%, hsl(${a} / 0.45) 0%, transparent 60%)`,
    `radial-gradient(ellipse 55% 50% at 80% 30%, hsl(${b} / 0.40) 0%, transparent 60%)`,
    `radial-gradient(ellipse 60% 55% at 50% 85%, hsl(${c} / 0.35) 0%, transparent 65%)`,
    `linear-gradient(180deg, hsl(0 0% 100% / 0.04), hsl(0 0% 100% / 0))`,
  ].join(",");

const halo = (a: string, b: string, c: string) =>
  `linear-gradient(90deg, hsl(${a} / 0.45), hsl(${b} / 0.45), hsl(${c} / 0.45))`;

export const RHOZE_GRADIENTS: RhozeGradient[] = [
  {
    id: "bloom",
    name: "Bloom",
    stops: ["330 81% 60%", "292 84% 61%", "170 60% 55%"],
    text: linear("330 81% 60%", "292 84% 61%", "170 60% 55%"),
    surface: surface("300 60% 80%", "260 50% 85%", "170 50% 80%"),
    halo: halo("330 81% 60%", "292 84% 61%", "170 60% 55%"),
  },
  {
    id: "sunrise",
    name: "Sunrise",
    stops: ["20 90% 65%", "330 81% 60%", "260 50% 70%"],
    text: linear("20 90% 65%", "330 81% 60%", "260 50% 70%"),
    surface: surface("20 80% 82%", "330 70% 85%", "260 50% 85%"),
    halo: halo("20 90% 65%", "330 81% 60%", "260 50% 70%"),
  },
  {
    id: "mint-fizz",
    name: "Mint Fizz",
    stops: ["170 60% 55%", "200 75% 60%", "260 50% 70%"],
    text: linear("170 60% 55%", "200 75% 60%", "260 50% 70%"),
    surface: surface("170 60% 80%", "200 70% 82%", "260 40% 85%"),
    halo: halo("170 60% 55%", "200 75% 60%", "260 50% 70%"),
  },
  {
    id: "pastel-drift",
    name: "Pastel Drift",
    stops: ["260 50% 70%", "300 60% 70%", "20 90% 70%"],
    text: linear("260 50% 70%", "300 60% 70%", "20 90% 70%"),
    surface: surface("260 50% 85%", "300 60% 85%", "20 80% 85%"),
    halo: halo("260 50% 70%", "300 60% 70%", "20 90% 70%"),
  },
  {
    id: "aurora",
    name: "Aurora",
    stops: ["170 60% 55%", "292 84% 61%", "38 92% 55%"],
    text: linear("170 60% 55%", "292 84% 61%", "38 92% 55%"),
    surface: surface("170 50% 80%", "292 60% 82%", "38 80% 82%"),
    halo: halo("170 60% 55%", "292 84% 61%", "38 92% 55%"),
  },
];

/**
 * Pick today's gradient deterministically based on UTC day-of-year so it
 * rotates exactly once per day across all clients. Manual override via
 * VITE_RHOZE_GRADIENT (id) for testing.
 */
export const todayGradient = (): RhozeGradient => {
  const override = (import.meta as any).env?.VITE_RHOZE_GRADIENT as string | undefined;
  if (override) {
    const hit = RHOZE_GRADIENTS.find((g) => g.id === override);
    if (hit) return hit;
  }
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start;
  const doy = Math.floor(diff / 86_400_000);
  return RHOZE_GRADIENTS[doy % RHOZE_GRADIENTS.length];
};

/** Stable lookup by id (e.g. for storybook / settings overrides). */
export const gradientById = (id: string) =>
  RHOZE_GRADIENTS.find((g) => g.id === id) ?? RHOZE_GRADIENTS[0];
