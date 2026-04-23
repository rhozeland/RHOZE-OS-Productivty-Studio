import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Palette, Music, Camera, Video, PenTool, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BADGE_COLOR_PRESETS,
  BADGE_PLACEMENTS,
  DEFAULT_FLOW_CARD_PREFS,
  badgeColorClassFor,
  badgePlacementClassFor,
  loadFlowCardPrefs,
  saveFlowCardPrefs,
  type BadgeColorPresetId,
  type BadgePlacementId,
  type FlowCardPrefs,
} from "@/lib/flow-card-prefs";

/**
 * FlowCardCustomizer — Settings module that lets a user tune the
 * category badge on Flow Mode cards. Renders a side-by-side preview so
 * changes are visible before they propagate to the live feed.
 *
 * Persistence is localStorage via `saveFlowCardPrefs`, which fires a
 * custom event so the actual <FlowCard> in the running Flow Mode page
 * picks up the change without a reload.
 */

// Tiny preview palette — mirrors what FlowCard uses for its category
// shells. Kept inline so the customizer doesn't import from FlowCard
// (avoids a circular concern between the renderer and its config UI).
const CATEGORY_PREVIEW = {
  icon: Palette,
  label: "design",
  fallbackColor: "bg-teal/15 text-teal",
} as const;

const FlowCardCustomizer = () => {
  const [prefs, setPrefs] = useState<FlowCardPrefs>(() => loadFlowCardPrefs());

  // Persist on every change. Saving is cheap (single localStorage write +
  // a synthetic event), and immediate persistence means the live Flow
  // Mode tab updates as the user is dragging through previews.
  useEffect(() => {
    saveFlowCardPrefs(prefs);
  }, [prefs]);

  const update = <K extends keyof FlowCardPrefs>(key: K, value: FlowCardPrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const reset = () => setPrefs({ ...DEFAULT_FLOW_CARD_PREFS });

  const Icon = CATEGORY_PREVIEW.icon;
  const wrapperClass = badgePlacementClassFor(prefs.badgePlacement);
  const colorClass = badgeColorClassFor(prefs.badgeColor, CATEGORY_PREVIEW.fallbackColor);

  // The badge node — identical between inline and absolute placements;
  // only the wrapper changes. Mirrors the markup used by FlowCard.tsx so
  // the preview matches the live render exactly.
  const badgeNode = (
    <Badge
      className={cn(
        colorClass,
        "border-0 rounded-full text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 inline-flex items-center gap-1",
      )}
    >
      <Icon className="h-3 w-3" />
      {CATEGORY_PREVIEW.label}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Customize the category badge that appears on Flow Mode cards. Changes save
        automatically and apply across this device.
      </p>

      {/* ── Live preview ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Preview
        </Label>
        <div className="relative rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
          {/* Stand-in artwork area so corner placements have something to
              anchor against. Uses muted gradient (no semantic color cost). */}
          <div className="relative aspect-[4/3] bg-gradient-to-br from-muted via-muted/60 to-muted/30 flex items-center justify-center">
            <Icon className="h-10 w-10 text-foreground/20" aria-hidden="true" />
            {prefs.badgeVisible && prefs.badgePlacement !== "inline" && (
              <div className={wrapperClass}>{badgeNode}</div>
            )}
          </div>
          <div className="px-5 pt-4 pb-2 flex items-center gap-3 min-h-[44px]">
            {prefs.badgeVisible && prefs.badgePlacement === "inline" && badgeNode}
            <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="opacity-60">Save</span>
              <span className="opacity-60">Send</span>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="h-3 w-32 rounded bg-muted-foreground/20" />
            <div className="h-2 w-48 rounded bg-muted-foreground/10 mt-2" />
          </div>
        </div>
      </div>

      {/* ── Visibility ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card/30 px-4 py-3">
        <div>
          <Label htmlFor="badge-visible" className="text-sm font-medium">
            Show category badge
          </Label>
          <p className="text-xs text-muted-foreground">
            Hide entirely if you prefer cleaner cards.
          </p>
        </div>
        <Switch
          id="badge-visible"
          checked={prefs.badgeVisible}
          onCheckedChange={(v) => update("badgeVisible", v)}
        />
      </div>

      {/* ── Color ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Color
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BADGE_COLOR_PRESETS.map((preset) => {
            const isSelected = prefs.badgeColor === preset.id;
            const swatchClass = badgeColorClassFor(
              preset.id as BadgeColorPresetId,
              CATEGORY_PREVIEW.fallbackColor,
            );
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => update("badgeColor", preset.id as BadgeColorPresetId)}
                disabled={!prefs.badgeVisible}
                aria-pressed={isSelected}
                className={cn(
                  "group flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border/40 bg-card/30 hover:border-border hover:bg-card/60",
                  !prefs.badgeVisible && "opacity-50 cursor-not-allowed",
                )}
              >
                <Badge
                  className={cn(
                    swatchClass,
                    "border-0 rounded-full text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 inline-flex items-center gap-1",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  design
                </Badge>
                <div>
                  <div className="text-xs font-medium text-foreground">{preset.label}</div>
                  <div className="text-[10px] text-muted-foreground">{preset.hint}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Placement ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Placement
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BADGE_PLACEMENTS.map((placement) => {
            const isSelected = prefs.badgePlacement === placement.id;
            return (
              <button
                key={placement.id}
                type="button"
                onClick={() => update("badgePlacement", placement.id as BadgePlacementId)}
                disabled={!prefs.badgeVisible}
                aria-pressed={isSelected}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border/40 bg-card/30 hover:border-border hover:bg-card/60",
                  !prefs.badgeVisible && "opacity-50 cursor-not-allowed",
                )}
              >
                <div className="text-xs font-medium text-foreground">
                  {placement.label}
                </div>
                {/* Tiny diagram of the chosen corner — purely decorative,
                    aria-hidden so screen readers ignore it. */}
                <div
                  className="relative mt-2 h-8 rounded-md bg-muted/60 border border-border/40"
                  aria-hidden="true"
                >
                  {placement.id === "inline" ? (
                    <div className="absolute bottom-1 left-1 h-1.5 w-6 rounded-full bg-primary/60" />
                  ) : (
                    <div
                      className={cn(
                        "absolute h-1.5 w-1.5 rounded-full bg-primary",
                        placement.id === "top-left" && "top-1 left-1",
                        placement.id === "top-right" && "top-1 right-1",
                        placement.id === "bottom-left" && "bottom-1 left-1",
                        placement.id === "bottom-right" && "bottom-1 right-1",
                      )}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset to default
        </Button>
      </div>
    </div>
  );
};

export default FlowCardCustomizer;
