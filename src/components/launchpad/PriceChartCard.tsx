/**
 * PriceChartCard — pump.fun-style live chart for a coin launch.
 *
 * Goals (per user feedback):
 *   - Read like pump.fun: big price up top, live pulse, simple area chart
 *   - No scary scientific notation (e-7) — formats prices for humans
 *   - Use $RHOZE units everywhere (simulation mode), not SOL
 *   - Two views: Price (default) · Bonding Curve (graduation progress)
 */
import { useMemo, useState, type KeyboardEvent } from "react";
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
import { LineChart as LineChartIcon, Activity, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type View = "price" | "curve";
type Range = "1H" | "6H" | "1D" | "ALL";

const RANGE_MS: Record<Range, number | null> = {
  "1H": 60 * 60 * 1000,
  "6H": 6 * 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
  ALL: null,
};

const RANGE_LABELS: Record<Range, string> = {
  "1H": "Last 1 hour",
  "6H": "Last 6 hours",
  "1D": "Last 24 hours",
  ALL: "All time",
};

// 1 SOL on the simulated curve = 100 $RHOZE (matches PayWithRhoze convention).
const RHOZE_PER_SOL = 100;
const toRhoze = (sol: number) => sol * RHOZE_PER_SOL;

/** Human-readable price formatting — no scientific notation. */
function fmtPrice(p: number) {
  if (!isFinite(p) || p <= 0) return "0";
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  // For very small numbers, use a compact "0.0₍n₎xxx" subscript style
  // similar to what pump.fun / GMGN show.
  const s = p.toFixed(20);
  const m = s.match(/^0\.0*(?=\d)/);
  if (!m) return p.toPrecision(3);
  const zeros = m[0].length - 2; // count zeros after "0."
  const sig = s.slice(m[0].length, m[0].length + 4);
  if (zeros <= 3) return `0.${"0".repeat(zeros)}${sig}`;
  const sub = String(zeros)
    .split("")
    .map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])
    .join("");
  return `0.0${sub}${sig}`;
}

function fmtPct(now: number, prev: number) {
  if (!prev || !isFinite(prev)) return null;
  return ((now - prev) / prev) * 100;
}

function handleRovingKeyDown<T extends string>(
  e: KeyboardEvent<HTMLDivElement>,
  options: T[],
  current: T,
  setValue: (v: T) => void,
) {
  const idx = options.indexOf(current);
  if (idx < 0) return;
  let nextIdx = idx;
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      nextIdx = (idx + 1) % options.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      nextIdx = (idx - 1 + options.length) % options.length;
      break;
    case "Home":
      nextIdx = 0;
      break;
    case "End":
      nextIdx = options.length - 1;
      break;
    default:
      return;
  }
  e.preventDefault();
  setValue(options[nextIdx]);
  const target = e.currentTarget.querySelectorAll<HTMLButtonElement>("button[role]")[nextIdx];
  target?.focus();
}

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
    refetchInterval: 10_000,
  });

  // Convert SOL-denominated price to $RHOZE-denominated for display.
  const priceSeries = useMemo(() => {
    const all = (trades ?? []).map((t) => ({
      t: new Date(t.created_at).getTime(),
      price: toRhoze(Number(t.price_per_token)),
      side: t.side as "buy" | "sell",
      rhoze: toRhoze(Number(t.sol_amount)),
    }));
    const ms = RANGE_MS[range];
    if (!ms) return all;
    const cutoff = Date.now() - ms;
    return all.filter((d) => d.t >= cutoff);
  }, [trades, range]);

  const lastPrice = priceSeries.length ? priceSeries[priceSeries.length - 1].price : 0;
  const firstPrice = priceSeries.length ? priceSeries[0].price : 0;
  const pct = fmtPct(lastPrice, firstPrice);
  const up = (pct ?? 0) >= 0;

  // Synthetic curve (graduation progress) in $RHOZE units.
  const targetRhoze = toRhoze(Number(graduationTarget));
  const nowRhoze = toRhoze(Number(realSolReserves));
  const curveSeries = useMemo(() => {
    const steps = 40;
    const out: { x: number; v: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const v = (targetRhoze * i) / steps;
      out.push({ x: v, v });
    }
    return out;
  }, [targetRhoze]);

  return (
    <Card className="bg-card/40 backdrop-blur overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* ── Top: live price + delta ─────────────────────────── */}
        {view === "price" && (
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Live price · ${ticker}
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono mt-1 tabular-nums">
                {fmtPrice(lastPrice)}{" "}
                <span className="text-sm text-muted-foreground font-normal">$RHOZE</span>
              </div>
            </div>
            {pct !== null && (
              <div
                className={`text-sm font-mono font-semibold ${
                  up ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                <div className="text-[10px] uppercase text-muted-foreground font-normal text-right tracking-wide">
                  {RANGE_LABELS[range]}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Chart view"
            className="inline-flex rounded-full border border-border/60 bg-muted/30 p-0.5 text-[11px]"
            onKeyDown={(e) => handleRovingKeyDown<View>(e, ["price", "curve"], view, setView)}
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
                handleRovingKeyDown<Range>(e, ["1H", "6H", "1D", "ALL"], range, setRange)
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

          <Badge
            variant="outline"
            className="text-[10px] gap-1 border-emerald-500/30 text-emerald-400/90"
            aria-live="polite"
          >
            <Radio className="h-2.5 w-2.5 animate-pulse" aria-hidden="true" />
            {view === "price"
              ? `${priceSeries.length} trade${priceSeries.length === 1 ? "" : "s"}`
              : `${(nowRhoze / targetRhoze * 100).toFixed(1)}% to grad`}
          </Badge>
        </div>

        {/* Chart */}
        <div className="h-[280px] -mx-1 rounded-lg bg-background/40">
          {view === "price" ? (
            isLoading ? (
              <div className="h-full w-full animate-pulse bg-muted/30 rounded-md" />
            ) : priceSeries.length === 0 ? (
              <EmptyChart message="Chart will appear after the first trade." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceSeries} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={up ? "hsl(160 84% 45%)" : "hsl(346 84% 55%)"}
                        stopOpacity={0.45}
                      />
                      <stop
                        offset="100%"
                        stopColor={up ? "hsl(160 84% 45%)" : "hsl(346 84% 55%)"}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
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
                    tickFormatter={(v) => fmtPrice(Number(v))}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
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
                            {fmtPrice(p.price)} $RHOZE / ${ticker}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {p.rhoze.toFixed(2)} $RHOZE traded
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={up ? "hsl(160 84% 45%)" : "hsl(346 84% 55%)"}
                    strokeWidth={2}
                    fill="url(#priceFill)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveSeries} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(290 84% 60%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(160 84% 45%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0, targetRhoze]}
                  tickFormatter={(v) => `${Math.round(Number(v)).toLocaleString()}`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { v: number };
                    const pctTo = (p.v / targetRhoze) * 100;
                    return (
                      <div className="rounded-md border border-border/60 bg-background/95 backdrop-blur px-2.5 py-1.5 text-[11px] shadow-lg font-mono">
                        {p.v.toFixed(0)} $RHOZE · {pctTo.toFixed(1)}% to grad
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="hsl(290 84% 60%)"
                  strokeWidth={2}
                  fill="url(#curveFill)"
                  isAnimationActive={false}
                />
                <ReferenceLine
                  x={nowRhoze}
                  stroke="hsl(160 84% 45%)"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  label={{
                    value: "You are here",
                    position: "top",
                    fill: "hsl(160 84% 45%)",
                    fontSize: 10,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {view === "curve" && (
          <p className="text-[11px] text-muted-foreground text-center">
            {nowRhoze.toLocaleString(undefined, { maximumFractionDigits: 0 })} /{" "}
            {targetRhoze.toLocaleString(undefined, { maximumFractionDigits: 0 })} $RHOZE raised — when
            the curve fills, the coin graduates and liquidity locks.
          </p>
        )}
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
