import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, CandlestickChart, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Range = "1M" | "15M" | "1H" | "6H" | "1D" | "ALL";
type TradeSide = "buy" | "sell";

type TradeRow = {
  id: string;
  side: TradeSide;
  sol_amount: number | string;
  token_amount: number | string;
  price_per_token: number | string;
  created_at: string;
};

type TickRow = {
  id: string;
  t: number;
  label: string;
  price: number;
  side: TradeSide;
  volume: number;
};

type CandleRow = {
  t: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  dominantSide: TradeSide;
  tradeCount: number;
};

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

const RANGE_BUCKET_MS: Record<Range, number> = {
  "1M": 10 * 1000,
  "15M": 60 * 1000,
  "1H": 5 * 60 * 1000,
  "6H": 15 * 60 * 1000,
  "1D": 60 * 60 * 1000,
  ALL: 12 * 60 * 60 * 1000,
};

const CHART_UP = "hsl(var(--chart-up))";
const CHART_DOWN = "hsl(var(--chart-down))";
const CHART_GRID = "hsl(var(--chart-grid))";
const CHART_UP_SOFT = "hsl(var(--chart-up) / 0.14)";
const CHART_DOWN_SOFT = "hsl(var(--chart-down) / 0.14)";
const RHOZE_PER_SOL = 100;

const toRhoze = (sol: number) => sol * RHOZE_PER_SOL;

function fmtPrice(price: number) {
  if (!isFinite(price) || price <= 0) return "0";
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.01) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toFixed(8);
}

function fmtPct(now: number, prev: number) {
  if (!prev || !isFinite(prev)) return null;
  return ((now - prev) / prev) * 100;
}

function fmtAgo(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAxisTime(ts: number, range: Range) {
  const date = new Date(ts);
  if (range === "ALL") {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  if (range === "1D") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

function bucketTrades(trades: TickRow[], range: Range): CandleRow[] {
  if (!trades.length) return [];

  const bucketMs = RANGE_BUCKET_MS[range];
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
    existing.tradeCount += 1;
    existing.totalVolume += trade.volume;
    if (trade.side === "buy") existing.buyVolume += trade.volume;
    else existing.sellVolume += trade.volume;
    existing.dominantSide = existing.buyVolume >= existing.sellVolume ? "buy" : "sell";
  }

  return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
}

function buildPolyline(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number) {
  if (!points.length) return "";
  const polyline = buildPolyline(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${polyline} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

function pickLabelIndices(length: number) {
  const indices = new Set<number>();
  if (length <= 1) {
    indices.add(0);
    return indices;
  }

  const desired = 4;
  const step = Math.max(1, Math.ceil((length - 1) / (desired - 1)));
  for (let i = 0; i < length; i += step) indices.add(i);
  indices.add(length - 1);
  return indices;
}

interface Props {
  launchId: string;
  ticker: string;
}

const PriceChartCard = ({ launchId, ticker }: Props) => {
  const [range, setRange] = useState<Range>("ALL");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const qc = useQueryClient();
  const chartWrapRef = useRef<HTMLDivElement | null>(null);

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
      return (data ?? []) as TradeRow[];
    },
    refetchInterval: 8_000,
  });

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

  const filtered = useMemo(() => {
    const all = (trades ?? []).map((trade) => ({
      id: trade.id,
      t: new Date(trade.created_at).getTime(),
      label: formatAxisTime(new Date(trade.created_at).getTime(), range),
      price: toRhoze(Number(trade.price_per_token)),
      side: trade.side,
      volume: toRhoze(Number(trade.sol_amount)),
    }));

    const windowMs = RANGE_MS[range];
    if (!windowMs) return { series: all, fellBack: false };

    const cutoff = Date.now() - windowMs;
    const ranged = all.filter((trade) => trade.t >= cutoff);
    if (ranged.length > 0) return { series: ranged, fellBack: false };
    return { series: all, fellBack: all.length > 0 };
  }, [range, trades]);

  const tickSeries = filtered.series;
  const fellBackToAll = filtered.fellBack;
  const candleSeries = useMemo(() => bucketTrades(tickSeries, range), [range, tickSeries]);

  const lastTrade = tickSeries.length ? tickSeries[tickSeries.length - 1] : null;
  const firstTrade = tickSeries.length ? tickSeries[0] : null;
  const lastPrice = lastTrade?.price ?? 0;
  const pct = fmtPct(lastPrice, firstTrade?.price ?? 0);
  const trendUp = (pct ?? 0) >= 0;
  const lastTradeAt = lastTrade?.t ?? null;

  const buyTrades = tickSeries.filter((trade) => trade.side === "buy");
  const sellTrades = tickSeries.filter((trade) => trade.side === "sell");
  const buyVolume = buyTrades.reduce((sum, trade) => sum + trade.volume, 0);
  const sellVolume = sellTrades.reduce((sum, trade) => sum + trade.volume, 0);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const prevPriceRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const prev = prevPriceRef.current;
    if (prev !== null && lastPrice !== prev) {
      setFlash(lastPrice > prev ? "up" : "down");
      const timeout = setTimeout(() => setFlash(null), 600);
      prevPriceRef.current = lastPrice;
      return () => clearTimeout(timeout);
    }
    prevPriceRef.current = lastPrice;
  }, [lastPrice]);

  const displayCandles = useMemo<CandleRow[]>(() => {
    if (candleSeries.length > 0) return candleSeries;
    return tickSeries.map((trade) => ({
      t: trade.t,
      label: trade.label,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      buyVolume: trade.side === "buy" ? trade.volume : 0,
      sellVolume: trade.side === "sell" ? trade.volume : 0,
      totalVolume: trade.volume,
      dominantSide: trade.side,
      tradeCount: 1,
    }));
  }, [candleSeries, tickSeries]);

  const isStale = lastTradeAt ? now - lastTradeAt > 60_000 : true;

  const chart = useMemo(() => {
    const viewBox = { width: 900, height: 340 };
    const margin = { top: 18, right: 18, bottom: 46, left: 72 };
    const volumeHeight = 52;
    const priceHeight = viewBox.height - margin.top - margin.bottom - volumeHeight - 10;
    const priceBottom = margin.top + priceHeight;
    const volumeTop = priceBottom + 10;
    const volumeBottom = viewBox.height - margin.bottom;
    const innerWidth = viewBox.width - margin.left - margin.right;

    const highs = displayCandles.map((candle) => candle.high);
    const lows = displayCandles.map((candle) => candle.low);
    const volumes = displayCandles.map((candle) => candle.totalVolume);
    const maxPrice = Math.max(...highs, 1);
    const minPrice = Math.min(...lows, maxPrice);
    const spread = Math.max(maxPrice - minPrice, maxPrice * 0.06, 0.000001);
    const paddedMin = Math.max(0, minPrice - spread * 0.14);
    const paddedMax = maxPrice + spread * 0.14;
    const maxVolume = Math.max(...volumes, 1);

    const toY = (value: number) => {
      const ratio = (value - paddedMin) / Math.max(paddedMax - paddedMin, 0.000001);
      return priceBottom - ratio * priceHeight;
    };

    const toVolumeY = (value: number) => volumeBottom - (value / maxVolume) * volumeHeight;

    const count = displayCandles.length;
    const step = count > 1 ? innerWidth / (count - 1) : innerWidth / 2;
    const xForIndex = (index: number) => (count > 1 ? margin.left + index * step : margin.left + innerWidth / 2);
    const bodyWidth = Math.max(8, Math.min(20, (count > 1 ? step : innerWidth) * 0.46));

    const linePoints = displayCandles.map((candle, index) => ({ x: xForIndex(index), y: toY(candle.close) }));
    const linePath = buildPolyline(linePoints);
    const areaPath = buildAreaPath(linePoints, priceBottom);
    const yTicks = Array.from({ length: 4 }, (_, idx) => paddedMin + ((paddedMax - paddedMin) * idx) / 3).reverse();
    const xLabelIndices = pickLabelIndices(count);

    return {
      viewBox,
      margin,
      priceBottom,
      volumeBottom,
      volumeTop,
      toY,
      toVolumeY,
      xForIndex,
      bodyWidth,
      linePath,
      areaPath,
      yTicks,
      xLabelIndices,
    };
  }, [displayCandles]);

  useEffect(() => {
    if (hoveredIndex !== null && hoveredIndex >= displayCandles.length) {
      setHoveredIndex(displayCandles.length ? displayCandles.length - 1 : null);
    }
  }, [displayCandles.length, hoveredIndex]);

  const activeCandle = hoveredIndex === null ? displayCandles[displayCandles.length - 1] : displayCandles[hoveredIndex];
  const recentPrints = tickSeries.slice(-4).reverse();

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!displayCandles.length || !chartWrapRef.current) return;

    const rect = chartWrapRef.current.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const plotLeft = (chart.margin.left / chart.viewBox.width) * rect.width;
    const plotRight = rect.width - (chart.margin.right / chart.viewBox.width) * rect.width;

    if (relativeX < plotLeft || relativeX > plotRight) {
      setHoveredIndex(null);
      return;
    }

    const ratio = (relativeX - plotLeft) / Math.max(plotRight - plotLeft, 1);
    const nextIndex = Math.round(ratio * Math.max(displayCandles.length - 1, 0));
    setHoveredIndex(Math.min(Math.max(nextIndex, 0), displayCandles.length - 1));
  };

  return (
    <Card className="overflow-hidden bg-card/40 backdrop-blur">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                {!isStale && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40" />}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isStale ? "bg-muted-foreground/50" : "bg-foreground"}`} />
              </span>
              Live · ${ticker}
              <span className="normal-case tracking-normal text-muted-foreground/70">
                {lastTradeAt ? `· updated ${fmtAgo(now - lastTradeAt)}` : "· awaiting first trade"}
              </span>
            </div>
            <div
              className={`mt-1 font-mono text-2xl font-bold tabular-nums transition-colors duration-300 md:text-3xl ${
                flash === "up" ? "text-foreground" : flash === "down" ? "text-destructive" : "text-foreground"
              }`}
            >
              {fmtPrice(lastPrice)} <span className="text-sm font-normal text-muted-foreground">$RHOZE</span>
            </div>
          </div>

          {pct !== null && (
            <div className="text-right font-mono text-sm font-semibold" style={{ color: trendUp ? CHART_UP : CHART_DOWN }}>
              {trendUp ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
              <div className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                {RANGE_LABELS[range]}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="radiogroup"
            aria-label="Chart timeframe"
            className="inline-flex rounded-full border border-border/60 bg-muted/30 p-0.5 text-[10px] font-mono"
            onKeyDown={(e) => handleRovingKeyDown<Range>(e, ["1M", "15M", "1H", "6H", "1D", "ALL"], range, setRange)}
          >
            {(["1M", "15M", "1H", "6H", "1D", "ALL"] as Range[]).map((option) => {
              const selected = range === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={RANGE_LABELS[option]}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setRange(option)}
                  className={`rounded-full px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                    selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <Badge variant="outline" className="gap-1 border-border/60 bg-muted/20 text-[10px] text-foreground" aria-live="polite">
            <Radio className={`h-2.5 w-2.5 ${isStale ? "" : "animate-pulse"}`} aria-hidden="true" />
            {isStale ? "Idle" : "LIVE"}
            <span className="ml-1 text-muted-foreground">· {tickSeries.length} trade{tickSeries.length === 1 ? "" : "s"}</span>
          </Badge>
        </div>

        {fellBackToAll && (
          <p className="text-[11px] text-muted-foreground">
            No trades landed in {RANGE_LABELS[range].toLowerCase()} yet, so this view is showing all recent activity instead.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
          <TapeStat label="Buys" value={`${buyTrades.length}`} detail={`${buyVolume.toFixed(2)} $RHOZE`} side="buy" />
          <TapeStat label="Sells" value={`${sellTrades.length}`} detail={`${sellVolume.toFixed(2)} $RHOZE`} side="sell" />
          <TapeStat
            label="Selected"
            value={activeCandle ? fmtPrice(activeCandle.close) : "0"}
            detail={activeCandle ? `${activeCandle.tradeCount} trade${activeCandle.tradeCount === 1 ? "" : "s"}` : "Awaiting trade"}
            side={activeCandle?.dominantSide ?? "buy"}
          />
          <TapeStat
            label="Range"
            value={RANGE_LABELS[range].replace("Last ", "")}
            detail={lastTradeAt ? fmtAgo(now - lastTradeAt) : "No trades yet"}
            side={trendUp ? "buy" : "sell"}
          />
        </div>

        <div
          ref={chartWrapRef}
          className="relative rounded-lg bg-background/40 p-2"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {isLoading ? (
            <div className="h-[320px] w-full animate-pulse rounded-md bg-muted/30" />
          ) : !displayCandles.length ? (
            <EmptyChart message="Chart will appear after the first trade." />
          ) : (
            <>
              <svg viewBox={`0 0 ${chart.viewBox.width} ${chart.viewBox.height}`} className="h-[320px] w-full" role="img" aria-label={`Price chart for ${ticker}`}>
                <defs>
                  <linearGradient id="launch-price-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendUp ? CHART_UP : CHART_DOWN} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={trendUp ? CHART_UP : CHART_DOWN} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {chart.yTicks.map((tick) => {
                  const y = chart.toY(tick);
                  return (
                    <g key={tick}>
                      <line x1={chart.margin.left} x2={chart.viewBox.width - chart.margin.right} y1={y} y2={y} stroke={CHART_GRID} strokeOpacity="0.55" />
                      <text x={chart.margin.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">
                        {fmtPrice(tick)}
                      </text>
                    </g>
                  );
                })}

                <path d={chart.areaPath} fill="url(#launch-price-fill)" />
                <path d={chart.linePath} fill="none" stroke={trendUp ? CHART_UP : CHART_DOWN} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />

                {displayCandles.map((candle, index) => {
                  const x = chart.xForIndex(index);
                  const wickTop = chart.toY(candle.high);
                  const wickBottom = chart.toY(candle.low);
                  const openY = chart.toY(candle.open);
                  const closeY = chart.toY(candle.close);
                  const bodyTop = Math.min(openY, closeY);
                  const bodyHeight = Math.max(Math.abs(closeY - openY), 3);
                  const candleColor = candle.close >= candle.open ? CHART_UP : CHART_DOWN;
                  const volumeTop = chart.toVolumeY(candle.totalVolume);
                  const active = hoveredIndex === index;

                  return (
                    <g key={candle.t} opacity={hoveredIndex === null || active ? 1 : 0.6}>
                      <rect
                        x={x - chart.bodyWidth / 2}
                        y={volumeTop}
                        width={chart.bodyWidth}
                        height={Math.max(chart.volumeBottom - volumeTop, 2)}
                        rx="2"
                        fill={candle.dominantSide === "buy" ? CHART_UP_SOFT : CHART_DOWN_SOFT}
                      />
                      <line x1={x} x2={x} y1={wickTop} y2={wickBottom} stroke={candleColor} strokeWidth="2" strokeLinecap="round" />
                      <rect
                        x={x - chart.bodyWidth / 2}
                        y={bodyTop}
                        width={chart.bodyWidth}
                        height={bodyHeight}
                        rx="3"
                        fill={candleColor}
                      />
                    </g>
                  );
                })}

                {displayCandles.map((candle, index) => {
                  if (!chart.xLabelIndices.has(index)) return null;
                  return (
                    <text
                      key={`${candle.t}-label`}
                      x={chart.xForIndex(index)}
                      y={chart.viewBox.height - 18}
                      textAnchor="middle"
                      fontSize="10"
                      fill="hsl(var(--muted-foreground))"
                    >
                      {candle.label}
                    </text>
                  );
                })}

                {hoveredIndex !== null && activeCandle && (
                  <g>
                    <line
                      x1={chart.xForIndex(hoveredIndex)}
                      x2={chart.xForIndex(hoveredIndex)}
                      y1={chart.margin.top}
                      y2={chart.volumeBottom}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity="0.28"
                      strokeDasharray="4 4"
                    />
                    <circle
                      cx={chart.xForIndex(hoveredIndex)}
                      cy={chart.toY(activeCandle.close)}
                      r="4"
                      fill={activeCandle.close >= activeCandle.open ? CHART_UP : CHART_DOWN}
                      stroke="hsl(var(--background))"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>

              {activeCandle && (
                <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-border/60 bg-background/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur">
                  <div className="flex items-center gap-2 uppercase tracking-wide text-muted-foreground">
                    <CandlestickChart className="h-3.5 w-3.5" />
                    {new Date(activeCandle.t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px]">
                    <span>O {fmtPrice(activeCandle.open)}</span>
                    <span>H {fmtPrice(activeCandle.high)}</span>
                    <span>L {fmtPrice(activeCandle.low)}</span>
                    <span>C {fmtPrice(activeCandle.close)}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {activeCandle.totalVolume.toFixed(2)} $RHOZE · {activeCandle.tradeCount} trade{activeCandle.tradeCount === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {recentPrints.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Recent prints</div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {recentPrints.map((trade) => (
                <div key={trade.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide"
                      style={{ color: trade.side === "buy" ? CHART_UP : CHART_DOWN }}
                    >
                      {trade.side === "buy" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                      {trade.side}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{new Date(trade.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="mt-1 font-mono text-sm">{fmtPrice(trade.price)}</div>
                  <div className="text-[10px] text-muted-foreground">{trade.volume.toFixed(2)} $RHOZE</div>
                </div>
              ))}
            </div>
          </div>
        )}
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
  side: TradeSide;
}) => {
  const Icon = side === "buy" ? ArrowUpRight : ArrowDownLeft;

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{value}</span>
        <span className="text-right text-[10px] text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
};

const EmptyChart = ({ message }: { message: string }) => (
  <div className="flex h-[320px] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/50 bg-muted/10">
    <CandlestickChart className="h-6 w-6 text-muted-foreground/40" />
    <p className="text-xs text-muted-foreground">{message}</p>
  </div>
);

export default PriceChartCard;
