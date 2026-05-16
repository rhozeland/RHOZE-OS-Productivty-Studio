/**
 * BackingMomentumChart — fan-friendly cumulative-raised chart.
 *
 * Shows total $RHOZE backed into a creator's drop over time as a smooth
 * area + line (always up-and-to-the-right for a fundraise). No price,
 * no candlesticks, no jargon. Used as the default chart for fans; power
 * users can flip to the price chart via the parent toggle.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const RHOZE_PER_SOL = 100;

interface Props {
  launchId: string;
}

type TradeRow = {
  id: string;
  side: "buy" | "sell";
  sol_amount: number | string;
  created_at: string;
};

type Point = { t: number; raised: number; backers: number };

const fmt = (n: number) =>
  n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(0);

const BackingMomentumChart = ({ launchId }: Props) => {
  const qc = useQueryClient();

  const { data: trades, isLoading } = useQuery({
    queryKey: ["backing-momentum-trades", launchId],
    queryFn: async () => {
      // Use SECURITY DEFINER helper that exposes per-launch trader_hash
      // instead of trader_id, so chart aggregates work without leaking
      // PII to other authenticated users.
      const { data, error } = await supabase.rpc("get_coin_trades_public", {
        _launch_id: launchId,
        _limit: 2000,
      });
      if (error) throw error;
      // Helper returns DESC; chart wants ASC.
      const rows = ((data ?? []) as Array<TradeRow & { trader_hash: string }>).slice().reverse();
      return rows;
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`backing-momentum:${launchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coin_trades", filter: `launch_id=eq.${launchId}` },
        () => qc.invalidateQueries({ queryKey: ["backing-momentum-trades", launchId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [launchId, qc]);

  const points: Point[] = useMemo(() => {
    if (!trades?.length) return [];
    let cum = 0;
    const seenBackers = new Set<string>();
    const out: Point[] = [];
    for (const t of trades) {
      const rhoze = Number(t.sol_amount) * RHOZE_PER_SOL;
      // Only count buys toward "raised" — sells reduce momentum but don't refund cumulative raised
      if (t.side === "buy") {
        cum += rhoze;
        seenBackers.add(t.trader_id);
      }
      out.push({ t: new Date(t.created_at).getTime(), raised: cum, backers: seenBackers.size });
    }
    return out;
  }, [trades]);

  const totalRaised = points.length ? points[points.length - 1].raised : 0;
  const totalBackers = points.length ? points[points.length - 1].backers : 0;

  // last 24h delta
  const last24hDelta = useMemo(() => {
    if (!points.length) return 0;
    const cutoff = Date.now() - 24 * 3600_000;
    const before = [...points].reverse().find((p) => p.t < cutoff);
    return totalRaised - (before?.raised ?? 0);
  }, [points, totalRaised]);

  const chartRef = useRef<HTMLDivElement | null>(null);

  const chart = useMemo(() => {
    const viewBox = { width: 900, height: 280 };
    const margin = { top: 14, right: 14, bottom: 32, left: 56 };
    const innerW = viewBox.width - margin.left - margin.right;
    const innerH = viewBox.height - margin.top - margin.bottom;

    if (points.length === 0) {
      return { viewBox, margin, innerW, innerH, area: "", line: "", yTicks: [] as number[] };
    }

    const t0 = points[0].t;
    const tN = points[points.length - 1].t;
    const tSpan = Math.max(tN - t0, 1);
    const maxRaised = Math.max(...points.map((p) => p.raised), 1);

    const xFor = (t: number) => margin.left + ((t - t0) / tSpan) * innerW;
    const yFor = (v: number) => margin.top + innerH - (v / maxRaised) * innerH;

    const linePts = points.map((p) => `${xFor(p.t).toFixed(1)},${yFor(p.raised).toFixed(1)}`);
    const line = `M ${linePts.join(" L ")}`;
    const area = `${line} L ${xFor(tN).toFixed(1)},${(margin.top + innerH).toFixed(1)} L ${xFor(t0).toFixed(1)},${(margin.top + innerH).toFixed(1)} Z`;

    const yTicks = [0, 0.5, 1].map((r) => maxRaised * r);

    return { viewBox, margin, innerW, innerH, area, line, yTicks };
  }, [points]);

  return (
    <Card className="overflow-hidden bg-card/40 backdrop-blur">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Backing momentum
            </div>
            <div className="mt-1 font-mono text-2xl md:text-3xl font-bold tabular-nums">
              {fmt(totalRaised)}{" "}
              <span className="text-sm font-normal text-muted-foreground">$RHOZE raised</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              from {totalBackers} {totalBackers === 1 ? "backer" : "backers"}
            </div>
          </div>
          {last24hDelta > 0 && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              +{fmt(last24hDelta)} last 24h
            </div>
          )}
        </div>

        <div ref={chartRef} className="relative rounded-lg bg-background/40 p-2">
          {isLoading ? (
            <div className="h-[260px] w-full animate-pulse rounded-md bg-muted/30" />
          ) : !points.length ? (
            <div className="flex h-[260px] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/50 bg-muted/10">
              <Sparkles className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Momentum will show after the first backer.
              </p>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${chart.viewBox.width} ${chart.viewBox.height}`}
              className="h-[260px] w-full"
              role="img"
              aria-label="Cumulative $RHOZE backed over time"
            >
              <defs>
                <linearGradient id="momentum-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-up))" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="hsl(var(--chart-up))" stopOpacity="0" />
                </linearGradient>
              </defs>
              {chart.yTicks.map((v, i) => {
                const y = chart.margin.top + chart.innerH - (v / Math.max(chart.yTicks[chart.yTicks.length - 1], 1)) * chart.innerH;
                return (
                  <g key={i}>
                    <line
                      x1={chart.margin.left}
                      x2={chart.viewBox.width - chart.margin.right}
                      y1={y}
                      y2={y}
                      stroke="hsl(var(--chart-grid))"
                      strokeOpacity="0.5"
                    />
                    <text x={chart.margin.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">
                      {fmt(v)}
                    </text>
                  </g>
                );
              })}
              <path d={chart.area} fill="url(#momentum-fill)" />
              <path
                d={chart.line}
                fill="none"
                stroke="hsl(var(--chart-up))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Every bar of growth = a fan choosing to back this creator. Their support stays
          as long as they hold — selling withdraws their stake.
        </p>
      </CardContent>
    </Card>
  );
};

export default BackingMomentumChart;
