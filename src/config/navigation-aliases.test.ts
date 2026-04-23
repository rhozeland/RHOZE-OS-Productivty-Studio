import { describe, it, expect } from "vitest";
import { NAV_ALIASES, resolveAlias } from "./navigation";

/**
 * Tests for the centralized alias mapping. Guarantees that every legacy
 * URL declared via `matchPaths` rewrites to the canonical NavItem.path,
 * preserves sub-paths, and ignores unrelated routes.
 */
describe("NAV_ALIASES", () => {
  it("includes the documented /droprooms → /drop-rooms alias", () => {
    expect(NAV_ALIASES).toEqual(
      expect.arrayContaining([{ from: "/droprooms", to: "/drop-rooms" }]),
    );
  });

  it("never aliases a path to itself (would cause redirect loops)", () => {
    for (const { from, to } of NAV_ALIASES) {
      expect(from).not.toBe(to);
      expect(to.startsWith(from + "/")).toBe(false);
    }
  });
});

describe("resolveAlias", () => {
  it("rewrites a known legacy root to its canonical path", () => {
    expect(resolveAlias("/droprooms")).toBe("/drop-rooms");
  });

  it("preserves the sub-path suffix on detail routes", () => {
    expect(resolveAlias("/droprooms/abc-123")).toBe("/drop-rooms/abc-123");
    expect(resolveAlias("/droprooms/abc-123/chat")).toBe(
      "/drop-rooms/abc-123/chat",
    );
  });

  it("returns null for unrelated routes", () => {
    expect(resolveAlias("/dashboard")).toBeNull();
    expect(resolveAlias("/")).toBeNull();
    expect(resolveAlias("/drop-rooms")).toBeNull(); // already canonical
  });

  it("does not match prefix-overlap impostors", () => {
    // Guards against the classic `pathname.startsWith(from)` bug — we must
    // require an exact match or `from + "/"` boundary.
    expect(resolveAlias("/droproomsx")).toBeNull();
    expect(resolveAlias("/droprooms-archive")).toBeNull();
  });
});
