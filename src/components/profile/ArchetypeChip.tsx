/**
 * ArchetypeChip — tiny labelled dot showing a creator's archetype.
 * Used on Discover creator tiles and (optionally) profile headers.
 */
import { ARCHETYPE_BY_ID, type Archetype } from "@/lib/archetypes";

interface Props {
  archetype?: string | null;
  size?: "xs" | "sm";
  showLabel?: boolean;
  className?: string;
}

const ArchetypeChip = ({ archetype, size = "xs", showLabel = true, className }: Props) => {
  if (!archetype) return null;
  const meta = ARCHETYPE_BY_ID.get(archetype as Archetype);
  if (!meta) return null;
  const Icon = meta.icon;
  const sizing =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1.5"
      : "px-1.5 py-0.5 text-[9px] gap-1";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border backdrop-blur-md font-semibold uppercase tracking-wider",
        meta.chipClass,
        sizing,
        className ?? "",
      ].join(" ")}
      title={meta.tagline}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-2.5 w-2.5"} />
      {showLabel && meta.label}
    </span>
  );
};

export default ArchetypeChip;
