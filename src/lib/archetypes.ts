/**
 * Music archetypes (v11)
 *
 * Rhozeland's atomic unit is a musician. The five archetypes describe how
 * someone shows up around music:
 *
 *   - Musician  — singer, rapper, producer-of-records, band, DJ (the artist)
 *   - Producer  — beats, production, composition
 *   - Engineer  — mix / master / live sound
 *   - Visual    — videographer, photographer, designer, AD
 *   - Promoter  — manager, promoter, curator, A&R, label
 *
 * Color coding flows through Discover filters, profile chips, and banner
 * fallbacks via CSS tokens defined in `index.css`.
 */
import type { LucideIcon } from "lucide-react";
import { Mic, Music4, SlidersHorizontal, Camera, Megaphone, Users } from "lucide-react";

export type Archetype = "musician" | "producer" | "engineer" | "visual" | "promoter";

export interface ArchetypeMeta {
  id: Archetype;
  label: string;
  /** Plural noun for filter pills ("Musicians") */
  plural: string;
  /** One-liner shown in tooltips / settings picker */
  tagline: string;
  icon: LucideIcon;
  /** Tailwind classes — tinted background + text for chips/pills */
  chipClass: string;
  /** Tailwind class — solid dot color */
  dotClass: string;
  /** CSS token name (without leading --) — for inline color styles */
  token: string;
}

const meta = (
  id: Archetype,
  label: string,
  plural: string,
  tagline: string,
  icon: LucideIcon,
): ArchetypeMeta => {
  const token = `archetype-${id}`;
  return {
    id,
    label,
    plural,
    tagline,
    icon,
    chipClass: `bg-[hsl(var(--${token})/0.16)] text-[hsl(var(--${token}))] border-[hsl(var(--${token})/0.35)]`,
    dotClass: `bg-[hsl(var(--${token}))]`,
    token,
  };
};

export const ARCHETYPES: ArchetypeMeta[] = [
  meta("musician", "Musician", "Musicians", "Singer, rapper, band, DJ — the artist.", Mic),
  meta("producer", "Producer", "Producers", "Beats, production, composition.", Music4),
  meta("engineer", "Engineer", "Engineers", "Mix, master, live sound.", SlidersHorizontal),
  meta("visual", "Visual", "Visuals", "Video, photo, design, art direction.", Camera),
  meta("promoter", "Promoter", "Promoters", "Manager, promoter, curator, A&R.", Megaphone),
];

export const ARCHETYPE_BY_ID = new Map<Archetype, ArchetypeMeta>(
  ARCHETYPES.map((a) => [a.id, a]),
);

/** Legacy v9 → v11 migration helper for any client-side data still using old keys. */
const LEGACY_MAP: Record<string, Archetype> = {
  artist: "musician",
  builder: "producer",
  influencer: "promoter",
};
export const normalizeArchetype = (raw?: string | null): Archetype | null => {
  if (!raw) return null;
  if (raw in LEGACY_MAP) return LEGACY_MAP[raw];
  return ARCHETYPE_BY_ID.has(raw as Archetype) ? (raw as Archetype) : null;
};

export const CREATOR_UMBRELLA = {
  label: "Music",
  plural: "Artists",
  icon: Users,
};

/**
 * Deterministic archetype-tinted banner gradient.
 *
 * Used as the *default* banner whenever a creator hasn't picked a custom one,
 * so even minimum-effort profiles look intentional instead of falling back to
 * the generic gray. Seed (usually `user_id`) decides the secondary hue offset
 * so two creators don't end up with identical banners.
 */
export function archetypeBannerGradient(
  archetype: Archetype | string | null | undefined,
  seed?: string | null,
): string {
  const id = normalizeArchetype(archetype ?? null);
  const token = id ? `archetype-${id}` : "primary";
  const s = seed ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  const angle = 110 + (h % 70); // 110°–180°
  const accentHue = (h + 40) % 360;
  return `linear-gradient(${angle}deg, hsl(var(--${token}) / 0.85) 0%, hsl(var(--${token}) / 0.55) 35%, hsl(${accentHue} 70% 60% / 0.45) 75%, hsl(var(--card)) 100%)`;
}
