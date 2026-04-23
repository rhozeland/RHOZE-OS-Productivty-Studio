import { describe, it, expect } from "vitest";
import {
  isValidNavId,
  partitionDockIds,
  NAV_ITEMS,
} from "./navigation";

describe("isValidNavId", () => {
  it("accepts every registered nav id", () => {
    for (const item of NAV_ITEMS) {
      expect(isValidNavId(item.id)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isValidNavId("does-not-exist")).toBe(false);
    expect(isValidNavId("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidNavId(null)).toBe(false);
    expect(isValidNavId(undefined)).toBe(false);
    expect(isValidNavId(42)).toBe(false);
    expect(isValidNavId({})).toBe(false);
    expect(isValidNavId([])).toBe(false);
  });
});

describe("partitionDockIds", () => {
  it("returns empty arrays for null/undefined input", () => {
    expect(partitionDockIds(null)).toEqual({ valid: [], unknown: [] });
    expect(partitionDockIds(undefined)).toEqual({ valid: [], unknown: [] });
  });

  it("classifies known ids as valid", () => {
    const { valid, unknown } = partitionDockIds(["dashboard", "studios", "messages"]);
    expect(valid).toEqual(["dashboard", "studios", "messages"]);
    expect(unknown).toEqual([]);
  });

  it("classifies unknown string ids as unknown", () => {
    const { valid, unknown } = partitionDockIds(["dashboard", "ghost-route", "messages"]);
    expect(valid).toEqual(["dashboard", "messages"]);
    expect(unknown).toEqual(["ghost-route"]);
  });

  it("preserves order within each partition", () => {
    const { valid, unknown } = partitionDockIds([
      "old-1",
      "studios",
      "old-2",
      "messages",
      "old-3",
    ]);
    expect(valid).toEqual(["studios", "messages"]);
    expect(unknown).toEqual(["old-1", "old-2", "old-3"]);
  });

  it("silently drops non-string entries", () => {
    // Mirrors what could appear if Postgres returns mixed jsonb data.
    const { valid, unknown } = partitionDockIds([
      "studios",
      null,
      42,
      "messages",
      undefined,
    ]);
    expect(valid).toEqual(["studios", "messages"]);
    expect(unknown).toEqual([]);
  });
});
