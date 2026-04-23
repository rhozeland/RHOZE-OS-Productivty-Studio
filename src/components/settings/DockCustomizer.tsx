import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Save, AlertTriangle, HelpCircle } from "lucide-react";
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

  // Re-derive the dropped/unknown ids whenever the saved config changes so
  // the inline cleanup preview stays accurate (e.g. after a reload that
  // pulls a fresh dockConfig from the server). Memoized to avoid churn.
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

  const hasChanges =
    JSON.stringify(selected) !== JSON.stringify(dockConfig || DEFAULT_DOCK_IDS);

  return (
    <div className="space-y-5">
      {/* Cleanup preview — only shown when the saved config has unknown ids.
          Renders a real-time before/after so the user sees exactly which
          items will disappear and what their dock will look like once the
          stale entries are pruned. The "After" mirror reuses the same
          markup as the live dock preview below for visual parity. */}
      {hasUnknownItems && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {unknownIds.length} unknown item{unknownIds.length === 1 ? "" : "s"} detected
              </p>
              <p className="text-xs text-muted-foreground">
                These entries no longer exist and will be removed when you save. Preview the result below.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Before — saved layout with placeholders for the missing ids */}
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Saved (before)
              </p>
              <div className="flex items-center gap-1 p-2 bg-card/60 backdrop-blur-xl border border-border rounded-lg overflow-x-auto">
                {(dockConfig ?? []).map((id, i) => {
                  const item = NAV_ITEMS_BY_ID[id];
                  if (!item) {
                    // Unknown item — render a clearly broken placeholder so
                    // the user can map "this slot will go away" to a tile.
                    return (
                      <div
                        key={`unknown-${id}-${i}`}
                        className="flex flex-col items-center justify-center w-12 h-12 rounded-md border border-dashed border-destructive/50 bg-destructive/10 text-destructive gap-0.5 shrink-0"
                        title={`Unknown id: ${id}`}
                      >
                        <HelpCircle className="h-4 w-4" />
                        <span className="text-[9px] font-medium leading-none truncate max-w-[3rem]">
                          {id}
                        </span>
                      </div>
                    );
                  }
                  const Icon = item.icon;
                  return (
                    <div
                      key={`${id}-${i}`}
                      className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted/40 text-foreground gap-0.5 shrink-0"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[9px] font-medium leading-none">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* After — same render path, but driven by the cleaned id list */}
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Cleaned (after)
              </p>
              <div className="flex items-center gap-1 p-2 bg-card/60 backdrop-blur-xl border border-border rounded-lg overflow-x-auto">
                {cleanedIds.map((id, i) => {
                  const item = NAV_ITEMS_BY_ID[id];
                  if (!item) return null;
                  const Icon = item.icon;
                  return (
                    <div
                      key={`${id}-${i}`}
                      className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted/40 text-foreground gap-0.5 shrink-0"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[9px] font-medium leading-none">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Removing: <span className="font-mono text-destructive">{unknownIds.join(", ")}</span>
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
