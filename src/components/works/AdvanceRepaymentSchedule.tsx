/**
 * AdvanceRepaymentSchedule — Phase 5 repayment forecast.
 *
 * For every funded advance the seller currently holds, we project a
 * repayment timeline by combining:
 *   1. Recent royalty velocity from `revenue_split_logs` (trailing 90d gross
 *      and event cadence, scoped to configs the seller owns)
 *   2. A configurable hold-back rate applied to each future settlement —
 *      defaults to 30 % of gross, the standard royalty-financing share
 *   3. The outstanding principal (funded_amount − repayments already booked
 *      via subsequent royalty logs after `funded_at`)
 *
 * Output is a per-period projection: estimated settlement date, gross
 * royalty, hold-back applied, and remaining balance after the payment —
 * plus a summary card showing total outstanding and projected payoff date.
 *
 * This is a *preview* (forecast), not a billing schedule: the underlying
 * repayments still flow through the existing revenue split pipeline. We
 * surface them so the seller can see the runway before committing to a
 * larger advance.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, subDays, differenceInDays } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  CalendarClock,
  Loader2,
  TrendingDown,
  CircleDashed,
  CheckCircle2,
} from "lucide-react";

interface Props {
  userId: string;
}

interface FundedAdvance {
  id: string;
  funded_amount: number;
  funded_at: string;
}

interface RoyaltyLog {
  total_amount: number;
  created_at: string;
}

interface RepaymentRow {
  date: Date;
  gross: number;
  holdback: number;
  remaining: number;
}

interface AdvanceForecast {
  advance: FundedAdvance;
  outstanding: number;
  alreadyRepaid: number;
  rows: RepaymentRow[];
  payoffDate: Date | null;
  weeklyHoldback: number;
}

const fmt = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmt2 = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AdvanceRepaymentSchedule = ({ userId }: Props) => {
  // 30% default hold-back — sits in the typical 20–40% range used by royalty
  // advance products. Seller can preview different scenarios.
  const [holdbackPct, setHoldbackPct] = useState<number>(30);

  const { data, isLoading } = useQuery({
    queryKey: ["advance-repayment-source", userId],
    queryFn: async () => {
      const [{ data: advances }, { data: configs }] = await Promise.all([
        (supabase as any)
          .from("capital_advance_requests")
          .select("id, funded_amount, funded_at")
          .eq("user_id", userId)
          .eq("status", "funded")
          .not("funded_amount", "is", null)
          .not("funded_at", "is", null)
          .order("funded_at", { ascending: true }),
        supabase
          .from("revenue_split_configs")
          .select("id")
          .eq("creator_id", userId),
      ]);

      const configIds = ((configs as any[]) || []).map((c) => c.id);
      let logs: RoyaltyLog[] = [];
      if (configIds.length > 0) {
        const { data: logRows } = await (supabase as any)
          .from("revenue_split_logs")
          .select("total_amount, created_at")
          .in("config_id", configIds)
          .order("created_at", { ascending: false });
        logs = (logRows || []) as RoyaltyLog[];
      }

      return {
        advances: (advances || []) as FundedAdvance[],
        logs,
      };
    },
    enabled: !!userId,
  });

  const forecasts: AdvanceForecast[] = useMemo(() => {
    if (!data) return [];
    const { advances, logs } = data;
    if (advances.length === 0) return [];

    // Trailing 90 day gross + cadence → weekly velocity baseline.
    const cutoff = subDays(new Date(), 90);
    const recent = logs.filter((l) => new Date(l.created_at) >= cutoff);
    const recentGross = recent.reduce((a, l) => a + Number(l.total_amount || 0), 0);
    // Per-week royalty velocity (≈ 12.86 weeks in 90 days).
    const weeklyGross = recentGross / 12.857;

    return advances.map((adv): AdvanceForecast => {
      const fundedAt = new Date(adv.funded_at);
      // Repayment counts only royalty events after the advance was funded.
      const postFundLogs = logs.filter(
        (l) => new Date(l.created_at) >= fundedAt,
      );
      const postFundGross = postFundLogs.reduce(
        (a, l) => a + Number(l.total_amount || 0),
        0,
      );
      const alreadyRepaid = postFundGross * (holdbackPct / 100);
      const outstanding = Math.max(
        0,
        Number(adv.funded_amount) - alreadyRepaid,
      );

      const weeklyHoldback = weeklyGross * (holdbackPct / 100);
      const rows: RepaymentRow[] = [];

      if (outstanding <= 0) {
        return {
          advance: adv,
          outstanding: 0,
          alreadyRepaid,
          rows: [],
          payoffDate: null,
          weeklyHoldback,
        };
      }

      // Project up to 26 weekly settlement events, stopping at payoff.
      // If royalty velocity is zero, we surface the advance with an
      // "insufficient velocity" empty state instead of an infinite tail.
      let remaining = outstanding;
      let date = addDays(new Date(), 7);
      let payoffDate: Date | null = null;

      if (weeklyHoldback > 0) {
        for (let i = 0; i < 26 && remaining > 0; i++) {
          const payment = Math.min(weeklyHoldback, remaining);
          remaining = Math.max(0, remaining - payment);
          rows.push({
            date,
            gross: weeklyGross,
            holdback: payment,
            remaining,
          });
          if (remaining === 0) payoffDate = date;
          date = addDays(date, 7);
        }
      }

      return {
        advance: adv,
        outstanding,
        alreadyRepaid,
        rows,
        payoffDate,
        weeklyHoldback,
      };
    });
  }, [data, holdbackPct]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading repayment forecast…
        </CardContent>
      </Card>
    );
  }

  const fundedCount = forecasts.length;

  if (fundedCount === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Repayment Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <CircleDashed className="h-4 w-4" />
            No funded advances yet. Once an advance is funded, your projected
            repayment timeline will appear here.
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalOutstanding = forecasts.reduce((a, f) => a + f.outstanding, 0);
  const totalAlreadyRepaid = forecasts.reduce((a, f) => a + f.alreadyRepaid, 0);
  // Latest payoff date across all advances drives "fully clear" estimate.
  const latestPayoff = forecasts
    .map((f) => f.payoffDate)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Repayment Schedule
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {fundedCount} funded · {fmt(totalOutstanding)} outstanding
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary band */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Outstanding
            </p>
            <p className="text-lg font-bold tabular-nums">
              {fmt(totalOutstanding)}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Repaid to date
            </p>
            <p className="text-lg font-bold tabular-nums text-emerald-500">
              {fmt(totalAlreadyRepaid)}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Projected payoff
            </p>
            <p className="text-lg font-bold tabular-nums">
              {latestPayoff ? format(latestPayoff, "MMM d, yyyy") : "—"}
            </p>
            {latestPayoff && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {differenceInDays(latestPayoff, new Date())} days from today
              </p>
            )}
          </div>
        </div>

        {/* Hold-back slider */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-primary" />
              Royalty hold-back
            </span>
            <span className="font-mono tabular-nums">{holdbackPct}% of each settlement</span>
          </div>
          <Slider
            min={10}
            max={60}
            step={5}
            value={[holdbackPct]}
            onValueChange={(v) => setHoldbackPct(v[0])}
          />
          <p className="text-[10px] text-muted-foreground">
            We forecast each settlement using your trailing 90-day royalty
            velocity, then route this percentage to the outstanding advance.
            Adjust to preview alternative repayment terms.
          </p>
        </div>

        {/* Per-advance forecast */}
        <div className="space-y-4">
          {forecasts.map((f) => (
            <div
              key={f.advance.id}
              className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Advance funded {format(new Date(f.advance.funded_at), "MMM d, yyyy")}
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {fmt(f.advance.funded_amount)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      principal
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  {f.outstanding === 0 ? (
                    <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/40">
                      <CheckCircle2 className="h-3 w-3" />
                      Cleared
                    </Badge>
                  ) : (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Remaining
                      </p>
                      <p className="text-lg font-bold tabular-nums text-foreground">
                        {fmt(f.outstanding)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {f.rows.length === 0 && f.outstanding > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  No recent royalty settlements detected — we can't project a
                  payoff date until your trailing 90-day royalty velocity is
                  greater than zero.
                </div>
              )}

              {f.rows.length > 0 && (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs min-w-[420px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                        <th className="text-left py-1.5 px-1 font-medium">#</th>
                        <th className="text-left py-1.5 px-1 font-medium">Est. settlement</th>
                        <th className="text-right py-1.5 px-1 font-medium">Gross royalty</th>
                        <th className="text-right py-1.5 px-1 font-medium">Hold-back</th>
                        <th className="text-right py-1.5 px-1 font-medium">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/20 last:border-0"
                        >
                          <td className="py-1.5 px-1 text-muted-foreground tabular-nums">
                            {i + 1}
                          </td>
                          <td className="py-1.5 px-1 tabular-nums">
                            {format(row.date, "MMM d, yyyy")}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums text-muted-foreground">
                            {fmt2(row.gross)}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums text-primary font-medium">
                            −{fmt2(row.holdback)}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums font-semibold">
                            {fmt2(row.remaining)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {f.rows.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Projection assumes {fmt2(f.weeklyHoldback)}/week routed to
                  this advance based on your recent royalty cadence. Actual
                  repayments will follow the on-chain settlement events from
                  your revenue splits.
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvanceRepaymentSchedule;
