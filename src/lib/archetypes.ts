/**
 * Creator archetypes (v9.2)
 *
 * Everyone on Rhozeland is a **creator** — that's the umbrella. The branches
 * tell other creators *how* you create:
 *
 *   - Artist     — makes the work (music, art, design, writing)
 *   - Builder    — ships the product / space / event (devs, producers, hosts)
 *   - Influencer — amplifies, curates, brings audience
 *
 * Color coding is used as a real design primitive — a single hue per branch
 * surfaces as a subtle dot, border tint, and filter pill across Discover and
 * profile cards. Hues live as CSS tokens in `index.css` so dark / light mode
 * stay consistent.
 */
import type { LucideIcon } from "lucide-react";
import { Palette, Wrench, Megaphone, Users } from "lucide-react";

export type Archetype = "artist" | "builder" | "influencer";

export interface ArchetypeMeta {
  id: Archetype;
  label: string;
  /** Plural noun for filter pills ("Artists") */
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

export const ARCHETYPES: ArchetypeMeta[] = [
  {
    id: "artist",
    label: "Artist",
    plural: "Artists",
    tagline: "Makes the work — music, art, design, writing.",
    icon: Palette,
    chipClass:
      "bg-[hsl(var(--archetype-artist)/0.16)] text-[hsl(var(--archetype-artist))] border-[hsl(var(--archetype-artist)/0.35)]",
    dotClass: "bg-[hsl(var(--archetype-artist))]",
    token: "archetype-artist",
  },
  {
    id: "builder",
    label: "Builder",
    plural: "Builders",
    tagline: "Ships the product, the space, the event.",
    icon: Wrench,
    chipClass:
      "bg-[hsl(var(--archetype-builder)/0.16)] text-[hsl(var(--archetype-builder))] border-[hsl(var(--archetype-builder)/0.35)]",
    dotClass: "bg-[hsl(var(--archetype-builder))]",
    token: "archetype-builder",
  },
  {
    id: "influencer",
    label: "Influencer",
    plural: "Influencers",
    tagline: "Amplifies, curates, brings the audience.",
    icon: Megaphone,
    chipClass:
      "bg-[hsl(var(--archetype-influencer)/0.16)] text-[hsl(var(--archetype-influencer))] border-[hsl(var(--archetype-influencer)/0.35)]",
    dotClass: "bg-[hsl(var(--archetype-influencer))]",
    token: "archetype-influencer",
  },
];

export const ARCHETYPE_BY_ID = new Map<Archetype, ArchetypeMeta>(
  ARCHETYPES.map((a) => [a.id, a]),
);

export const CREATOR_UMBRELLA = {
  label: "Creator",
  plural: "Creators",
  icon: Users,
};
