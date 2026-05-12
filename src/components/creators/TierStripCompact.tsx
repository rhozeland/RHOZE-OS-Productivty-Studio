/**
 * TierStripCompact — condensed tier ladder.
 *
 * Replaces the full TierMatrix table on Creator Pass.
 * Renders 4 small tier chips in a row; hover (or tap on touch) reveals
 * the hold threshold + perks in a popover. Keeps the surface light and
 * lets users drill in only when curious.
 */
import { cn } from "@/lib/utils";
import { TIERS, type TierId } from "@/lib/tier-matrix";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Check } from "lucide-react";

interface Props {
  activeTier?: TierId;
  className?: string;
}

export const TierStripCompact = ({ activeTier, className }: Props) => {
  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-2", className)}>
      {TIERS.map((t) => {
        const isActive = activeTier === t.id;
        const dropsLine =
          t.coinDropsPerMonth === null
            ? "Unlimited coin drops"
            : `${t.coinDropsPerMonth} coin drop${t.coinDropsPerMonth === 1 ? "" : "s"} / 30 days`;
        const perks = t.benefits.some((b) => /coin drop/i.test(b))
          ? t.benefits
          : [...t.benefits, dropsLine];

        return (
          <HoverCard key={t.id} openDelay={80} closeDelay={60}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                  "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 bg-card/40",
                )}
              >
                <span
                  className="h-7 w-7 rounded-lg shrink-0 ring-1 ring-white/20 shadow-sm"
                  style={{ background: t.gradient }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold text-foreground leading-none">
                    {t.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                    {t.holdLabel} $RHOZE
                  </p>
                </div>
                {isActive && (
                  <span className="ml-auto text-[9px] font-semibold tracking-wider text-primary uppercase">
                    You
                  </span>
                )}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72 p-4" side="top">
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="h-8 w-8 rounded-lg ring-1 ring-white/20"
                  style={{ background: t.gradient }}
                  aria-hidden
                />
                <div>
                  <p className="font-display text-sm font-bold text-foreground leading-none">
                    {t.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                    Hold {t.holdLabel} $RHOZE
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5 mt-2">
                {perks.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-xs text-foreground/85 leading-snug"
                  >
                    <Check
                      className="h-3 w-3 mt-[3px] shrink-0"
                      style={{ color: t.glowColor }}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
};

export default TierStripCompact;
