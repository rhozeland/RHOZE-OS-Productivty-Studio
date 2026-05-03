/**
 * TierMatrix — compact table breakdown of v7 tier eligibility + perks.
 *
 * Two ways to qualify per row:
 *   • Hold $RHOZE (long-term)
 *   • Or hit any one of the activity thresholds (posts / projects / listings / events / interactions)
 *
 * Used on both /rewards and the Creator Pass card.
 */
import { cn } from "@/lib/utils";
import { TIERS, type TierId } from "@/lib/tier-matrix";

interface Props {
  /** Optional: highlight the user's current tier */
  activeTier?: TierId;
  className?: string;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1_000 ? `${n / 1_000}K` : `${n}`;

export const TierMatrix = ({ activeTier, className }: Props) => {
  return (
    <div className={cn("rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2.5">Tier</th>
              <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Hold $RHOZE</th>
              <th className="text-left font-medium px-3 py-2.5">Or any one of</th>
              <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Coin drops / 30d</th>
              <th className="text-left font-medium px-3 py-2.5">Perks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {TIERS.map((t) => {
              const isActive = activeTier === t.id;
              const reqs: string[] = [];
              if (t.activity.posts) reqs.push(`${fmt(t.activity.posts)} posts`);
              if (t.activity.projects) reqs.push(`${fmt(t.activity.projects)} projects`);
              if (t.activity.listings) reqs.push(`${fmt(t.activity.listings)} listings`);
              if (t.activity.events) reqs.push(`${fmt(t.activity.events)} events hosted`);
              if (t.activity.interactions) reqs.push(`${fmt(t.activity.interactions)} interactions`);
              return (
                <tr key={t.id} className={cn("align-top", isActive && "bg-primary/5")}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-6 w-6 rounded-md shrink-0"
                        style={{ background: t.gradient }}
                        aria-hidden
                      />
                      <div className="flex flex-col">
                        <span className="font-display font-bold text-foreground">{t.label}</span>
                        {isActive && (
                          <span className="text-[9px] text-primary font-semibold tracking-wide">YOU</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-foreground/80 font-medium whitespace-nowrap">
                    {t.holdLabel}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {reqs.length === 0 ? (
                      <span className="text-foreground/60">Default — anyone signed in</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {reqs.map((r) => (
                          <li key={r} className="leading-snug">{r}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <ul className="space-y-0.5">
                      {t.benefits.map((b) => (
                        <li key={b} className="leading-snug flex gap-1.5">
                          <span
                            className="h-1 w-1 rounded-full mt-1.5 shrink-0"
                            style={{ background: t.glowColor }}
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground/80 px-4 py-2.5 border-t border-border/40 bg-muted/20">
        Tier auto-upgrades as soon as you hit a hold threshold or any single activity bar — whichever comes first. Successful interactions = bookings, support sent + received, and approved milestones.
      </p>
    </div>
  );
};

export default TierMatrix;
