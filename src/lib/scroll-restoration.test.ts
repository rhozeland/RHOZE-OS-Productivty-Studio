import { describe, it, expect } from "vitest";
import { buildScrollKey, decideRestore, type ScrollStore } from "./scroll-restoration";

describe("buildScrollKey", () => {
  it("combines pathname and search but ignores hash", () => {
    expect(buildScrollKey("/projects", "")).toBe("/projects");
    expect(buildScrollKey("/projects", "?tab=active")).toBe("/projects?tab=active");
  });
});

describe("decideRestore", () => {
  const store: ScrollStore = new Map([["/projects", 420]]);

  it("REPLACE never disturbs scroll (hash-only updates)", () => {
    expect(
      decideRestore({ pathname: "/settings", search: "", hash: "#wallet" }, "REPLACE", store),
    ).toEqual({ action: "noop" });
  });

  it("POP restores saved Y when present", () => {
    expect(
      decideRestore({ pathname: "/projects", search: "", hash: "" }, "POP", store),
    ).toEqual({ action: "restore", y: 420 });
  });

  it("POP falls back to top when no saved Y", () => {
    expect(
      decideRestore({ pathname: "/unknown", search: "", hash: "" }, "POP", store),
    ).toEqual({ action: "scroll-to-top" });
  });

  it("PUSH scrolls to top by default", () => {
    expect(
      decideRestore({ pathname: "/projects", search: "", hash: "" }, "PUSH", store),
    ).toEqual({ action: "scroll-to-top" });
  });

  it("PUSH honors hash anchors", () => {
    expect(
      decideRestore({ pathname: "/about", search: "", hash: "#team" }, "PUSH", store),
    ).toEqual({ action: "scroll-to-anchor", anchorId: "team" });
  });

  it("PUSH ignores empty/whitespace hashes", () => {
    expect(
      decideRestore({ pathname: "/x", search: "", hash: "#" }, "PUSH", store),
    ).toEqual({ action: "scroll-to-top" });
  });
});
