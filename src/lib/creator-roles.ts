/**
 * Creator roles catalog — predefined "what they are" tags.
 *
 * Replaces the old free-form headline (which conflated "what I do" with
 * "what I'm about"). Roles are picked from a curated list so we can match
 * fans to creators, power Discover filters, and avoid spelling drift.
 *
 * v9.4: each role now also exposes a Lucide icon (`iconName` + helper) so
 * Featured Creator tiles can swap the chunky emoji chips for thin editorial
 * icons. Emojis are kept around for legacy surfaces that still use them.
 */
import {
  Headphones,
  Music,
  Palette,
  Pencil,
  Puzzle,
  Camera,
  Clapperboard,
  Box,
  PenLine,
  Shirt,
  Code2,
  Smartphone,
  Disc3,
  Drama,
  type LucideIcon,
} from "lucide-react";

export interface CreatorRole {
  id: string;
  label: string;
  emoji: string;
  /** Lucide icon component used in editorial UI (Featured tiles, etc). */
  Icon: LucideIcon;
  /** Optional sub-categories — e.g. genres for Music Producer. */
  specialties: string[];
}

export const CREATOR_ROLES: CreatorRole[] = [
  {
    id: "music-producer",
    label: "Music Producer",
    emoji: "🎧",
    Icon: Headphones,
    specialties: ["Hip-Hop", "R&B", "Afrobeats", "Pop", "Electronic", "House", "Techno", "Lo-Fi", "Jazz", "Rock", "K-Pop", "Latin", "Soundtrack"],
  },
  {
    id: "musician",
    label: "Musician",
    emoji: "🎵",
    Icon: Music,
    specialties: ["Vocalist", "Rapper", "Guitarist", "Drummer", "Pianist", "Bassist", "DJ", "Composer", "Songwriter"],
  },
  {
    id: "visual-artist",
    label: "Visual Artist",
    emoji: "🎨",
    Icon: Palette,
    specialties: ["Digital", "Oil", "Acrylic", "Watercolor", "Ink", "Mixed Media", "Sculpture", "Street Art", "Collage"],
  },
  {
    id: "illustrator",
    label: "Illustrator",
    emoji: "✏️",
    Icon: Pencil,
    specialties: ["Editorial", "Children's Books", "Comic", "Manga", "Concept Art", "Portrait", "Botanical", "Tattoo Design"],
  },
  {
    id: "designer",
    label: "Designer",
    emoji: "🧩",
    Icon: Puzzle,
    specialties: ["Graphic", "Brand Identity", "Type", "UI/UX", "Web", "Product", "Packaging", "Print", "Editorial"],
  },
  {
    id: "photographer",
    label: "Photographer",
    emoji: "📷",
    Icon: Camera,
    specialties: ["Portrait", "Fashion", "Street", "Documentary", "Landscape", "Wedding", "Product", "Film", "Analog"],
  },
  {
    id: "filmmaker",
    label: "Filmmaker",
    emoji: "🎬",
    Icon: Clapperboard,
    specialties: ["Director", "Cinematographer", "Editor", "Documentary", "Music Video", "Short Film", "Commercial", "Animation"],
  },
  {
    id: "3d-artist",
    label: "3D Artist",
    emoji: "🧊",
    Icon: Box,
    specialties: ["Modeling", "Texturing", "Animation", "Motion", "Game Art", "VFX", "Architectural Viz", "Generative"],
  },
  {
    id: "writer",
    label: "Writer",
    emoji: "✍️",
    Icon: PenLine,
    specialties: ["Fiction", "Poetry", "Essays", "Journalism", "Screenwriting", "Copywriting", "Newsletter", "Lyrics"],
  },
  {
    id: "fashion-designer",
    label: "Fashion Designer",
    emoji: "👗",
    Icon: Shirt,
    specialties: ["Streetwear", "Couture", "Knitwear", "Jewelry", "Accessories", "Sustainable", "Costume"],
  },
  {
    id: "developer",
    label: "Developer",
    emoji: "💻",
    Icon: Code2,
    specialties: ["Frontend", "Backend", "Full-stack", "Mobile", "Web3", "AI/ML", "Game Dev", "Creative Coding"],
  },
  {
    id: "creator",
    label: "Content Creator",
    emoji: "📱",
    Icon: Smartphone,
    specialties: ["Video", "Podcast", "Streaming", "Educational", "Lifestyle", "Comedy", "Reviews"],
  },
  {
    id: "curator",
    label: "Curator",
    emoji: "🪩",
    Icon: Disc3,
    specialties: ["Gallery", "Music", "Editorial", "Festival", "Brand", "Community"],
  },
  {
    id: "performer",
    label: "Performer",
    emoji: "🎭",
    Icon: Drama,
    specialties: ["Actor", "Dancer", "Comedian", "Theater", "Voice Over", "Live Show"],
  },
];

export const ROLE_BY_ID = new Map(CREATOR_ROLES.map((r) => [r.id, r]));

/** Curated skills creators can pick from (cross-discipline). */
export const SKILL_OPTIONS = [
  "Mixing", "Mastering", "Sound Design", "Vocal Production", "Beat Making",
  "Illustration", "Logo Design", "Branding", "Typography", "Layout",
  "Motion Graphics", "3D Modeling", "Animation", "Storyboarding",
  "Lighting", "Color Grading", "Editing", "Directing",
  "Photo Retouching", "Studio Lighting", "Location Scouting",
  "Pattern Making", "Sewing", "Styling",
  "Frontend", "Backend", "Smart Contracts", "AI Prompting",
  "Copywriting", "Storytelling", "Editing", "Strategy",
  "Community", "Production Management", "Casting",
];

/** Resolve a role label given an id (or just return the id if unknown). */
export const labelForRole = (id: string) => ROLE_BY_ID.get(id)?.label ?? id;
export const emojiForRole = (id: string) => ROLE_BY_ID.get(id)?.emoji ?? "";
/** Resolve a role's Lucide icon component. */
export const iconForRole = (id: string): LucideIcon | null =>
  ROLE_BY_ID.get(id)?.Icon ?? null;
