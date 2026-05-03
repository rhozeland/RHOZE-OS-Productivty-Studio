/**
 * TierMatrix — editorial tier breakdown.
 *
 * Three columns: Tier · Hold $RHOZE · Perks (coin drops folded into perks).
 * Used on Creator Pass (My Pass + Tiers tab) and the guest preview.
 */
import { cn } from "@/lib/utils";
import { TIERS, type TierId } from "@/lib/tier-matrix";
import { Check } from "lucide-react";

interface Props {
  /** Optional: highlight the user's current tier */
  activeTier?: TierId;
  className?: string;
}

export const TierMatrix = ({ activeTier, className }: Props) => {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,1fr)_2fr] gap-4 px-4 py-2.5 bg-muted/40 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
        <span>Tier</span>
        <span>Hold $RHOZE</span>
        <span>Perks</span>
      </div>

      <ul className="divide-y divide-border/40">
        {TIERS.map((t) => {
          const isActive = activeTier === t.id;
          const dropsLine =
            t.coinDropsPerMonth === null
              ? "Unlimited coin drops"
              : `${t.coinDropsPerMonth} coin drop${t.coinDropsPerMonth === 1 ? "" : "s"} / 30 days`;
          // Fold coin drops into perks (dedupe if already mentioned)
          const perks = t.benefits.some((b) => /coin drop/i.test(b))
            ? t.benefits
            : [...t.benefits, dropsLine];

          return (
            <li
              key={t.id}
              className={cn(
                "grid grid-cols-[minmax(120px,1fr)_minmax(110px,1fr)_2fr] gap-4 px-4 py-4 items-start transition-colors",
                isActive && "bg-primary/5",
              )}
            >
              {/* Tier */}
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="h-9 w-9 rounded-xl shrink-0 ring-1 ring-white/20 shadow-sm"
                  style={{ background: t.gradient }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-foreground leading-none">
                    {t.label}
                  </p>
                  {isActive && (
                    <span className="text-[9px] font-semibold tracking-wider text-primary uppercase">
                      You
                    </span>
                  )}
                </div>
              </div>

              {/* Hold */}
              <div className="flex flex-col justify-center">
                <p className="font-display text-sm font-semibold text-foreground tabular-nums">
                  {t.holdLabel}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                  $RHOZE
                </p>
              </div>

              {/* Perks */}
              <ul className="space-y-1.5">
                {perks.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-xs text-foreground/80 leading-snug"
                  >
                    <Check
                      className="h-3 w-3 mt-[3px] shrink-0"
                      style={{ color: t.glowColor }}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-muted-foreground/80 px-4 py-2.5 border-t border-border/40 bg-muted/20">
        Tier auto-upgrades the moment your $RHOZE balance crosses a threshold. No subscription, no application.
      </p>
    </div>
  );
};

export default TierMatrix;
