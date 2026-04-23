import { describe, it, expect } from "vitest";
import {
  NAV_ITEMS,
  NAV_ITEMS_BY_ID,
  DEFAULT_DOCK_IDS,
  isNavItemActive,
} from "@/config/navigation";

/**
 * Parity tests for DockBar + DockCustomizer.
 *
 * Both components must agree on which nav item is "active" for any given
 * route. They achieve this by sharing the same source of truth
 * (`NAV_ITEMS_BY_ID`) and the same matcher (`isNavItemActive`).
 *
 * These tests guard that contract so a future refactor cannot drift the two
 * components apart (e.g. by hardcoding a path in one and not the other).
 */

describe("DockBar / DockCustomizer active-state parity", () => {
  it("DockBar default ids and DockCustomizer items resolve from the same registry", () => {
    // DockBar reads default ids from DEFAULT_DOCK_IDS, DockCustomizer maps
    // over the full NAV_ITEMS list. Every default id must exist in NAV_ITEMS.
    for (const id of DEFAULT_DOCK_IDS) {
      const fromRegistry = NAV_ITEMS_BY_ID[id];
      const fromList = NAV_ITEMS.find((n) => n.id === id);
      expect(fromRegistry, `id "${id}" missing from NAV_ITEMS_BY_ID`).toBeDefined();
      expect(fromList, `id "${id}" missing from NAV_ITEMS`).toBeDefined();
      // Identity check — both components must see the *same* object so that
      // path/matchPaths edits in the registry propagate everywhere.
      expect(fromRegistry).toBe(fromList);
    }
  });

  it("every NAV_ITEM is active on its own canonical path", () => {
    // DockCustomizer renders all NAV_ITEMS; DockBar renders a subset. For
    // any item shown by either component, navigating to its `path` must
    // mark it active.
    for (const item of NAV_ITEMS) {
      expect(
        isNavItemActive(item, item.path),
        `expected "${item.id}" active on its own path "${item.path}"`,
      ).toBe(true);
    }
  });

  it("every NAV_ITEM is active on each of its legacy matchPaths", () => {
    for (const item of NAV_ITEMS) {
      for (const alias of item.matchPaths ?? []) {
        expect(
          isNavItemActive(item, alias),
          `expected "${item.id}" active on legacy alias "${alias}"`,
        ).toBe(true);
      }
    }
  });

  it("every NAV_ITEM is active on a nested sub-route under its path", () => {
    // DockBar must keep highlighting the parent on detail pages
    // (e.g. /studios/abc, /drop-rooms/xyz). Verify for every item.
    for (const item of NAV_ITEMS) {
      const nested = `${item.path}/some-nested-id`;
      expect(
        isNavItemActive(item, nested),
        `expected "${item.id}" active on nested route "${nested}"`,
      ).toBe(true);
    }
  });

  it("no two NAV_ITEMS claim the same canonical path as active simultaneously", () => {
    // If two items both light up on the same route, DockBar would render
    // two active highlights and DockCustomizer's preview would be ambiguous.
    for (const item of NAV_ITEMS) {
      const others = NAV_ITEMS.filter((n) => n.id !== item.id);
      const conflicts = others.filter((other) =>
        isNavItemActive(other, item.path),
      );
      expect(
        conflicts.map((c) => c.id),
        `route "${item.path}" (owned by "${item.id}") also activates: ${conflicts
          .map((c) => c.id)
          .join(", ")}`,
      ).toEqual([]);
    }
  });

  it("DockBar and DockCustomizer would render identical labels/icons for shared ids", () => {
    // Both components read `item.label` and `item.icon` directly from the
    // shared registry. Re-resolving by id from each consumer's perspective
    // must yield byte-identical references.
    const dockBarItems = DEFAULT_DOCK_IDS.map((id) => NAV_ITEMS_BY_ID[id]);
    const dockCustomizerItems = NAV_ITEMS.filter((n) =>
      DEFAULT_DOCK_IDS.includes(n.id),
    );

    for (const id of DEFAULT_DOCK_IDS) {
      const a = dockBarItems.find((n) => n?.id === id);
      const b = dockCustomizerItems.find((n) => n.id === id);
      expect(a?.label).toBe(b?.label);
      expect(a?.icon).toBe(b?.icon);
      expect(a?.path).toBe(b?.path);
    }
  });
});
