export const COLOR_PRESETS = [
  { name: "Coral", value: "#FF6B6B" },
  { name: "Amber", value: "#FFB347" },
  { name: "Lemon", value: "#FFE066" },
  { name: "Mint", value: "#6BCB77" },
  { name: "Sky", value: "#4ECDC4" },
  { name: "Ocean", value: "#45B7D1" },
  { name: "Indigo", value: "#7C83FD" },
  { name: "Violet", value: "#A66CFF" },
  { name: "Rose", value: "#F472B6" },
  { name: "Blush", value: "#FDA4AF" },
  { name: "Slate", value: "#94A3B8" },
  { name: "Charcoal", value: "#374151" },
  { name: "Snow", value: "#F8FAFC" },
  { name: "Peach", value: "#FBBF77" },
  { name: "Lavender", value: "#C4B5FD" },
  { name: "Teal", value: "#2DD4BF" },
];

export const GRADIENT_PRESETS = [
  { name: "Sunset", from: "#FF6B6B", to: "#FFB347" },
  { name: "Ocean", from: "#45B7D1", to: "#7C83FD" },
  { name: "Forest", from: "#6BCB77", to: "#2DD4BF" },
  { name: "Berry", from: "#A66CFF", to: "#F472B6" },
  { name: "Fire", from: "#FFB347", to: "#FF6B6B" },
  { name: "Arctic", from: "#4ECDC4", to: "#94A3B8" },
  { name: "Dusk", from: "#7C83FD", to: "#374151" },
  { name: "Candy", from: "#FDA4AF", to: "#C4B5FD" },
  { name: "Gold", from: "#FFE066", to: "#FFB347" },
  { name: "Neon", from: "#6BCB77", to: "#45B7D1" },
  { name: "Plum", from: "#A66CFF", to: "#374151" },
  { name: "Dawn", from: "#FBBF77", to: "#F472B6" },
];

export const PATTERN_PRESETS = [
  { name: "None", id: "none" },
  { name: "Dots", id: "dots" },
  { name: "Stripes", id: "stripes" },
  { name: "Cross", id: "cross" },
  { name: "Waves", id: "waves" },
  { name: "Grid", id: "grid" },
] as const;

export const BACKGROUND_PRESETS = [
  { name: "None", value: "transparent" },
  { name: "White", value: "#FFFFFF" },
  { name: "Cream", value: "#FFF8F0" },
  { name: "Smoke", value: "#F1F5F9" },
  { name: "Midnight", value: "#1E293B" },
  { name: "Ink", value: "#0F172A" },
  { name: "Blush", value: "#FFF1F2" },
  { name: "Mint", value: "#F0FDFA" },
];

export type FillMode = "solid" | "gradient" | "pattern";
export type PatternId = typeof PATTERN_PRESETS[number]["id"];

export interface SectionFill {
  mode: FillMode;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  pattern: PatternId;
  patternColor: string;
}

export type SectionKey = "boxFront" | "boxLid" | "tag";

export const DEFAULT_FILL: SectionFill = {
  mode: "solid",
  color: "#FFFFFF",
  gradientFrom: "#FF6B6B",
  gradientTo: "#FFB347",
  pattern: "none",
  patternColor: "#00000020",
};

export const DEFAULT_FILLS: Record<SectionKey, SectionFill> = {
  boxFront: { ...DEFAULT_FILL },
  boxLid: { ...DEFAULT_FILL },
  tag: { ...DEFAULT_FILL },
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  boxFront: "Box Front",
  boxLid: "Box Lid",
  tag: "Tag",
};
