import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Shuffle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  { name: "Coral", value: "#FF6B6B" },
  { name: "Amber", value: "#FFB347" },
  { name: "Lemon", value: "#FFE066" },
  { name: "Mint", value: "#6BCB77" },
  { name: "Sky", value: "#4ECDC4" },
  { name: "Ocean", value: "#45B7D1" },
  { name: "Indigo", value: "#7C83FD" },
  { name: "Violet", value: "#A66CFF" },
  { name: "Rose", value: "#F472B6" },
  { name: "Blush", value: "#FDA4AF" },
  { name: "Slate", value: "#94A3B8" },
  { name: "Charcoal", value: "#374151" },
  { name: "Snow", value: "#F8FAFC" },
  { name: "Peach", value: "#FBBF77" },
  { name: "Lavender", value: "#C4B5FD" },
  { name: "Teal", value: "#2DD4BF" },
];

const DEFAULT_COLORS = {
  boxFront: "#FFFFFF",
  boxLid: "#FFFFFF",
  tag: "#FFFFFF",
};

interface LogoCustomizerProps {
  onExport?: (dataUrl: string) => void;
  compact?: boolean;
}

const LogoCustomizer = ({ onExport, compact = false }: LogoCustomizerProps) => {
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [activeSection, setActiveSection] = useState<keyof typeof DEFAULT_COLORS | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const sectionLabels: Record<keyof typeof DEFAULT_COLORS, string> = {
    boxFront: "Box Front",
    boxLid: "Box Lid",
    tag: "Tag",
  };

  const setColor = useCallback((section: keyof typeof DEFAULT_COLORS, color: string) => {
    setColors((prev) => ({ ...prev, [section]: color }));
  }, []);

  const randomize = () => {
    const pick = () => COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)].value;
    setColors({ boxFront: pick(), boxLid: pick(), tag: pick() });
  };

  const reset = () => setColors(DEFAULT_COLORS);

  const exportPng = useCallback(async () => {
    if (!svgRef.current) return;
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
      // Center the logo on canvas
      const scale = (size * 0.75) / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

      const dataUrl = canvas.toDataURL("image/png");
      onExport?.(dataUrl);

      // Also trigger download
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "my-toybox-logo.png";
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [onExport]);

  const getDataUrl = useCallback(async (): Promise<string> => {
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
        const scale = (size * 0.75) / Math.max(img.naturalWidth, img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/png"));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }, []);

  // Expose getDataUrl via ref-like pattern
  // Parent can call onExport to get the current logo
  const handleSaveForProfile = async () => {
    const dataUrl = await getDataUrl();
    onExport?.(dataUrl);
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
        <div className={cn(
          "rounded-3xl bg-secondary/30 border border-border/50 backdrop-blur-sm flex items-center justify-center",
          compact ? "w-48 h-48 p-4" : "w-64 h-64 sm:w-72 sm:h-72 p-6"
        )}>
          <svg
            ref={svgRef}
            width="203"
            height="204"
            viewBox="0 0 203 204"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(compact ? "w-36 h-36" : "w-48 h-48 sm:w-56 sm:h-56")}
          >
            {/* Box Front fill (main rectangle) */}
            <path
              d="M8.69714 62.3362 L110.377 62.3362 L110.377 155.646 L110.377 184.479 C110.377 190.864 105.201 196.041 98.815 196.041 L20.2595 196.041 C13.8738 196.041 8.69713 190.864 8.69713 184.479 L8.69713 155.646 Z"
              fill={colors.boxFront}
              className="cursor-pointer transition-all duration-200 hover:brightness-95"
              onClick={() => setActiveSection("boxFront")}
              stroke="none"
            />

            {/* Box Lid fill (parallelogram on top) */}
            <path
              d="M8.69714 62.3362 L59.6897 11.3436 C61.8581 9.17521 64.7991 7.95704 67.8656 7.95704 L164.757 7.95704 L110.377 62.3362 Z"
              fill={colors.boxLid}
              className="cursor-pointer transition-all duration-200 hover:brightness-95"
              onClick={() => setActiveSection("boxLid")}
              stroke="none"
            />

            {/* Tag fill (rotated rounded rectangle) */}
            <path
              d="M110.377 155.646 L164.757 101.267 L191.127 127.638 C195.643 132.153 195.643 139.474 191.127 143.99 L153.1 182.017 C148.584 186.533 141.263 186.532 136.748 182.017 Z"
              fill={colors.tag}
              className="cursor-pointer transition-all duration-200 hover:brightness-95"
              onClick={() => setActiveSection("tag")}
              stroke="none"
            />

            {/* Right side panel fill */}
            <path
              d="M110.377 62.3362 L164.757 7.95704 L164.757 101.267 L110.377 155.646 Z"
              fill={colors.boxLid}
              opacity="0.7"
              stroke="none"
            />

            {/* Stroke outline on top */}
            <path
              d="M8.69714 62.3362L8.69713 155.646L8.69713 184.479C8.69713 190.864 13.8738 196.041 20.2595 196.041L98.815 196.041C105.201 196.041 110.377 190.864 110.377 184.479L110.377 155.646M8.69714 62.3362L110.377 62.3362M8.69714 62.3362L59.6897 11.3436C61.8581 9.17521 64.7991 7.95704 67.8656 7.95704L164.757 7.95704M110.377 62.3362L164.757 7.95704M110.377 62.3362L110.377 155.646M164.757 7.95704L164.757 101.267M110.377 155.646L164.757 101.267M110.377 155.646L136.748 182.017C141.263 186.532 148.584 186.533 153.1 182.017L191.127 143.99C195.643 139.474 195.643 132.153 191.127 127.638L164.757 101.267"
              stroke="currentColor"
              strokeWidth="15.8983"
              className="text-foreground"
            />
          </svg>
        </div>

        {/* Active section indicator */}
        {activeSection && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground bg-card/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50"
          >
            Editing: {sectionLabels[activeSection]}
          </motion.div>
        )}
      </motion.div>

      {/* Section selector pills */}
      <div className="flex gap-2 mt-2">
        {(Object.keys(sectionLabels) as Array<keyof typeof DEFAULT_COLORS>).map((key) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
              activeSection === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary"
            )}
          >
            <span
              className="w-3 h-3 rounded-full border border-border/50"
              style={{ backgroundColor: colors[key] }}
            />
            {sectionLabels[key]}
          </button>
        ))}
      </div>

      {/* Color palette */}
      {activeSection && (
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xs"
        >
          <div className="grid grid-cols-8 gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                title={preset.name}
                onClick={() => setColor(activeSection, preset.value)}
                className={cn(
                  "w-8 h-8 rounded-xl border-2 transition-all hover:scale-110",
                  colors[activeSection] === preset.value
                    ? "border-foreground scale-110 shadow-md"
                    : "border-border/40"
                )}
                style={{ backgroundColor: preset.value }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={randomize}
          className="rounded-xl gap-1.5"
        >
          <Shuffle className="w-3.5 h-3.5" />
          Randomize
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          className="rounded-xl gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportPng}
          className="rounded-xl gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </div>
    </div>
  );
};

export { LogoCustomizer };
export default LogoCustomizer;
