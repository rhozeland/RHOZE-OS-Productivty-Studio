/**
 * Flow Mode card customization preferences.
 * ─────────────────────────────────────────────────────────────────────────
 * Pure helpers + storage I/O for user-configurable Flow card visuals.
 *
 * Today this only covers the *category* badge (color preset + corner
 * placement + visibility), but the module is structured so future card
 * customization can land here without touching the renderer.
 *
 * Persistence is localStorage-only by design: the dock customizer follows
 * the same pattern, no DB migration is required, and the choice is
 * inherently device-flavored UI chrome rather than account state.
 */

export const BADGE_COLOR_PRESETS = [
  // The keys are the *user-facing* preset ids and double as the
  // discriminator the renderer uses to pick semantic token classes.
  // Every preset MUST resolve to design-system tokens (no raw hex) so
  // light/dark mode and theme overrides keep working.
  { id: "category", label: "Category color", hint: "Default — colored per category" },
  { id: "primary", label: "Primary", hint: "Brand primary" },
  { id: "accent", label: "Accent", hint: "Soft accent" },
  { id: "muted", label: "Subtle", hint: "Low-key, neutral" },
  { id: "destructive", label: "Bold", hint: "High-attention" },
  { id: "foreground", label: "Mono", hint: "Monochrome contrast" },
] as const;

export type BadgeColorPresetId =
  (typeof BADGE_COLOR_PRESETS)[number]["id"];

export const BADGE_PLACEMENTS = [
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "inline", label: "Inline (with actions)" },
] as const;

export type BadgePlacementId = (typeof BADGE_PLACEMENTS)[number]["id"];

export interface FlowCardPrefs {
  badgeColor: BadgeColorPresetId;
  badgePlacement: BadgePlacementId;
  badgeVisible: boolean;
}

export const DEFAULT_FLOW_CARD_PREFS: FlowCardPrefs = {
  badgeColor: "category",
  badgePlacement: "inline",
  badgeVisible: true,
};

const STORAGE_KEY = "flow-card-prefs";

const isPresetId = (v: unknown): v is BadgeColorPresetId =>
  typeof v === "string" &&
  BADGE_COLOR_PRESETS.some((p) => p.id === v);

const isPlacementId = (v: unknown): v is BadgePlacementId =>
  typeof v === "string" &&
  BADGE_PLACEMENTS.some((p) => p.id === v);

/**
 * Parse a stored prefs blob, falling back to defaults for any field that
 * is missing, malformed, or has been removed in a later version. Always
 * returns a valid `FlowCardPrefs` so callers never have to null-check.
 */
export const parseFlowCardPrefs = (raw: unknown): FlowCardPrefs => {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FLOW_CARD_PREFS };
  const obj = raw as Record<string, unknown>;
  return {
    badgeColor: isPresetId(obj.badgeColor)
      ? obj.badgeColor
      : DEFAULT_FLOW_CARD_PREFS.badgeColor,
    badgePlacement: isPlacementId(obj.badgePlacement)
      ? obj.badgePlacement
      : DEFAULT_FLOW_CARD_PREFS.badgePlacement,
    badgeVisible:
      typeof obj.badgeVisible === "boolean"
        ? obj.badgeVisible
        : DEFAULT_FLOW_CARD_PREFS.badgeVisible,
  };
};

export const loadFlowCardPrefs = (): FlowCardPrefs => {
  if (typeof window === "undefined") return { ...DEFAULT_FLOW_CARD_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLOW_CARD_PREFS };
    return parseFlowCardPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FLOW_CARD_PREFS };
  }
};

export const saveFlowCardPrefs = (prefs: FlowCardPrefs): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    // Notify other tabs/components in the same tab. The native `storage`
    // event only fires cross-tab, so we dispatch a custom event for the
    // FlowCard subscriber in the current tab.
    window.dispatchEvent(new CustomEvent("flow-card-prefs-changed"));
  } catch {
    // Quota or privacy mode — silently ignore; UI keeps working with the
    // in-memory prefs for the current session.
  }
};

/**
 * Tailwind classes for each color preset, keyed by preset id. The
 * "category" preset is special: the renderer overlays its own per-category
 * palette and only uses these as a structural shell, so we return only
 * shape classes (no color tokens) for that case.
 */
export const badgeColorClassFor = (
  preset: BadgeColorPresetId,
  /** Per-category fallback class string, used only when preset === "category". */
  categoryFallback: string,
): string => {
  switch (preset) {
    case "category":
      return categoryFallback;
    case "primary":
      return "bg-primary/15 text-primary";
    case "accent":
      return "bg-accent/15 text-accent-foreground";
    case "muted":
      return "bg-muted text-muted-foreground";
    case "destructive":
      return "bg-destructive/15 text-destructive";
    case "foreground":
      return "bg-foreground/10 text-foreground";
  }
};

/**
 * Wrapper positioning classes for the four-corner placements. The badge
 * itself is rendered identically in every case; only the absolute-position
 * shell changes. Returns an empty string for "inline" so the caller can
 * skip the absolute wrapper entirely and render in-flow with the action
 * bar (the legacy layout).
 */
export const badgePlacementClassFor = (
  placement: BadgePlacementId,
): string => {
  switch (placement) {
    case "top-left":
      return "absolute top-3 left-3 z-10";
    case "top-right":
      return "absolute top-3 right-3 z-10";
    case "bottom-left":
      return "absolute bottom-3 left-3 z-10";
    case "bottom-right":
      return "absolute bottom-3 right-3 z-10";
    case "inline":
      return "";
  }
};
