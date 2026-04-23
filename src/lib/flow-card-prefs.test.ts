import { describe, it, expect } from "vitest";
import {
  badgeColorClassFor,
  badgePlacementClassFor,
  DEFAULT_FLOW_CARD_PREFS,
  parseFlowCardPrefs,
} from "./flow-card-prefs";

describe("parseFlowCardPrefs", () => {
  it("returns defaults for null/undefined/non-object input", () => {
    expect(parseFlowCardPrefs(null)).toEqual(DEFAULT_FLOW_CARD_PREFS);
    expect(parseFlowCardPrefs(undefined)).toEqual(DEFAULT_FLOW_CARD_PREFS);
    expect(parseFlowCardPrefs("garbage")).toEqual(DEFAULT_FLOW_CARD_PREFS);
  });

  it("falls back per-field when individual entries are invalid", () => {
    const parsed = parseFlowCardPrefs({
      badgeColor: "not-a-real-preset",
      badgePlacement: "top-left",
      badgeVisible: "yes", // wrong type
    });
    expect(parsed.badgeColor).toBe(DEFAULT_FLOW_CARD_PREFS.badgeColor);
    expect(parsed.badgePlacement).toBe("top-left");
    expect(parsed.badgeVisible).toBe(DEFAULT_FLOW_CARD_PREFS.badgeVisible);
  });

  it("preserves valid full prefs", () => {
    const parsed = parseFlowCardPrefs({
      badgeColor: "primary",
      badgePlacement: "bottom-right",
      badgeVisible: false,
    });
    expect(parsed).toEqual({
      badgeColor: "primary",
      badgePlacement: "bottom-right",
      badgeVisible: false,
    });
  });
});

describe("badgeColorClassFor", () => {
  it("delegates to the per-category fallback when preset is 'category'", () => {
    expect(badgeColorClassFor("category", "bg-pink/15 text-pink")).toBe(
      "bg-pink/15 text-pink",
    );
  });

  it("returns semantic-token classes for every other preset", () => {
    // Sanity: no preset should produce raw hex or empty output.
    for (const preset of ["primary", "accent", "muted", "destructive", "foreground"] as const) {
      const cls = badgeColorClassFor(preset, "ignored");
      expect(cls.length).toBeGreaterThan(0);
      expect(cls).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });
});

describe("badgePlacementClassFor", () => {
  it("returns an absolute wrapper class for each corner", () => {
    for (const p of ["top-left", "top-right", "bottom-left", "bottom-right"] as const) {
      expect(badgePlacementClassFor(p)).toMatch(/^absolute /);
    }
  });

  it("returns an empty string for inline (no absolute wrapper needed)", () => {
    expect(badgePlacementClassFor("inline")).toBe("");
  });
});
