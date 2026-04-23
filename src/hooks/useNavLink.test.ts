import { describe, it, expect } from "vitest";
import { resolveNavLink } from "./useNavLink";
import { NAV_ITEMS_BY_ID } from "@/config/navigation";

/**
 * Unit tests for the shared nav-link resolver. The pure `resolveNavLink`
 * function is what every nav surface (header, dock, sidebar) calls — these
 * tests pin its behavior so refactors can't silently change active styling.
 */
describe("resolveNavLink", () => {
  it("returns the canonical path as `to`", () => {
    const drops = NAV_ITEMS_BY_ID.droprooms;
    expect(resolveNavLink(drops, "/").to).toBe("/drop-rooms");
  });

  it("marks the item active on its canonical path", () => {
    const drops = NAV_ITEMS_BY_ID.droprooms;
    const r = resolveNavLink(drops, "/drop-rooms");
    expect(r.isActive).toBe(true);
    expect(r.ariaCurrent).toBe("page");
  });

  it("marks the item active on nested sub-routes", () => {
    const drops = NAV_ITEMS_BY_ID.droprooms;
    expect(resolveNavLink(drops, "/drop-rooms/abc-123").isActive).toBe(true);
    expect(resolveNavLink(drops, "/drop-rooms/abc-123/chat").isActive).toBe(true);
  });

  it("marks the item active on legacy matchPaths aliases", () => {
    const drops = NAV_ITEMS_BY_ID.droprooms;
    expect(resolveNavLink(drops, "/droprooms").isActive).toBe(true);
    expect(resolveNavLink(drops, "/droprooms/abc-123").isActive).toBe(true);
  });

  it("returns ariaCurrent=undefined when not active", () => {
    const drops = NAV_ITEMS_BY_ID.droprooms;
    const r = resolveNavLink(drops, "/dashboard");
    expect(r.isActive).toBe(false);
    expect(r.ariaCurrent).toBeUndefined();
  });

  it("guards against prefix-overlap false positives", () => {
    const drops = NAV_ITEMS_BY_ID.droprooms;
    expect(resolveNavLink(drops, "/drop-rooms-archive").isActive).toBe(false);
    expect(resolveNavLink(drops, "/droproomsx").isActive).toBe(false);
  });

  it("accepts a lightweight {path} descriptor for ad-hoc links", () => {
    // AppSidebar uses this shape for items not in the global NAV_ITEMS list
    // (Settings, Admin, Profile detail, etc.).
    const r = resolveNavLink({ path: "/settings" }, "/settings/notifications");
    expect(r.to).toBe("/settings");
    expect(r.isActive).toBe(true);
    expect(r.ariaCurrent).toBe("page");
  });

  it("respects matchPaths supplied on a lightweight descriptor", () => {
    const r = resolveNavLink(
      { path: "/profiles/me", matchPaths: ["/me"] },
      "/me/edit",
    );
    expect(r.isActive).toBe(true);
  });

  it("produces identical results for every NAV_ITEM regardless of caller", () => {
    // Parity guarantee for header/dock/sidebar — the resolver is the only
    // path through which `isActive` is computed, so calling it with the
    // same inputs from any surface must yield the same result.
    for (const item of Object.values(NAV_ITEMS_BY_ID)) {
      const fromItem = resolveNavLink(item, item.path);
      const fromShape = resolveNavLink(
        { path: item.path, matchPaths: item.matchPaths },
        item.path,
      );
      expect(fromItem.isActive).toBe(fromShape.isActive);
      expect(fromItem.to).toBe(fromShape.to);
      expect(fromItem.ariaCurrent).toBe(fromShape.ariaCurrent);
    }
  });
});
