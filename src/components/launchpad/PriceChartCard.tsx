/**
 * PriceChartCard — pump.fun / Padre / Bullx-style chart for a launch.
 *
 * Two views (toggled by the user):
 *   - Price        : line + area of `price_per_token` over time, with
 *                    buy/sell dots so you can read flow at a glance.
 *   - Bonding Curve: visualizes real_sol_reserves progress toward the
 *                    graduation_sol_target (the existing progress bar
 *                    rendered as a chart).
 *
 * Timeframe pills: 1H · 6H · 1D · ALL — purely client-side filter.
 *
 * Data source: `coin_trades` (publicly readable). Uses recharts
 * (already a dep).
 */
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart as LineChartIcon, Activity, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type View = "price" | "curve";
type Range = "1H" | "6H" | "1D" | "ALL";

const RANGE_MS: Record<Range, number | null> = {
  "1H": 60 * 60 * 1000,
  "6H": 6 * 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
  ALL: null,
};

interface Props {
  launchId: string;
  ticker: string;
  realSolReserves: number;
  graduationTarget: number;
}

const PriceChartCard = ({ launchId, ticker, realSolReserves, graduationTarget }: Props) => {
  const [view, setView] = useState<View>("price");
  const [range, setRange] = useState<Range>("ALL");

  const { data: trades, isLoading } = useQuery({
    queryKey: ["launch-chart-trades", launchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_trades")
        .select("id, side, sol_amount, price_per_token, created_at")
        .eq("launch_id", launchId)
        .order("created_at", { ascending: true })
        .limit(2000);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const priceSeries = useMemo(() => {
    const all = (trades ?? []).map((t) => ({
      t: new Date(t.created_at).getTime(),
      price: Number(t.price_per_token),
      side: t.side as "buy" | "sell",
      sol: Number(t.sol_amount),
    }));
    const ms = RANGE_MS[range];
    if (!ms) return all;
    const cutoff = Date.now() - ms;
    return all.filter((d) => d.t >= cutoff);
  }, [trades, range]);

  // Synthetic curve series: SOL-in vs token-out progression toward target.
  const curveSeries = useMemo(() => {
    const target = Number(graduationTarget);
    const steps = 40;
    const out: { x: number; sol: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const sol = (target * i) / steps;
      out.push({ x: sol, sol });
    }
    return out;
  }, [graduationTarget]);

  return (
    <Card className="bg-card/40 backdrop-blur">
      <CardContent className="p-4 space-y-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Chart view"
            className="inline-flex rounded-full border border-border/60 bg-muted/30 p-0.5 text-[11px]"
            onKeyDown={(e) => handleRovingKeyDown(e, ["price", "curve"], view, setView)}
          >
            {([
              { id: "price" as const, label: "Price", Icon: LineChartIcon, desc: "Token price over time" },
              { id: "curve" as const, label: "Bonding Curve", Icon: Activity, desc: "Progress toward graduation" },
            ]).map(({ id, label, Icon, desc }) => {
              const selected = view === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`chart-tab-${id}`}
                  aria-selected={selected}
                  aria-label={`${label} view — ${desc}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setView(id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                    selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" /> {label}
                </button>
              );
            })}
          </div>

          {view === "price" && (
            <div
              role="radiogroup"
              aria-label="Chart timeframe"
              className="inline-flex rounded-full border border-border/60 bg-muted/30 p-0.5 text-[10px] font-mono"
              onKeyDown={(e) =>
                handleRovingKeyDown(e, ["1H", "6H", "1D", "ALL"] as Range[], range, setRange)
              }
            >
              {(["1H", "6H", "1D", "ALL"] as Range[]).map((r) => {
                const selected = range === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={RANGE_LABELS[r]}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setRange(r)}
                    className={`px-2 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                      selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          )}

          <Badge variant="outline" className="text-[10px] gap-1" aria-live="polite">
            <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
            {view === "price"
              ? `${priceSeries.length} pts`
              : `${realSolReserves.toFixed(2)} / ${graduationTarget} SOL`}
          </Badge>
        </div>

        {/* Chart */}
        <div className="h-[260px] -mx-1">
          {view === "price" ? (
            isLoading ? (
              <div className="h-full w-full animate-pulse bg-muted/30 rounded-md" />
            ) : priceSeries.length === 0 ? (
              <EmptyChart message="Chart will appear after the first trade." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160 84% 45%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(290 84% 60%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    }
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="price"
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => Number(v).toExponential(1)}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof priceSeries)[number];
                      return (
                        <div className="rounded-md border border-border/60 bg-background/95 backdrop-blur px-2.5 py-1.5 text-[11px] shadow-lg">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                p.side === "buy" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            <span className="font-medium uppercase">{p.side}</span>
                            <span className="text-muted-foreground">
                              {new Date(p.t).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="font-mono mt-0.5">
                            {p.price.toExponential(3)} SOL / ${ticker}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {p.sol.toFixed(4)} SOL traded
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(160 84% 45%)"
                    strokeWidth={1.75}
                    fill="url(#priceFill)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(290 84% 60%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(160 84% 45%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0, graduationTarget]}
                  tickFormatter={(v) => `${Number(v).toFixed(0)} SOL`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { sol: number };
                    const pct = (p.sol / Number(graduationTarget)) * 100;
                    return (
                      <div className="rounded-md border border-border/60 bg-background/95 backdrop-blur px-2.5 py-1.5 text-[11px] shadow-lg font-mono">
                        {p.sol.toFixed(2)} SOL · {pct.toFixed(1)}% to grad
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sol"
                  stroke="hsl(290 84% 60%)"
                  strokeWidth={1.75}
                  fill="url(#curveFill)"
                  isAnimationActive={false}
                />
                <ReferenceLine
                  x={realSolReserves}
                  stroke="hsl(160 84% 45%)"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  label={{
                    value: "Now",
                    position: "top",
                    fill: "hsl(160 84% 45%)",
                    fontSize: 10,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyChart = ({ message }: { message: string }) => (
  <div className="h-full w-full flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/50 bg-muted/10">
    <LineChartIcon className="h-6 w-6 text-muted-foreground/40" />
    <p className="text-xs text-muted-foreground">{message}</p>
  </div>
);

export default PriceChartCard;
