/**
 * UnverifiedWorkChip — surfaces "this work was uploaded by an unverified user".
 *
 * Used wherever a work appears so fans can tell at a glance whether the artist's
 * identity has been verified. The work itself can still be enjoyed/bought, but
 * the chip is a soft anti-impersonation signal.
 */
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  isUnverified?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

const UnverifiedWorkChip = ({ isUnverified, size = "sm", className }: Props) => {
  if (!isUnverified) return null;

  const sizing =
    size === "xs"
      ? "h-5 px-1.5 text-[10px] gap-1 [&_svg]:h-3 [&_svg]:w-3"
      : "h-6 px-2 text-[11px] gap-1.5 [&_svg]:h-3 [&_svg]:w-3";

  return (
    <span
      title="Unverified — uploaded by a creator whose identity hasn't been verified yet"
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        "border border-amber-500/20",
        sizing,
        className,
      )}
    >
      <ShieldAlert />
      <span>Unverified</span>
    </span>
  );
};

export default UnverifiedWorkChip;
