import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Shuffle, RotateCcw, Palette, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  SectionKey,
  SectionFill,
  DEFAULT_FILLS,
  SECTION_LABELS,
  COLOR_PRESETS,
  GRADIENT_PRESETS,
  PATTERN_PRESETS,
  BACKGROUND_PRESETS,
} from "./logo-customizer/constants";
import LogoSvg from "./logo-customizer/LogoSvg";
import FillControls from "./logo-customizer/FillControls";

interface LogoCustomizerProps {
  onExport?: (dataUrl: string) => void;
  compact?: boolean;
}

const LogoCustomizer = ({ onExport, compact = false }: LogoCustomizerProps) => {
  const [fills, setFills] = useState<Record<SectionKey, SectionFill>>(
    JSON.parse(JSON.stringify(DEFAULT_FILLS))
  );
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [background, setBackground] = useState("transparent");
  const [showBgPicker, setShowBgPicker] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const updateFill = useCallback(
    (section: SectionKey, partial: Partial<SectionFill>) => {
      setFills((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...partial },
      }));
    },
    []
  );

  const randomize = () => {
    const pickColor = () => COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)].value;
    const pickGrad = () => GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)];
    const pickPattern = () => PATTERN_PRESETS[Math.floor(Math.random() * PATTERN_PRESETS.length)].id;
    const modes = ["solid", "gradient", "pattern"] as const;
    const pickMode = () => modes[Math.floor(Math.random() * modes.length)];

    const newFills: Record<SectionKey, SectionFill> = {} as any;
    for (const key of ["boxFront", "boxLid", "tag"] as SectionKey[]) {
      const grad = pickGrad();
      newFills[key] = {
        mode: pickMode(),
        color: pickColor(),
        gradientFrom: grad.from,
        gradientTo: grad.to,
        pattern: pickPattern(),
        patternColor: "#00000020",
      };
    }
    setFills(newFills);
  };

  const reset = () => {
    setFills(JSON.parse(JSON.stringify(DEFAULT_FILLS)));
    setBackground("transparent");
  };

  const renderToCanvas = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!svgRef.current) return resolve("");
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        if (background !== "transparent") {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, size, size);
        }
        const scale = (size * 0.75) / Math.max(img.naturalWidth, img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/png"));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }, [background]);

  const exportPng = useCallback(async () => {
    const dataUrl = await renderToCanvas();
    if (!dataUrl) return;
    onExport?.(dataUrl);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "my-toybox-logo.png";
    a.click();
  }, [renderToCanvas, onExport]);

  // Preview swatch for section pills
  const getSectionPreview = (key: SectionKey): React.CSSProperties => {
    const fill = fills[key];
    if (fill.mode === "gradient")
      return { background: `linear-gradient(135deg, ${fill.gradientFrom}, ${fill.gradientTo})` };
    return { backgroundColor: fill.color };
  };

  return (
    <div className={cn("flex flex-col items-center gap-6", compact ? "gap-4" : "gap-8")}>
      {/* SVG Preview */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative"
      >
        <div
          className={cn(
            "rounded-3xl border border-border/50 backdrop-blur-sm flex items-center justify-center",
            compact ? "w-48 h-48 p-4" : "w-64 h-64 sm:w-72 sm:h-72 p-6"
          )}
          style={{
            backgroundColor:
              background !== "transparent" ? background : undefined,
            background:
              background === "transparent"
                ? "hsl(var(--secondary) / 0.3)"
                : undefined,
          }}
        >
          <LogoSvg
            ref={svgRef}
            fills={fills}
            background={background}
            compact={compact}
            onClickSection={setActiveSection}
          />
        </div>

        {activeSection && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground bg-card/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50"
          >
            Editing: {SECTION_LABELS[activeSection]}
          </motion.div>
        )}
      </motion.div>

      {/* Section selector pills */}
      <div className="flex gap-2 mt-2 flex-wrap justify-center">
        {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
          <button
            key={key}
            onClick={() => { setActiveSection(key); setShowBgPicker(false); }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
              activeSection === key && !showBgPicker
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary"
            )}
          >
            <span
              className="w-3 h-3 rounded-full border border-border/50"
              style={getSectionPreview(key)}
            />
            {SECTION_LABELS[key]}
          </button>
        ))}
        <button
          onClick={() => { setShowBgPicker(true); setActiveSection(null); }}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
            showBgPicker
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary"
          )}
        >
          <Palette className="w-3 h-3" />
          Background
        </button>
      </div>

      {/* Fill controls for active section */}
      {activeSection && !showBgPicker && (
        <FillControls
          activeSection={activeSection}
          fill={fills[activeSection]}
          onUpdate={updateFill}
        />
      )}

      {/* Background picker */}
      {showBgPicker && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Background Color
          </p>
          <div className="grid grid-cols-8 gap-2">
            {BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.value}
                title={preset.name}
                onClick={() => setBackground(preset.value)}
                className={cn(
                  "w-8 h-8 rounded-xl border-2 transition-all hover:scale-110",
                  background === preset.value
                    ? "border-foreground scale-110 shadow-md"
                    : "border-border/40"
                )}
                style={{
                  backgroundColor: preset.value === "transparent" ? undefined : preset.value,
                  backgroundImage:
                    preset.value === "transparent"
                      ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                      : undefined,
                  backgroundSize: "8px 8px",
                  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={randomize} className="rounded-xl gap-1.5">
          <Shuffle className="w-3.5 h-3.5" />
          Randomize
        </Button>
        <Button variant="outline" size="sm" onClick={reset} className="rounded-xl gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
        <Button variant="outline" size="sm" onClick={exportPng} className="rounded-xl gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </div>
    </div>
  );
};

export { LogoCustomizer };
export default LogoCustomizer;
