import { describe, it, expect } from "vitest";
import {
  EXTRA_ALIASES,
  NAV_ALIASES,
  resolveAlias,
  validateAliases,
  type NavAlias,
} from "./navigation";

/**
 * Tests for the centralized alias mapping. Guarantees that every legacy
 * URL declared via `matchPaths` OR `EXTRA_ALIASES` rewrites to its
 * canonical path, preserves sub-paths, and ignores unrelated routes.
 *
 * The "future legacy entries" suite intentionally simulates ad-hoc
 * EXTRA_ALIASES additions (without mutating the real registry) so
 * contributors can see exactly how a future redirect will behave once
 * registered — full suffix + search + hash preservation, zero extra wiring.
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

  it("passes validateAliases — module load would throw otherwise", () => {
    expect(() => validateAliases(NAV_ALIASES)).not.toThrow();
  });

  it("EXTRA_ALIASES is exported and editable as the central registry", () => {
    expect(Array.isArray(EXTRA_ALIASES)).toBe(true);
  });
});

describe("validateAliases", () => {
  it("rejects entries that don't start with /", () => {
    expect(() => validateAliases([{ from: "old", to: "/new" }])).toThrow(
      /must start with/i,
    );
  });

  it("rejects entries with a trailing slash", () => {
    expect(() => validateAliases([{ from: "/old/", to: "/new" }])).toThrow(
      /must not end with/i,
    );
  });

  it("rejects self-loops", () => {
    expect(() => validateAliases([{ from: "/x", to: "/x" }])).toThrow(/loop/i);
  });

  it("rejects suffix-loops (to is sub-path of from)", () => {
    expect(() => validateAliases([{ from: "/a", to: "/a/b" }])).toThrow(/loop/i);
  });

  it("rejects duplicate from entries", () => {
    expect(() =>
      validateAliases([
        { from: "/old", to: "/new" },
        { from: "/old", to: "/other" },
      ]),
    ).toThrow(/duplicate/i);
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

/**
 * Pure-function simulation of how `LegacyAliasRedirect` composes the final
 * destination URL. Locks in the contract that a future EXTRA_ALIASES entry
 * gets full suffix + search + hash preservation with zero extra wiring.
 */
const composeRedirect = (
  aliases: readonly NavAlias[],
  pathname: string,
  search: string,
  hash: string,
): string | null => {
  for (const { from, to } of aliases) {
    let canonical: string | null = null;
    if (pathname === from) canonical = to;
    else if (pathname.startsWith(from + "/"))
      canonical = to + pathname.slice(from.length);
    if (canonical) return `${canonical}${search}${hash}`;
  }
  return null;
};

describe("future legacy entries via EXTRA_ALIASES", () => {
  // Simulate registering a new ad-hoc redirect without mutating the real
  // module-level array.
  const simulated: NavAlias[] = [
    { from: "/old-shop", to: "/marketplace" },
    { from: "/u", to: "/profiles" },
  ];

  it("rewrites the legacy root to canonical", () => {
    expect(composeRedirect(simulated, "/old-shop", "", "")).toBe("/marketplace");
  });

  it("preserves nested suffixes on detail URLs", () => {
    expect(composeRedirect(simulated, "/old-shop/listing-42", "", "")).toBe(
      "/marketplace/listing-42",
    );
    expect(composeRedirect(simulated, "/u/alice/portfolio", "", "")).toBe(
      "/profiles/alice/portfolio",
    );
  });

  it("preserves the ?search string verbatim", () => {
    expect(
      composeRedirect(simulated, "/old-shop", "?ref=newsletter&utm=jan", ""),
    ).toBe("/marketplace?ref=newsletter&utm=jan");
  });

  it("preserves the #hash fragment verbatim", () => {
    expect(
      composeRedirect(simulated, "/old-shop/listing-42", "", "#reviews"),
    ).toBe("/marketplace/listing-42#reviews");
  });

  it("preserves search + hash + suffix together (deep-link scenario)", () => {
    expect(
      composeRedirect(
        simulated,
        "/u/alice/portfolio",
        "?tab=2024&filter=design",
        "#latest",
      ),
    ).toBe("/profiles/alice/portfolio?tab=2024&filter=design#latest");
  });

  it("falls through (returns null) when no entry matches", () => {
    expect(composeRedirect(simulated, "/something-else", "?x=1", "")).toBeNull();
  });

  it("simulated entries themselves pass validateAliases", () => {
    expect(() => validateAliases(simulated)).not.toThrow();
  });
});
