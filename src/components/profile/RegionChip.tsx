/**
 * RegionChip — tiny flag + code chip used wherever an artist surfaces.
 * Renders nothing if the region code is unknown or absent.
 */
import { getRegion } from "@/lib/regions";
import { cn } from "@/lib/utils";

interface RegionChipProps {
  code?: string | null;
  size?: "xs" | "sm";
  showLabel?: boolean;
  className?: string;
}

const RegionChip = ({ code, size = "xs", showLabel = false, className }: RegionChipProps) => {
  const region = getRegion(code);
  if (!region) return null;

  const sizing = size === "sm" ? "text-[11px] px-2 py-0.5" : "text-[10px] px-1.5 py-0.5";

  return (
    <span
      title={region.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 backdrop-blur-sm font-mono leading-none",
        sizing,
        className,
      )}
    >
      <span aria-hidden>{region.flag}</span>
      <span className="tracking-wider">{region.code}</span>
      {showLabel && <span className="font-body font-normal opacity-70">{region.label}</span>}
    </span>
  );
};

export default RegionChip;
