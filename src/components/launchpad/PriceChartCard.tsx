/**
 * PriceChartCard — pump.fun-style live price chart for a coin launch.
 *
 * Live behavior:
 *   - Subscribes to `coin_trades` realtime inserts → chart updates the moment
 *     a trade lands (no 10s polling delay).
 *   - "LIVE" pill pulses; "updated Ns ago" timer ticks every second so users
 *     can see the feed is breathing.
 *   - The big price up top flashes green/red briefly when it changes.
 *   - Soft polling fallback (8s) covers the rare case realtime drops.
 *
 * Bonding-curve view was removed — irrelevant in the demo and confused users.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, CandlestickChart, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Range = "1M" | "15M" | "1H" | "6H" | "1D" | "ALL";

const RANGE_MS: Record<Range, number | null> = {
  "1M": 60 * 1000,
  "15M": 15 * 60 * 1000,
  "1H": 60 * 60 * 1000,
  "6H": 6 * 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
  ALL: null,
};

const RANGE_LABELS: Record<Range, string> = {
  "1M": "Last 1 minute",
  "15M": "Last 15 minutes",
  "1H": "Last 1 hour",
  "6H": "Last 6 hours",
  "1D": "Last 24 hours",
  ALL: "All time",
};

// 1 SOL on the simulated curve = 100 $RHOZE.
const RHOZE_PER_SOL = 100;
const toRhoze = (sol: number) => sol * RHOZE_PER_SOL;

function fmtPrice(p: number) {
  if (!isFinite(p) || p <= 0) return "0";
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  const s = p.toFixed(20);
  const m = s.match(/^0\.0*(?=\d)/);
  if (!m) return p.toPrecision(3);
  const zeros = m[0].length - 2;
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

function fmtAgo(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
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
}

type TradeRow = {
  id: string;
  side: "buy" | "sell";
  sol_amount: number | string;
  token_amount: number | string;
  price_per_token: number | string;
  created_at: string;
};

type CandleRow = {
  t: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  bodyBase: number;
  bodySize: number;
  wickBase: number;
  wickSize: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  dominantSide: "buy" | "sell";
  tradeCount: number;
};

type TickRow = {
  t: number;
  label: string;
  price: number;
  volume: number;
  side: "buy" | "sell";
};

const RANGE_CANDLE_BUCKET_MS: Record<Range, number> = {
  "1M": 10 * 1000,
  "15M": 60 * 1000,
  "1H": 5 * 60 * 1000,
  "6H": 15 * 60 * 1000,
  "1D": 60 * 60 * 1000,
  ALL: 12 * 60 * 60 * 1000,
};

function formatAxisTime(ts: number, range: Range) {
  const date = new Date(ts);
  if (range === "1M" || range === "15M" || range === "1H") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "6H" || range === "1D") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function bucketTrades(trades: TickRow[], range: Range): CandleRow[] {
  if (!trades.length) return [];

  const bucketMs = RANGE_CANDLE_BUCKET_MS[range];
  const buckets = new Map<number, CandleRow>();

  for (const trade of trades) {
    const bucketStart = Math.floor(trade.t / bucketMs) * bucketMs;
    const existing = buckets.get(bucketStart);
    if (!existing) {
      buckets.set(bucketStart, {
        t: bucketStart,
        label: formatAxisTime(bucketStart, range),
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        bodyBase: trade.price,
        bodySize: 0.000001,
        wickBase: trade.price,
        wickSize: 0.000001,
        buyVolume: trade.side === "buy" ? trade.volume : 0,
        sellVolume: trade.side === "sell" ? trade.volume : 0,
        totalVolume: trade.volume,
        dominantSide: trade.side,
        tradeCount: 1,
      });
      continue;
    }

    existing.high = Math.max(existing.high, trade.price);
    existing.low = Math.min(existing.low, trade.price);
    existing.close = trade.price;
    existing.totalVolume += trade.volume;
    existing.tradeCount += 1;
    if (trade.side === "buy") existing.buyVolume += trade.volume;
    else existing.sellVolume += trade.volume;
    existing.dominantSide = existing.buyVolume >= existing.sellVolume ? "buy" : "sell";
  }

  return Array.from(buckets.values())
    .map((candle) => {
      candle.bodyBase = Math.min(candle.open, candle.close);
      candle.bodySize = Math.max(Math.abs(candle.close - candle.open), 0.000001);
      candle.wickBase = candle.low;
      candle.wickSize = Math.max(candle.high - candle.low, 0.000001);
      return candle;
    })
    .sort((a, b) => a.t - b.t);
}

const PriceChartCard = ({ launchId, ticker }: Props) => {
  const [range, setRange] = useState<Range>("ALL");
  const qc = useQueryClient();

  const { data: trades, isLoading } = useQuery({
    queryKey: ["launch-chart-trades", launchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_trades")
        .select("id, side, sol_amount, token_amount, price_per_token, created_at")
        .eq("launch_id", launchId)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 8_000, // gentle fallback if realtime drops
  });

  // Realtime: invalidate on any new trade for this launch.
  useEffect(() => {
    const channel = supabase
      .channel(`coin-trades:${launchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coin_trades",
          filter: `launch_id=eq.${launchId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["launch-chart-trades", launchId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [launchId, qc]);

  const tickSeries = useMemo(() => {
    const all = ((trades ?? []) as TradeRow[]).map((t) => ({
      t: new Date(t.created_at).getTime(),
      label: formatAxisTime(new Date(t.created_at).getTime(), range),
      price: toRhoze(Number(t.price_per_token)),
      side: t.side as "buy" | "sell",
      rhoze: toRhoze(Number(t.sol_amount)),
      volume: toRhoze(Number(t.sol_amount)),
    }));
    const ms = RANGE_MS[range];
    if (!ms) return all;
    const cutoff = Date.now() - ms;
    const filtered = all.filter((d) => d.t >= cutoff);
    return filtered.length > 0 ? filtered : all;
  }, [trades, range]);

  const candleSeries = useMemo(() => bucketTrades(tickSeries, range), [tickSeries, range]);

  const chartSeries = candleSeries.length >= 2 ? candleSeries : [];

  const lastTrade = tickSeries.length ? tickSeries[tickSeries.length - 1] : null;
  const lastPrice = lastTrade?.price ?? 0;
  const firstPrice = tickSeries.length ? tickSeries[0].price : 0;
  const lastTradeAt = lastTrade?.t ?? null;
  const pct = fmtPct(lastPrice, firstPrice);
  const up = (pct ?? 0) >= 0;
  const buyTrades = tickSeries.filter((trade) => trade.side === "buy");
  const sellTrades = tickSeries.filter((trade) => trade.side === "sell");
  const buyVolume = buyTrades.reduce((sum, trade) => sum + trade.volume, 0);
  const sellVolume = sellTrades.reduce((sum, trade) => sum + trade.volume, 0);
  const dominantSide = buyVolume >= sellVolume ? "buy" : "sell";

  // Tick a 1s clock so "Ns ago" actually counts up.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // Flash the price when it changes (green up / rose down for ~600ms).
  const prevPriceRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const prev = prevPriceRef.current;
    if (prev !== null && lastPrice !== prev) {
      setFlash(lastPrice > prev ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
    prevPriceRef.current = lastPrice;
  }, [lastPrice]);

  const isStale = lastTradeAt ? now - lastTradeAt > 60_000 : true;

  return (
    <Card className="bg-card/40 backdrop-blur overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* ── Top: live price + delta ─────────────────────────── */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                {!isStale && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    isStale ? "bg-muted-foreground/50" : "bg-emerald-500"
                  }`}
                />
              </span>
              Live · ${ticker}
              <span className="text-muted-foreground/60 normal-case tracking-normal">
                {lastTradeAt ? `· updated ${fmtAgo(now - lastTradeAt)}` : "· awaiting first trade"}
              </span>
            </div>
            <div
              className={`text-2xl md:text-3xl font-bold font-mono mt-1 tabular-nums transition-colors duration-300 ${
                flash === "up"
                  ? "text-emerald-400"
                  : flash === "down"
                  ? "text-rose-400"
                  : "text-foreground"
              }`}
            >
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

        {/* Toolbar: timeframe + live badge */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="radiogroup"
            aria-label="Chart timeframe"
            className="inline-flex rounded-full border border-border/60 bg-muted/30 p-0.5 text-[10px] font-mono"
            onKeyDown={(e) =>
              handleRovingKeyDown<Range>(e, ["1M", "15M", "1H", "6H", "1D", "ALL"], range, setRange)
            }
          >
            {(["1M", "15M", "1H", "6H", "1D", "ALL"] as Range[]).map((r) => {
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
                    selected
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>

          <Badge
            variant="outline"
            className={`text-[10px] gap-1 ${
              isStale
                ? "border-border/60 text-muted-foreground"
                : "border-border/60 text-foreground bg-muted/20"
            }`}
            aria-live="polite"
          >
            <Radio className={`h-2.5 w-2.5 ${isStale ? "" : "animate-pulse"}`} aria-hidden="true" />
            {isStale ? "Idle" : "LIVE"}
            <span className="text-muted-foreground ml-1">
              · {tickSeries.length} trade{tickSeries.length === 1 ? "" : "s"}
            </span>
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <TapeStat
            label="Buys"
            value={`${buyTrades.length}`}
            detail={`${buyVolume.toFixed(2)} $RHOZE`}
            side="buy"
          />
          <TapeStat
            label="Sells"
            value={`${sellTrades.length}`}
            detail={`${sellVolume.toFixed(2)} $RHOZE`}
            side="sell"
          />
          <TapeStat
            label="Dominant"
            value={dominantSide === "buy" ? "Buying" : "Selling"}
            detail={pct === null ? RANGE_LABELS[range] : `${Math.abs(pct).toFixed(2)}% move`}
            side={dominantSide}
          />
          <TapeStat
            label="Last print"
            value={lastTrade ? fmtPrice(lastTrade.price) : "0"}
            detail={lastTrade ? `${lastTrade.volume.toFixed(2)} $RHOZE ${lastTrade.side}` : "Awaiting trade"}
            side={lastTrade?.side ?? "buy"}
          />
        </div>

        {/* Chart */}
        <div className="h-[320px] -mx-1 rounded-lg bg-background/40">
          {isLoading ? (
            <div className="h-full w-full animate-pulse bg-muted/30 rounded-md" />
          ) : tickSeries.length === 0 ? (
            <EmptyChart message="Chart will appear after the first trade." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSeries.length ? chartSeries : tickSeries} margin={{ top: 8, right: 18, left: 0, bottom: 2 }}>
                <CartesianGrid stroke="hsl(var(--chart-grid))" strokeOpacity={0.4} vertical={false} />
                <XAxis
                  dataKey={chartSeries.length ? "label" : "label"}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="price"
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => fmtPrice(Number(v))}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <YAxis yAxisId="volume" hide domain={[0, "auto"]} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as CandleRow | TickRow;
                    const isCandle = "open" in p;
                    return (
                      <div className="rounded-md border border-border/60 bg-background/95 backdrop-blur px-2.5 py-1.5 text-[11px] shadow-lg">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium uppercase">{isCandle ? "Candle" : p.side}</span>
                          <span className="text-muted-foreground">
                            {new Date(p.t).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {isCandle ? (
                          <>
                            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px]">
                              <span>O {fmtPrice(p.open)}</span>
                              <span>H {fmtPrice(p.high)}</span>
                              <span>L {fmtPrice(p.low)}</span>
                              <span>C {fmtPrice(p.close)}</span>
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground mt-1">
                              {p.totalVolume.toFixed(2)} $RHOZE · {p.tradeCount} trades
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-mono mt-0.5">
                              {fmtPrice(p.price)} $RHOZE / ${ticker}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {p.volume.toFixed(2)} $RHOZE traded
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar yAxisId="volume" dataKey={chartSeries.length ? "totalVolume" : "volume"} maxBarSize={18} radius={[2, 2, 0, 0]}>
                  {(chartSeries.length ? chartSeries : tickSeries).map((entry) => (
                    <Cell
                      key={`vol-${entry.t}`}
                      fill={`hsl(var(${("dominantSide" in entry ? entry.dominantSide : entry.side) === "buy" ? "--chart-up" : "--chart-down"}) / 0.18)`}
                    />
                  ))}
                </Bar>
                {chartSeries.length ? (
                  <>
                    <Bar yAxisId="price" dataKey="wickBase" stackId="wick" fillOpacity={0} />
                    <Bar yAxisId="price" dataKey="wickSize" stackId="wick" maxBarSize={6} radius={[999, 999, 999, 999]}>
                      {chartSeries.map((entry) => (
                        <Cell
                          key={`wick-${entry.t}`}
                          fill={`hsl(var(${entry.close >= entry.open ? "--chart-up" : "--chart-down"}))`}
                        />
                      ))}
                    </Bar>
                    <Bar yAxisId="price" dataKey="bodyBase" stackId="candle" fillOpacity={0} />
                    <Bar yAxisId="price" dataKey="bodySize" stackId="candle" minPointSize={3} maxBarSize={16} radius={[3, 3, 3, 3]}>
                      {chartSeries.map((entry) => (
                        <Cell
                          key={`body-${entry.t}`}
                          fill={`hsl(var(${entry.close >= entry.open ? "--chart-up" : "--chart-down"}))`}
                        />
                      ))}
                    </Bar>
                  </>
                ) : (
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="price"
                    stroke={`hsl(var(${up ? "--chart-up" : "--chart-down"}))`}
                    strokeWidth={2}
                    dot={{ r: 2, fill: `hsl(var(${up ? "--chart-up" : "--chart-down"}))` }}
                    activeDot={{ r: 4 }}
                    isAnimationActive
                    animationDuration={350}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const TapeStat = ({
  label,
  value,
  detail,
  side,
}: {
  label: string;
  value: string;
  detail: string;
  side: "buy" | "sell";
}) => {
  const Icon = side === "buy" ? ArrowUpRight : ArrowDownLeft;

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide text-[10px]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{value}</span>
        <span className="text-[10px] text-muted-foreground text-right">{detail}</span>
      </div>
    </div>
  );
};

const EmptyChart = ({ message }: { message: string }) => (
  <div className="h-full w-full flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/50 bg-muted/10">
    <CandlestickChart className="h-6 w-6 text-muted-foreground/40" />
    <p className="text-xs text-muted-foreground">{message}</p>
  </div>
);

export default PriceChartCard;
