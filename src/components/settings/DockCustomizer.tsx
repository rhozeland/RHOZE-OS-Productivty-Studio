import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Save, AlertTriangle, X } from "lucide-react";
import {
  NAV_ITEMS,
  NAV_ITEMS_BY_ID,
  DEFAULT_DOCK_IDS,
  partitionDockIds,
} from "@/config/navigation";

// Re-export so existing imports keep working.
export { DEFAULT_DOCK_IDS };

interface DockCustomizerProps {
  dockConfig: string[] | null;
  onSave: (config: string[]) => Promise<void>;
}

/**
 * Sanitize a saved dock_config array — drop any ids that no longer exist
 * in NAV_ITEMS, fall back to DEFAULT_DOCK_IDS if nothing remains.
 * Surfaces a one-time toast so the user knows their saved layout was
 * partially recovered.
 */
const sanitizeDockConfig = (config: string[] | null): {
  ids: string[];
  dropped: string[];
} => {
  if (!config) return { ids: DEFAULT_DOCK_IDS, dropped: [] };
  const { valid, unknown } = partitionDockIds(config);
  return {
    ids: valid.length > 0 ? valid : DEFAULT_DOCK_IDS,
    dropped: unknown,
  };
};

const DockCustomizer = ({ dockConfig, onSave }: DockCustomizerProps) => {
  const initial = sanitizeDockConfig(dockConfig);
  const [selected, setSelected] = useState<string[]>(initial.ids);
  const [saving, setSaving] = useState(false);
  // Tracks the per-id "Remove" button that's currently in flight, so we can
  // disable it without blocking the rest of the panel. `"all"` covers the
  // bulk-cleanup action.
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Re-derive the dropped/unknown ids from the *saved* config (not the
  // local `selected` state) — this is what the "Missing items" panel acts
  // on, and what gets pruned from `dockConfig` when the user clicks Remove.
  const { unknownIds, cleanedIds } = useMemo(() => {
    if (!dockConfig) return { unknownIds: [] as string[], cleanedIds: DEFAULT_DOCK_IDS };
    const { valid, unknown } = partitionDockIds(dockConfig);
    return {
      unknownIds: unknown,
      cleanedIds: valid.length > 0 ? valid : DEFAULT_DOCK_IDS,
    };
  }, [dockConfig]);
  const hasUnknownItems = unknownIds.length > 0;

  // Notify the user once if their saved config contained stale ids that we
  // had to drop. Keeps customizer state honest without silently mutating.
  useEffect(() => {
    if (initial.dropped.length > 0) {
      toast.warning(
        `Removed ${initial.dropped.length} unknown dock item${
          initial.dropped.length === 1 ? "" : "s"
        }: ${initial.dropped.join(", ")}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dockConfig) {
      const { ids } = sanitizeDockConfig(dockConfig);
      setSelected(ids);
    }
  }, [dockConfig]);

  const toggleItem = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length <= 3) {
        toast.error("You need at least 3 dock items");
        return;
      }
      setSelected((prev) => prev.filter((x) => x !== id));
    } else {
      if (selected.length >= 5) {
        toast.error("Maximum 5 dock items");
        return;
      }
      setSelected((prev) => [...prev, id]);
    }
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selected.length) return;
    const arr = [...selected];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    setSelected(arr);
  };

  const handleSave = async () => {
    if (selected.length < 3 || selected.length > 5) return;
    setSaving(true);
    try {
      await onSave(selected);
      toast.success("Dock menu updated!");
    } catch {
      toast.error("Failed to save dock configuration");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Persist a cleaned dockConfig that strips one or more unknown ids. We
   * write only valid ids known to NAV_ITEMS_BY_ID so a corrupt save can't
   * round-trip back into storage. The bulk variant (`removeId === null`)
   * drops every unknown id at once.
   */
  const removeUnknown = async (removeId: string | null) => {
    if (!dockConfig || unknownIds.length === 0) return;
    const next = dockConfig.filter((id) => {
      if (!NAV_ITEMS_BY_ID[id]) {
        // It's an unknown id — keep only if we're targeting a different one.
        return removeId !== null && id !== removeId;
      }
      return true;
    });
    // Safety net: if the prune leaves us below the minimum, top up with
    // defaults so the dock never enters an invalid state on disk.
    const safe = next.length >= 3 ? next : DEFAULT_DOCK_IDS;
    setRemovingId(removeId ?? "all");
    try {
      await onSave(safe);
      toast.success(
        removeId === null
          ? `Removed ${unknownIds.length} missing item${unknownIds.length === 1 ? "" : "s"}`
          : `Removed "${removeId}" from saved layout`,
      );
    } catch {
      toast.error("Couldn't update saved layout");
    } finally {
      setRemovingId(null);
    }
  };

  const hasChanges =
    JSON.stringify(selected) !== JSON.stringify(dockConfig || DEFAULT_DOCK_IDS);

  return (
    <div className="space-y-5">
      {/* Missing items — only shown when the saved config still references
          ids that no longer exist. Each row offers an explicit Remove so
          the user can act on the warning without having to manually re-save
          the full dock. The bulk action covers the common case. */}
      {hasUnknownItems && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                Missing items ({unknownIds.length})
              </p>
              <p className="text-xs text-muted-foreground">
                These ids are saved on your dock but no longer exist in the app. Remove them to keep your layout clean.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeUnknown(null)}
              disabled={removingId !== null}
              className="shrink-0 h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {removingId === "all" ? "Removing…" : "Remove all"}
            </Button>
          </div>

          <ul className="space-y-1.5">
            {unknownIds.map((id) => (
              <li
                key={id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background/50 border border-destructive/20"
              >
                <code className="flex-1 min-w-0 truncate text-xs font-mono text-destructive">
                  {id}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeUnknown(id)}
                  disabled={removingId !== null}
                  className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Remove ${id} from saved dock layout`}
                >
                  <X className="h-3 w-3" />
                  {removingId === id ? "Removing…" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-muted-foreground">
            Your live dock will look like:{" "}
            <span className="text-foreground">
              {cleanedIds
                .map((id) => NAV_ITEMS_BY_ID[id]?.label ?? id)
                .join(" · ")}
            </span>
          </p>
        </div>
      )}

      {/* Current dock preview */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Your Dock ({selected.length}/5)
        </p>
        <div className="flex items-center gap-1 p-3 bg-card/90 backdrop-blur-xl border border-border rounded-xl">
          {selected.map((id, i) => {
            const item = NAV_ITEMS_BY_ID[id];
            if (!item) return null;
            const Icon = item.icon;
            return (
              <div
                key={id}
                className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-muted/40 text-foreground gap-0.5 relative group"
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">
                  {item.label}
                </span>
                <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {i > 0 && (
                    <button
                      onClick={() => moveItem(i, -1)}
                      className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[8px]"
                    >
                      ←
                    </button>
                  )}
                  {i < selected.length - 1 && (
                    <button
                      onClick={() => moveItem(i, 1)}
                      className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[8px]"
                    >
                      →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All available items */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          Available Items
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSelected = selected.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  isSelected
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {hasChanges && (
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Dock Layout"}
        </Button>
      )}
    </div>
  );
};

export default DockCustomizer;
