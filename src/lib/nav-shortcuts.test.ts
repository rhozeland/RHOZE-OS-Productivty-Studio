/**
 * Pure-logic tests for the keyboard shortcut decision table.
 * ─────────────────────────────────────────────────────────────────────────
 * Covers:
 *   • Alt+1..4 chords route to the right destination
 *   • The "g" leader arms, then a second key navigates
 *   • Editable focus is never hijacked
 *   • Modifier keys other than Alt are ignored (don't fight the browser)
 *   • A stray second key while armed cancels the leader
 */

import { describe, it, expect } from "vitest";
import {
  decideShortcut,
  formatChord,
  formatLeader,
  NAV_SHORTCUTS,
  type ShortcutEvent,
} from "./nav-shortcuts";

const ev = (overrides: Partial<ShortcutEvent>): ShortcutEvent => ({
  key: "",
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  isEditable: false,
  ...overrides,
});

describe("NAV_SHORTCUTS table", () => {
  it("registers exactly the four primary destinations", () => {
    expect(NAV_SHORTCUTS.map((s) => s.id)).toEqual([
      "dashboard",
      "projects",
      "calendar",
      "flow",
    ]);
  });

  it("uses Alt-digit chords without overlap", () => {
    const chords = NAV_SHORTCUTS.map((s) => s.chord);
    expect(new Set(chords).size).toBe(chords.length);
    chords.forEach((c) => expect(c).toMatch(/^Alt\+[1-9]$/));
  });

  it("uses unique single-letter leader keys", () => {
    const keys = NAV_SHORTCUTS.map((s) => s.leaderKey);
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((k) => expect(k).toMatch(/^[a-z]$/));
  });
});

describe("decideShortcut — Alt chords", () => {
  it.each([
    ["1", "/dashboard"],
    ["2", "/projects"],
    ["3", "/calendar"],
    ["4", "/flow"],
  ])("Alt+%s navigates to %s", (key, path) => {
    const action = decideShortcut(ev({ key, altKey: true }), false);
    expect(action).toEqual({ kind: "navigate", path, via: "chord" });
  });

  it("ignores Alt+digit when other modifiers are also pressed", () => {
    expect(
      decideShortcut(ev({ key: "1", altKey: true, shiftKey: true }), false),
    ).toEqual({ kind: "ignore" });
    expect(
      decideShortcut(ev({ key: "1", altKey: true, metaKey: true }), false),
    ).toEqual({ kind: "ignore" });
  });

  it("ignores Cmd/Ctrl-digit (browser tab shortcuts)", () => {
    expect(decideShortcut(ev({ key: "1", metaKey: true }), false)).toEqual({
      kind: "ignore",
    });
    expect(decideShortcut(ev({ key: "1", ctrlKey: true }), false)).toEqual({
      kind: "ignore",
    });
  });
});

describe("decideShortcut — leader sequence", () => {
  it("arms the leader on plain 'g'", () => {
    expect(decideShortcut(ev({ key: "g" }), false)).toEqual({
      kind: "armLeader",
    });
  });

  it.each([
    ["d", "/dashboard"],
    ["p", "/projects"],
    ["c", "/calendar"],
    ["f", "/flow"],
  ])("'g' then '%s' navigates to %s", (key, path) => {
    expect(decideShortcut(ev({ key }), true)).toEqual({
      kind: "navigate",
      path,
      via: "leader",
    });
  });

  it("clears the leader when an unrecognized second key follows", () => {
    expect(decideShortcut(ev({ key: "x" }), true)).toEqual({
      kind: "clearLeader",
    });
  });

  it("clears the leader on a second 'g' rather than re-arming", () => {
    expect(decideShortcut(ev({ key: "g" }), true)).toEqual({
      kind: "clearLeader",
    });
  });
});

describe("decideShortcut — editable focus", () => {
  it("ignores chords while typing in an input", () => {
    expect(
      decideShortcut(ev({ key: "1", altKey: true, isEditable: true }), false),
    ).toEqual({ kind: "ignore" });
  });

  it("ignores leader arm while typing", () => {
    expect(decideShortcut(ev({ key: "g", isEditable: true }), false)).toEqual({
      kind: "ignore",
    });
  });

  it("clears a pending leader if focus moves into an input mid-sequence", () => {
    expect(decideShortcut(ev({ key: "d", isEditable: true }), true)).toEqual({
      kind: "clearLeader",
    });
  });
});

describe("formatters", () => {
  it("formats Alt chord with the option glyph", () => {
    expect(formatChord("Alt+1")).toBe("⌥1");
  });

  it("formats leader sequence with a space", () => {
    expect(formatLeader("d")).toBe("g d");
  });
});
