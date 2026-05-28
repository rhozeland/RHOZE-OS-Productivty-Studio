/**
 * PositioningPillars — Always-on strip communicating Rhozeland's four
 * differentiators. Each pillar gets its own brand-aligned gradient chip
 * (mint · sky · amber · rose) with soft halo + hover lift so the row reads
 * as an editorial trust mark, not a generic icon list.
 */
import { Check, ShieldCheck, Zap, TrendingUp, type LucideIcon } from "lucide-react";

type Pillar = {
  icon: LucideIcon;
  label: string;
  sub: string;
  /** HSL triple — drives the chip gradient + halo */
  from: string;
  to: string;
};

const PILLARS: Pillar[] = [
  { icon: Check,        label: "Real creative work",   sub: "Vetted humans",      from: "170 70% 55%", to: "200 80% 60%" },
  { icon: ShieldCheck,  label: "Verified provenance",  sub: "On-chain proof",     from: "260 70% 65%", to: "292 75% 65%" },
  { icon: Zap,          label: "Instant settlement",   sub: "Paid in seconds",    from: "38 95% 60%",  to: "20 90% 62%" },
  { icon: TrendingUp,   label: "Shared upside",        sub: "Back early, earn",   from: "330 80% 65%", to: "300 75% 65%" },
];

const PositioningPillars = () => {
  return (
    <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-2 sm:p-3 overflow-hidden">
      {/* faint brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 50% 80% at 0% 50%, hsl(170 70% 55% / 0.06), transparent 60%)," +
            "radial-gradient(ellipse 50% 80% at 100% 50%, hsl(330 80% 65% / 0.06), transparent 60%)",
        }}
      />
      <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {PILLARS.map((p) => (
          <div
            key={p.label}
            className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5"
          >
            {/* hover halo */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: `radial-gradient(ellipse 80% 100% at 0% 50%, hsl(${p.from} / 0.12), transparent 70%)`,
              }}
            />
            <div className="relative shrink-0">
              {/* glow */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity"
                style={{ background: `linear-gradient(135deg, hsl(${p.from}), hsl(${p.to}))` }}
              />
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm ring-1 ring-white/30"
                style={{ background: `linear-gradient(135deg, hsl(${p.from}), hsl(${p.to}))` }}
              >
                <p.icon className="h-4 w-4" strokeWidth={2.5} />
              </div>
            </div>
            <div className="relative min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate">
                {p.label}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate">
                {p.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PositioningPillars;
