import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  decideShortcut,
  LEADER_TIMEOUT_MS,
  NAV_SHORTCUTS,
  type NavShortcut,
} from "@/lib/nav-shortcuts";

/**
 * Mounts global keyboard shortcuts for primary navigation.
 *
 * Shortcuts:
 *   • Alt+1..4         → Home / Projects / Calendar / Flow (direct chord)
 *   • g then d/p/c/f   → same destinations (Gmail-style leader sequence)
 *
 * Safe-by-default:
 *   • Ignored while focus is in <input>, <textarea>, [contenteditable], or
 *     when an open dialog/menu has focus inside it (handled by isEditable).
 *   • Never hijacks Cmd/Ctrl chords — those belong to the browser / OS /
 *     existing palette shortcut (Cmd+K).
 *   • Active state in nav surfaces already syncs via `useLocation` +
 *     `isNavItemActive`; no extra wiring needed once we navigate.
 *
 * Mount once near the top of the tree (currently in AppLayout).
 */
export const useNavShortcuts = (
  shortcuts: readonly NavShortcut[] = NAV_SHORTCUTS,
): void => {
  const navigate = useNavigate();
  // Refs avoid re-binding the listener on every render (and survive
  // React 18 strict-mode double effect mounts in dev).
  const leaderArmed = useRef(false);
  const leaderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearLeader = () => {
      leaderArmed.current = false;
      if (leaderTimer.current) {
        clearTimeout(leaderTimer.current);
        leaderTimer.current = null;
      }
    };

    const armLeader = () => {
      leaderArmed.current = true;
      if (leaderTimer.current) clearTimeout(leaderTimer.current);
      leaderTimer.current = setTimeout(clearLeader, LEADER_TIMEOUT_MS);
    };

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      // Radix dialogs/popovers tag their root with role="dialog" but the
      // target inside is usually a button — that's fine to navigate from.
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const action = decideShortcut(
        {
          key: e.key,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          isEditable: isEditableTarget(e.target),
        },
        leaderArmed.current,
        shortcuts,
      );

      switch (action.kind) {
        case "navigate":
          e.preventDefault();
          clearLeader();
          navigate(action.path);
          break;
        case "armLeader":
          armLeader();
          break;
        case "clearLeader":
          clearLeader();
          break;
        case "ignore":
        default:
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearLeader();
    };
  }, [navigate, shortcuts]);
};
