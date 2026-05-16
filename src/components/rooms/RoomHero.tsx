import { ReactNode } from "react";
import { todayGradient } from "@/lib/rhoze-gradients";
import { cn } from "@/lib/utils";

/**
 * RoomHero — header for the 3 rooms (Today · Connect · Vault).
 *
 * Renders an animated, drifting gradient blob behind the eyebrow + headline
 * so each room gets the same warm Rhozeland personality the dashboard
 * greeting and dock pill use. Gradient rotates once per UTC day via
 * `todayGradient()`.
 */
interface Props {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional extra content (action buttons, etc) rendered after subtitle. */
  children?: ReactNode;
  className?: string;
}

const RoomHero = ({ eyebrow, title, subtitle, children, className }: Props) => {
  const grad = todayGradient();
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/50 bg-card/40 px-5 sm:px-8 py-7 sm:py-9",
        className,
      )}
    >
      {/* Drifting gradient blob */}
      <div
        className="room-hero-blob"
        style={{ background: grad.surface }}
        aria-hidden
      />
      {/* Subtle second blob — sharper accent, low opacity */}
      <div
        className="room-hero-blob"
        style={{
          background: grad.text,
          opacity: 0.18,
          animationDuration: "26s",
          animationDelay: "-6s",
          inset: "-30% -30% 10% 30%",
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
