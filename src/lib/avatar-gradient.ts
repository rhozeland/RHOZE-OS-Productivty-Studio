/**
 * avatar-gradient — deterministic 3-color HSL gradient per identity.
 *
 * Used as a never-empty fallback wherever a profile lacks a banner or
 * recent visual work. The gradient is derived from a stable hash of the
 * user_id (or any string seed) so the same artist always renders the same
 * colors across sessions and devices. Editorial palette only — saturations
 * and lightness clamped so it never clashes with the rest of the UI.
 */

const hashString = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export interface AvatarGradient {
  /** Ready-to-use CSS background value with two radial gradients + base layer. */
  background: string;
  /** The three core hues (degrees, 0-360) — exposed for accents/borders. */
  hues: [number, number, number];
}

export const avatarGradientFor = (seed?: string | null): AvatarGradient => {
  const safe = seed && seed.length > 0 ? seed : "rhozeland-default";
  const h = hashString(safe);

  const base = h % 360;
  const second = (base + 38 + ((h >> 8) % 60)) % 360;
  const third = (base + 200 + ((h >> 16) % 80)) % 360;

  // Two soft radial blobs over a tinted base — keeps the editorial feel
  // and reads well over both light and dark surfaces.
  const background =
    `radial-gradient(circle at 22% 28%, hsl(${base} 78% 70% / 0.55), transparent 48%),` +
    `radial-gradient(circle at 78% 30%, hsl(${second} 72% 66% / 0.5), transparent 52%),` +
    `radial-gradient(circle at 50% 90%, hsl(${third} 60% 38% / 0.55), transparent 60%),` +
    `linear-gradient(135deg, hsl(${base} 40% 22%), hsl(${third} 45% 14%))`;

  return { background, hues: [base, second, third] };
};
