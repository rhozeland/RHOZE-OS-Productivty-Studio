/**
 * PositioningPillars — Always-on strip communicating Rhozeland's four
 * differentiators vs Fiverr (real creative work, verified provenance) and
 * vs Zora/pump.fun (instant settlement, shared upside). Style mirrors the
 * existing Creator Pass tier banner (rounded card, subtle border, muted text).
 */
import { Check, ShieldCheck, Zap, TrendingUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const PILLARS = [
  { icon: Check, label: "Real creative work" },
  { icon: ShieldCheck, label: "Verified provenance" },
  { icon: Zap, label: "Instant settlement" },
  { icon: TrendingUp, label: "Shared upside" },
];

const PositioningPillars = () => {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm px-4 py-3">
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
        {PILLARS.map((p, i) => (
          <div key={p.label} className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-foreground/80">
                <p.icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                {p.label}
              </span>
            </div>
            {i < PILLARS.length - 1 && (
              <Separator orientation="vertical" className="h-6 hidden sm:block ml-auto" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PositioningPillars;
