/**
 * RhozeRewardBadge — tiny inline chip that surfaces the $RHOZE earned
 * by completing an action. Use anywhere a CTA earns coins so users can
 * always see the exact reward upfront.
 *
 *   <RhozeRewardBadge amount={10} />            → "+10 $RHOZE"
 *   <RhozeRewardBadge amount={5} suffix="/ 7d" />→ "+5 $RHOZE / 7d"
 */
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface RhozeRewardBadgeProps {
  amount: number | string;
  /** Optional trailing suffix (e.g. "every 7 days"). */
  suffix?: string;
  size?: "xs" | "sm";
  className?: string;
}

const RhozeRewardBadge = ({
  amount,
  suffix,
  size = "xs",
  className,
}: RhozeRewardBadgeProps) => {
  const sizeClass =
    size === "sm"
      ? "text-[11px] px-2 py-0.5 gap-1"
      : "text-[10px] px-1.5 py-0.5 gap-1";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold tabular-nums",
        "bg-[hsl(var(--pink)/0.15)] border border-[hsl(var(--pink)/0.35)]",
        "text-[hsl(var(--pink))] whitespace-nowrap",
        sizeClass,
        className,
      )}
      aria-label={`Earn ${amount} RHOZE${suffix ? " " + suffix : ""}`}
    >
      <Coins className={size === "sm" ? "h-3 w-3" : "h-2.5 w-2.5"} />
      +{amount} $RHOZE
      {suffix && <span className="font-normal opacity-80 ml-0.5">{suffix}</span>}
    </span>
  );
};

export default RhozeRewardBadge;
export { RhozeRewardBadge };
