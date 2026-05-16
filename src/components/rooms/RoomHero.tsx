import { ReactNode } from "react";
import { todayGradient } from "@/lib/rhoze-gradients";
import { cn } from "@/lib/utils";

/**
 * RoomHero — header for the 3 rooms (Today · Connect · Vault).
 *
 * Shared daily Rhozeland gradient (`todayGradient()`) — per-room motion
 * variant gives each surface its own personality:
 *  • today   — default drift (warm, exploratory)
 *  • connect — wider sweep + slight rotation (matchmaking energy)
 *  • vault   — slow vertical breath (calm, financial)
 *
 * Blob positions + secondary accent placement also shift by variant so
 * the gradient doesn't sit in the exact same corner across rooms.
 */
type RoomVariant = "today" | "connect" | "vault";

interface Props {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  className?: string;
  variant?: RoomVariant;
}

const VARIANT: Record<
  RoomVariant,
  {
    blobClass: string;
    primaryInset: string;
    accentInset: string;
    accentOpacity: number;
    accentDuration: string;
    accentDelay: string;
  }
> = {
  today: {
    blobClass: "",
    primaryInset: "-20% -10% -20% -10%",
    accentInset: "-30% -30% 10% 30%",
    accentOpacity: 0.18,
    accentDuration: "26s",
    accentDelay: "-6s",
  },
  connect: {
    blobClass: "room-hero-blob--connect",
    primaryInset: "-25% -20% -10% -20%",
    accentInset: "10% -30% -30% -30%",
    accentOpacity: 0.22,
    accentDuration: "30s",
    accentDelay: "-12s",
  },
  vault: {
    blobClass: "room-hero-blob--vault",
    primaryInset: "-15% -5% -25% -15%",
    accentInset: "-20% 25% 20% -20%",
    accentOpacity: 0.14,
    accentDuration: "34s",
    accentDelay: "-4s",
  },
};

const RoomHero = ({
  eyebrow,
  title,
  subtitle,
  children,
  className,
  variant = "today",
}: Props) => {
  const grad = todayGradient();
  const v = VARIANT[variant];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/50 bg-card/40 px-5 sm:px-8 py-7 sm:py-9",
        className,
      )}
    >
      {/* Primary drifting blob */}
      <div
        className={cn("room-hero-blob", v.blobClass)}
        style={{ background: grad.surface, inset: v.primaryInset }}
        aria-hidden
      />
      {/* Secondary accent blob */}
      <div
        className={cn("room-hero-blob", v.blobClass)}
        style={{
          background: grad.text,
          opacity: v.accentOpacity,
          animationDuration: v.accentDuration,
          animationDelay: v.accentDelay,
          inset: v.accentInset,
        }}
        aria-hidden
      />

      <div className="relative z-10 space-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.28em] text-foreground/70 font-semibold">
          {eyebrow}
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-[1.05]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground/90 max-w-xl pt-1">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
};

export default RoomHero;
