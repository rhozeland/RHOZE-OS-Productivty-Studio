/**
 * CreatorTokenPanel — editorial on-chain card for the Support sheet "Trade" tab.
 *
 * Renders real metrics (price, 24h change, market cap, liquidity, holders) +
 * a 7-day SVG sparkline + a pump.fun deeplink. No swap UI, ever — discovery
 * overlay only.
 */
import { ExternalLink, Coins, TrendingUp, TrendingDown } from "lucide-react";
import { useCreatorTokenMetrics, fmtUsdCompact, fmtCount } from "@/hooks/useCreatorTokenMetrics";
import { cn } from "@/lib/utils";

interface Props {
  mint: string;
  ticker: string;
  creatorName: string;
}

const Sparkline = ({ points, up }: { points: number[]; up: boolean }) => {
  if (points.length < 2) {
    return (
      <div className="h-[44px] flex items-center justify-center text-[10px] text-muted-foreground/60">
        chart loading…
      </div>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 320;
  const h = 44;
  const stride = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stride).toFixed(1)} ${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const color = up ? "hsl(142 71% 45%)" : "hsl(0 70% 55%)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-[44px]">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

const fmtPriceFull = (p: number | null): string => {
  if (p == null) return "—";
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(3)}`;
};

const CreatorTokenPanel = ({ mint, ticker, creatorName }: Props) => {
  const { data: m, isLoading } = useCreatorTokenMetrics(mint);
  const up = (m?.change24h ?? 0) >= 0;
  const secondsAgo = m ? Math.max(0, Math.round((Date.now() - m.fetchedAt) / 1000)) : 0;
  const topPct = m?.topHolderPct;
  const topPctColor = topPct == null
    ? "text-muted-foreground"
    : topPct >= 50
      ? "text-destructive"
      : topPct >= 30
        ? "text-amber-500"
        : "text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      {/* Header — ticker + price */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Coins className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-foreground">${ticker}</p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">{mint.slice(0, 8)}…{mint.slice(-6)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-semibold tabular-nums leading-none">
            {fmtPriceFull(m?.priceUsd ?? null)}
          </p>
          {m?.change24h != null && (
            <p className={cn(
              "mt-1 text-[11px] tabular-nums inline-flex items-center gap-0.5",
              up ? "text-emerald-500" : "text-destructive",
            )}>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}{m.change24h.toFixed(2)}% <span className="text-muted-foreground/70 font-normal">24h</span>
            </p>
          )}
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline points={m?.sparkline7d ?? []} up={up} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Market cap" value={fmtUsdCompact(m?.marketCapUsd ?? null)} />
        <Stat label="Liquidity" value={fmtUsdCompact(m?.liquidityUsd ?? null)} />
        <Stat label="Holders" value={fmtCount(m?.holderCount ?? null)} />
        <Stat label="Top wallet" value={topPct != null ? `${topPct.toFixed(1)}%` : "—"} valueClassName={topPctColor} />
      </div>

      {/* CTA */}
      <a
        href={`https://pump.fun/coin/${mint}`}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex w-full items-center justify-center gap-1.5 h-10 rounded-xl bg-foreground hover:bg-foreground/90 text-background text-sm font-medium transition-colors"
      >
        Trade ${ticker} on pump.fun
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Data: {m?.source ?? "—"}{m && !isLoading ? ` · updated ${secondsAgo}s ago` : ""}. {creatorName}'s coin is independently traded
        on pump.fun. Rhozeland doesn't custody, swap, or guarantee any token.
      </p>
    </div>
  );
};

const Stat = ({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <p className={cn("text-sm font-display font-semibold tabular-nums mt-0.5", valueClassName)}>{value}</p>
  </div>
);

export default CreatorTokenPanel;
