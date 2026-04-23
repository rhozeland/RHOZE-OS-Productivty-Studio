/**
 * Drops nav active-state tests.
 *
 * The Drops link in the dock/header must light up on:
 *   - the index route (/drop-rooms)
 *   - any detail route (/drop-rooms/:id)
 *   - the legacy alias (/droprooms) and its sub-paths
 *
 * It must NOT light up on unrelated routes that merely share a prefix
 * (e.g. /drop-rooms-archive).
 */
import { describe, it, expect } from "vitest";
import { NAV_ITEMS_BY_ID, isNavItemActive } from "./navigation";

describe("Drops nav active styling", () => {
  const drops = NAV_ITEMS_BY_ID.droprooms;

  it("is registered in the nav config", () => {
    expect(drops).toBeDefined();
    expect(drops.label).toBe("Drops");
    expect(drops.path).toBe("/drop-rooms");
  });

  it("is active on /drop-rooms (index route)", () => {
    expect(isNavItemActive(drops, "/drop-rooms")).toBe(true);
  });

  it("is active on /drop-rooms/:id detail routes", () => {
    expect(isNavItemActive(drops, "/drop-rooms/abc-123")).toBe(true);
    expect(isNavItemActive(drops, "/drop-rooms/550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("is active on nested drop-room sub-paths", () => {
    expect(isNavItemActive(drops, "/drop-rooms/abc-123/chat")).toBe(true);
  });

  it("is active on the legacy /droprooms alias and its sub-paths", () => {
    expect(isNavItemActive(drops, "/droprooms")).toBe(true);
    expect(isNavItemActive(drops, "/droprooms/abc-123")).toBe(true);
  });

  it("is NOT active on unrelated routes", () => {
    expect(isNavItemActive(drops, "/")).toBe(false);
    expect(isNavItemActive(drops, "/dashboard")).toBe(false);
    expect(isNavItemActive(drops, "/messages")).toBe(false);
    expect(isNavItemActive(drops, "/marketplace")).toBe(false);
  });

  it("is NOT active on routes that merely share a prefix", () => {
    // Guards against the classic `pathname.startsWith(item.path)` bug.
    expect(isNavItemActive(drops, "/drop-rooms-archive")).toBe(false);
    expect(isNavItemActive(drops, "/droproomsx")).toBe(false);
  });
});
