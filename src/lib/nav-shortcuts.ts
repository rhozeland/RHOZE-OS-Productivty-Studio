/**
 * Keyboard shortcut definitions for primary navigation.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Two shortcut styles are supported per destination so muscle-memory works
 * for both browser-power-users and Vim/Gmail-style "leader sequence" users:
 *
 *   1. Direct chord  →  Alt+1, Alt+2, Alt+3, Alt+4
 *      Single keypress, no leader. Avoids Cmd/Ctrl which collide with
 *      browser shortcuts (e.g. Cmd+K is reserved for the search palette).
 *
 *   2. Leader sequence →  "g" then one of d / p / c / f
 *      Press "g" within 1.2s of the destination key. Mirrors Gmail / Linear.
 *      The leader is consumed only when followed by a recognized second key,
 *      so plain "g" typed in normal text is harmless.
 *
 * The hook (useNavShortcuts) wires this table to keydown listeners and
 * routes via React Router; the table itself is exported and pure so it
 * can be unit-tested without DOM/React.
 */

export type NavShortcutId = "dashboard" | "projects" | "calendar" | "flow";

export interface NavShortcut {
  /** Nav item id from src/config/navigation.ts. */
  id: NavShortcutId;
  /** Canonical destination path. Kept here for self-containment in tests. */
  path: string;
  /** Human label (used in tooltips / palette hints). */
  label: string;
  /** Direct chord (no leader). e.g. "Alt+1". */
  chord: string;
  /** Second key in the leader sequence (after `g`). */
  leaderKey: string;
}

export const NAV_SHORTCUTS: readonly NavShortcut[] = [
  { id: "dashboard", path: "/dashboard", label: "Home",     chord: "Alt+1", leaderKey: "d" },
  { id: "projects",  path: "/projects",  label: "Projects", chord: "Alt+2", leaderKey: "p" },
  { id: "calendar",  path: "/calendar",  label: "Calendar", chord: "Alt+3", leaderKey: "c" },
  { id: "flow",      path: "/flow",      label: "Flow",     chord: "Alt+4", leaderKey: "f" },
] as const;

/** Window in which a leader-sequence second-key must arrive. */
export const LEADER_TIMEOUT_MS = 1200;

/**
 * Decide what action a keyboard event should trigger, given the prior
 * leader state. Pure — no DOM, easy to unit test.
 *
 * Returns:
 *   - { kind: "navigate", path } → caller should navigate
 *   - { kind: "armLeader" }      → caller should remember leader is active
 *   - { kind: "clearLeader" }    → caller should drop any pending leader
 *   - { kind: "ignore" }         → no-op (event not relevant)
 */
export type ShortcutAction =
  | { kind: "navigate"; path: string; via: "chord" | "leader" }
  | { kind: "armLeader" }
  | { kind: "clearLeader" }
  | { kind: "ignore" };

export interface ShortcutEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  /** True when focus is in an editable field — typing should never navigate. */
  isEditable: boolean;
}

export const decideShortcut = (
  event: ShortcutEvent,
  leaderArmed: boolean,
  shortcuts: readonly NavShortcut[] = NAV_SHORTCUTS,
): ShortcutAction => {
  // Never hijack typing in inputs / textareas / contenteditable.
  if (event.isEditable) {
    return leaderArmed ? { kind: "clearLeader" } : { kind: "ignore" };
  }

  // Direct chord: Alt + digit (no Ctrl/Meta/Shift to avoid overlap with
  // OS-level or browser-level shortcuts like Cmd+1 = first tab).
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    const match = shortcuts.find((s) => s.chord === `Alt+${event.key}`);
    if (match) return { kind: "navigate", path: match.path, via: "chord" };
  }

  // Plain (no modifiers) keys drive the leader sequence.
  if (!event.altKey && !event.ctrlKey && !event.metaKey) {
    if (leaderArmed) {
      const match = shortcuts.find(
        (s) => s.leaderKey.toLowerCase() === event.key.toLowerCase(),
      );
      if (match) return { kind: "navigate", path: match.path, via: "leader" };
      // Any other key while armed cancels — including a second "g".
      return { kind: "clearLeader" };
    }
    if (event.key.toLowerCase() === "g") {
      return { kind: "armLeader" };
    }
  }

  return { kind: "ignore" };
};

/** Format a chord for display in tooltips / palette. */
export const formatChord = (chord: string): string =>
  chord
    .split("+")
    .map((p) => (p === "Alt" ? "⌥" : p))
    .join("");

/** Format a leader sequence for display, e.g. "g d". */
export const formatLeader = (leaderKey: string): string => `g ${leaderKey}`;
