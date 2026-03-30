import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  SectionKey,
  SectionFill,
  FillMode,
  COLOR_PRESETS,
  GRADIENT_PRESETS,
  PATTERN_PRESETS,
  PatternId,
} from "./constants";

interface FillControlsProps {
  activeSection: SectionKey;
  fill: SectionFill;
  onUpdate: (section: SectionKey, fill: Partial<SectionFill>) => void;
}

const FILL_MODES: { id: FillMode; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
  { id: "pattern", label: "Pattern" },
];

const FillControls = ({ activeSection, fill, onUpdate }: FillControlsProps) => {
  const update = (partial: Partial<SectionFill>) => onUpdate(activeSection, partial);

  return (
    <motion.div
      key={activeSection}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm space-y-4"
    >
      {/* Fill mode tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border/50">
        {FILL_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => update({ mode: mode.id })}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              fill.mode === mode.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Solid color picker */}
      {fill.mode === "solid" && (
        <div className="grid grid-cols-8 gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.value}
              title={preset.name}
              onClick={() => update({ color: preset.value })}
              className={cn(
                "w-8 h-8 rounded-xl border-2 transition-all hover:scale-110",
                fill.color === preset.value
                  ? "border-foreground scale-110 shadow-md"
                  : "border-border/40"
              )}
              style={{ backgroundColor: preset.value }}
            />
          ))}
        </div>
      )}

      {/* Gradient picker */}
      {fill.mode === "gradient" && (
        <div className="grid grid-cols-6 gap-2">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              title={preset.name}
              onClick={() => update({ gradientFrom: preset.from, gradientTo: preset.to })}
              className={cn(
                "h-8 rounded-xl border-2 transition-all hover:scale-105",
                fill.gradientFrom === preset.from && fill.gradientTo === preset.to
                  ? "border-foreground scale-105 shadow-md"
                  : "border-border/40"
              )}
              style={{
                background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
              }}
            />
          ))}
        </div>
      )}

      {/* Pattern picker */}
      {fill.mode === "pattern" && (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Base Color</p>
            <div className="grid grid-cols-8 gap-2">
              {COLOR_PRESETS.slice(0, 8).map((preset) => (
                <button
                  key={preset.value}
                  title={preset.name}
                  onClick={() => update({ color: preset.value })}
                  className={cn(
                    "w-8 h-8 rounded-xl border-2 transition-all hover:scale-110",
                    fill.color === preset.value
                      ? "border-foreground scale-110 shadow-md"
                      : "border-border/40"
                  )}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Pattern Style</p>
            <div className="flex flex-wrap gap-1.5">
              {PATTERN_PRESETS.map((pat) => (
                <button
                  key={pat.id}
                  onClick={() => update({ pattern: pat.id as PatternId })}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                    fill.pattern === pat.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary"
                  )}
                >
                  {pat.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Pattern Color</p>
            <div className="flex gap-2">
              {["#00000020", "#00000040", "#FFFFFF30", "#FFFFFF50", "#FF6B6B40", "#7C83FD40", "#6BCB7740", "#FFB34740"].map((c) => (
                <button
                  key={c}
                  onClick={() => update({ patternColor: c })}
                  className={cn(
                    "w-7 h-7 rounded-lg border-2 transition-all hover:scale-110",
                    fill.patternColor === c ? "border-foreground scale-110" : "border-border/40"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FillControls;
