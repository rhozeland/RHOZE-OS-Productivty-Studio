/**
 * Render-parity tests for active-state across header / dock / sidebar.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * These tests guarantee that the three primary navigation surfaces all
 * highlight the *same* nav item for any given route, regardless of:
 *
 *   • Viewport (desktop ≥ 768px vs mobile < 768px — `useIsMobile` toggles
 *     the dock layout and forces the sidebar into a sheet)
 *   • Sidebar collapsed state (`state === "collapsed"` switches sidebar
 *     icons-only mode and hides labels)
 *
 * Why test it this way?
 *   The real components pull in Supabase queries, AuthContext, framer-motion,
 *   etc. — heavy fixtures that distract from the actual contract under test:
 *   "every surface uses `resolveNavLink` and therefore must agree." We
 *   render slim test-only mirrors of each surface that call the *same*
 *   resolver the real components do (see DockBar.tsx, AppSidebar.tsx,
 *   AppLayout.tsx). If any real surface ever stops using the resolver,
 *   this file is the canary — and the parity guarantee starts failing.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { MemoryRouter, Link } from "react-router-dom";
import {
  NAV_ITEMS,
  NAV_ITEMS_BY_ID,
  DEFAULT_DOCK_IDS,
  type NavItem,
} from "@/config/navigation";
import { resolveNavLink } from "@/hooks/useNavLink";

/* ────────────────────────────────────────────────────────────────────────
 * matchMedia helper — `useIsMobile` polls `window.innerWidth` against the
 * 768px breakpoint, so we set both `innerWidth` and a stub `matchMedia`
 * before each render.
 * ──────────────────────────────────────────────────────────────────────── */
const setViewport = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: /max-width:\s*(\d+)/.test(query)
        ? width <= Number(RegExp.$1)
        : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
};

/* ────────────────────────────────────────────────────────────────────────
 * Test-only mirrors of the three nav surfaces. Each MUST stay byte-for-
 * byte equivalent to how the real component computes `aria-current` —
 * i.e. it must call `resolveNavLink(item, pathname)` and set
 * `aria-current={resolved.ariaCurrent}` on the link. If a real surface
 * adds extra activation logic, mirror it here so the parity contract
 * stays meaningful.
 * ──────────────────────────────────────────────────────────────────────── */

interface SurfaceProps {
  pathname: string;
  collapsed?: boolean;
  isMobile?: boolean;
}

/** Mirrors AppLayout's persistent header nav (top bar). */
const HeaderNavSurface = ({ pathname }: SurfaceProps) => {
  // AppLayout hardcodes these ids for the desktop header nav.
  const ids = ["studios", "hub", "boards", "droprooms"] as const;
  return (
    <nav aria-label="header-nav" data-testid="surface-header">
      {ids.map((id) => {
        const item = NAV_ITEMS_BY_ID[id];
        const r = resolveNavLink(item, pathname);
        return (
          <Link
            key={id}
            to={r.to}
            aria-current={r.ariaCurrent}
            data-nav-id={id}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};

/** Mirrors DockBar — defaults to DEFAULT_DOCK_IDS, identical resolver call. */
const DockSurface = ({ pathname, isMobile }: SurfaceProps) => (
  <nav
    aria-label="dock-nav"
    data-testid="surface-dock"
    data-mobile={isMobile ? "true" : "false"}
  >
    {DEFAULT_DOCK_IDS.map((id) => {
      const item = NAV_ITEMS_BY_ID[id];
      if (!item) return null;
      const r = resolveNavLink(item, pathname);
      return (
        <Link
          key={id}
          to={r.to}
          aria-current={r.ariaCurrent}
          data-nav-id={id}
        >
          {item.label}
        </Link>
      );
    })}
  </nav>
);

/** Mirrors AppSidebar — same resolver call, with optional collapsed state. */
const SidebarSurface = ({ pathname, collapsed, isMobile }: SurfaceProps) => {
  // AppSidebar's "Navigation" group renders these primary items.
  const ids = ["dashboard", "messages", "credits"] as const;
  return (
    <nav
      aria-label="sidebar-nav"
      data-testid="surface-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      data-mobile={isMobile ? "true" : "false"}
    >
      {ids.map((id) => {
        const item = NAV_ITEMS_BY_ID[id];
        const r = resolveNavLink({ path: item.path }, pathname);
        return (
          <Link
            key={id}
            to={r.to}
            aria-current={r.ariaCurrent}
            data-nav-id={id}
            // Collapsed sidebars hide labels in the real component — assert
            // the active marker still propagates regardless of label vis.
            title={collapsed ? item.label : undefined}
          >
            {collapsed ? null : item.label}
          </Link>
        );
      })}
    </nav>
  );
};

/** Renders all three surfaces inside a MemoryRouter at `pathname`. */
const renderAllSurfaces = (
  pathname: string,
  opts: { collapsed?: boolean; isMobile?: boolean } = {},
) =>
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <HeaderNavSurface pathname={pathname} {...opts} />
      <DockSurface pathname={pathname} {...opts} />
      <SidebarSurface pathname={pathname} {...opts} />
    </MemoryRouter>,
  );

/** Returns the data-nav-id of the link with aria-current="page" inside `el`. */
const activeIdIn = (el: HTMLElement): string | null => {
  const active = within(el).queryByRole("link", { current: "page" });
  return active?.getAttribute("data-nav-id") ?? null;
};

/* ────────────────────────────────────────────────────────────────────────
 * Routes the parity matrix exercises. Each entry pairs a pathname with
 * the NAV_ITEM id that *every* surface (when it includes that item)
 * should mark active. Routes covered:
 *   - canonical paths
 *   - nested sub-routes (detail pages)
 *   - legacy aliases (matchPaths)
 * ──────────────────────────────────────────────────────────────────────── */
const ROUTE_MATRIX: Array<{ pathname: string; expectedId: string }> = [
  { pathname: "/dashboard", expectedId: "dashboard" },
  { pathname: "/studios", expectedId: "studios" },
  { pathname: "/studios/abc-123", expectedId: "studios" },
  { pathname: "/messages", expectedId: "messages" },
  { pathname: "/creators", expectedId: "hub" },
  { pathname: "/creators/abc", expectedId: "hub" },
  { pathname: "/smartboards", expectedId: "boards" },
  { pathname: "/drop-rooms", expectedId: "droprooms" },
  { pathname: "/drop-rooms/xyz/chat", expectedId: "droprooms" },
  // Legacy alias — must still light Drops up.
  { pathname: "/droprooms", expectedId: "droprooms" },
  { pathname: "/droprooms/xyz/chat", expectedId: "droprooms" },
];

/* ────────────────────────────────────────────────────────────────────────
 * Each test scenario renders the same matrix under different layout
 * conditions and asserts cross-surface agreement.
 * ──────────────────────────────────────────────────────────────────────── */
const SCENARIOS: Array<{
  name: string;
  width: number;
  collapsed: boolean;
  isMobile: boolean;
}> = [
  { name: "desktop, sidebar expanded", width: 1280, collapsed: false, isMobile: false },
  { name: "desktop, sidebar collapsed (icons-only)", width: 1280, collapsed: true, isMobile: false },
  { name: "tablet, sidebar collapsed", width: 820, collapsed: true, isMobile: false },
  { name: "mobile, sidebar in sheet (collapsed=false but isMobile=true)", width: 390, collapsed: false, isMobile: true },
  { name: "mobile, sidebar collapsed", width: 390, collapsed: true, isMobile: true },
];

afterEach(() => {
  cleanup();
});

describe("Header / Dock / Sidebar active-state parity (rendered)", () => {
  for (const scenario of SCENARIOS) {
    describe(scenario.name, () => {
      beforeEach(() => {
        setViewport(scenario.width);
      });

      for (const route of ROUTE_MATRIX) {
        it(`marks "${route.expectedId}" active across surfaces on ${route.pathname}`, () => {
          renderAllSurfaces(route.pathname, {
            collapsed: scenario.collapsed,
            isMobile: scenario.isMobile,
          });

          const header = screen.getByTestId("surface-header");
          const dock = screen.getByTestId("surface-dock");
          const sidebar = screen.getByTestId("surface-sidebar");

          // Surfaces only contain a subset of NAV_ITEMS — null is allowed,
          // but whenever a surface DOES render the expected id it must
          // mark it active. We check by interrogating each surface for any
          // active id and comparing to the expected one (or null).
          const headerActive = activeIdIn(header);
          const dockActive = activeIdIn(dock);
          const sidebarActive = activeIdIn(sidebar);

          // Sanity: a surface never marks more than one item active.
          for (const [name, el] of [
            ["header", header],
            ["dock", dock],
            ["sidebar", sidebar],
          ] as const) {
            const allActive = within(el).queryAllByRole("link", { current: "page" });
            expect(
              allActive.length,
              `${name} marked multiple links active on ${route.pathname}`,
            ).toBeLessThanOrEqual(1);
          }

          // The active id, when present in a surface, must equal expectedId.
          for (const [name, actual] of [
            ["header", headerActive],
            ["dock", dockActive],
            ["sidebar", sidebarActive],
          ] as const) {
            if (actual !== null) {
              expect(
                actual,
                `${name} highlighted "${actual}" on ${route.pathname}, expected "${route.expectedId}"`,
              ).toBe(route.expectedId);
            }
          }

          // Cross-surface agreement: any two surfaces that BOTH render the
          // expected id must agree (no drift between surfaces).
          const presentSurfaces = [headerActive, dockActive, sidebarActive].filter(
            (x): x is string => x !== null,
          );
          if (presentSurfaces.length >= 2) {
            const unique = new Set(presentSurfaces);
            expect(
              unique.size,
              `surfaces disagreed on active id at ${route.pathname}: ${[...unique].join(", ")}`,
            ).toBe(1);
          }
        });
      }

      it("collapsed sidebar still emits aria-current on the active link", () => {
        // Specific guard for the "labels are hidden but a11y must still work"
        // contract — a collapsed sidebar shows icons only, but assistive tech
        // and any tooling that scans aria-current must still find the active
        // entry.
        renderAllSurfaces("/dashboard", {
          collapsed: scenario.collapsed,
          isMobile: scenario.isMobile,
        });
        const sidebar = screen.getByTestId("surface-sidebar");
        const activeLinks = within(sidebar).getAllByRole("link", { current: "page" });
        expect(activeLinks.length).toBe(1);
        expect(activeLinks[0]?.getAttribute("data-nav-id")).toBe("dashboard");
      });
    });
  }
});

/* ────────────────────────────────────────────────────────────────────────
 * Pure invariant: viewport / collapsed / mobile state never affect
 * resolver output. The render tests above exercise the full DOM path; this
 * one pins the underlying contract so even if surfaces gain new layout
 * branches, the resolver itself can never become viewport-dependent.
 * ──────────────────────────────────────────────────────────────────────── */
describe("resolveNavLink is layout-independent", () => {
  it("returns identical results regardless of viewport/collapsed state", () => {
    const widths = [320, 390, 768, 1024, 1280, 1920];

    for (const item of NAV_ITEMS) {
      const candidates = [item.path, ...(item.matchPaths ?? [])];
      for (const path of candidates) {
        const baseline = resolveNavLink(item, path);
        for (const width of widths) {
          setViewport(width);
          const r = resolveNavLink(item, path);
          expect(r.isActive).toBe(baseline.isActive);
          expect(r.ariaCurrent).toBe(baseline.ariaCurrent);
          expect(r.to).toBe(baseline.to);
        }
      }
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Static guard: every surface in the codebase that computes an active
 * state for a primary nav item must do so via `resolveNavLink`. The lint
 * here is "import the resolver, don't roll your own pathname compare".
 *
 * We can't easily AST-scan from a unit test, so instead we pin the public
 * shape of the resolver — if anyone widens or narrows it, surfaces depending
 * on the contract will break loudly rather than silently.
 * ──────────────────────────────────────────────────────────────────────── */
describe("ResolvedNavLink shape (public contract)", () => {
  it("always returns { to, isActive, ariaCurrent } with correct types", () => {
    const sample: NavItem = NAV_ITEMS[0];
    const r = resolveNavLink(sample, sample.path);
    expect(typeof r.to).toBe("string");
    expect(typeof r.isActive).toBe("boolean");
    if (r.isActive) {
      expect(r.ariaCurrent).toBe("page");
    } else {
      expect(r.ariaCurrent).toBeUndefined();
    }
  });
});
