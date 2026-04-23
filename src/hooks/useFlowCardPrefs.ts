import { useEffect, useState } from "react";
import {
  loadFlowCardPrefs,
  type FlowCardPrefs,
} from "@/lib/flow-card-prefs";

/**
 * Subscribes a component to the user's Flow card preferences.
 *
 * Reads from localStorage on mount and stays in sync via:
 *   • the native `storage` event (other tabs editing the same key), and
 *   • the in-tab `flow-card-prefs-changed` custom event dispatched by
 *     `saveFlowCardPrefs` (the native `storage` event fires only across
 *     tabs, so without this the customizer wouldn't live-update the
 *     adjacent preview without a reload).
 */
export const useFlowCardPrefs = (): FlowCardPrefs => {
  const [prefs, setPrefs] = useState<FlowCardPrefs>(() => loadFlowCardPrefs());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setPrefs(loadFlowCardPrefs());
    window.addEventListener("storage", refresh);
    window.addEventListener("flow-card-prefs-changed", refresh as EventListener);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(
        "flow-card-prefs-changed",
        refresh as EventListener,
      );
    };
  }, []);

  return prefs;
};
