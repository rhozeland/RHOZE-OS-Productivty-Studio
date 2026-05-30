/**
 * CoinGalleryTile — single coin card inside the profile coin gallery.
 *
 * v11 Pillar 8.1 — trimmed to the stats people actually care about:
 * Market Cap · ATH MC · From ATH · 24h Volume · Holders · Est. rewards.
 * Liquidity dropped (noisy + confusing for bonding-curve coins).
 *
 * Owner-only: extra "Open my rewards" CTA deeplinks the artist into
 * their pump.fun creator dashboard.
 */
import { Coins, TrendingUp, TrendingDown, ExternalLink, Star, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreatorTokenMetrics,
  fmtUsdCompact,
  fmtCount,
} from "@/hooks/useCreatorTokenMetrics";
import { cn } from "@/lib/utils";

interface Props {
  mint: string;
  ticker: string;
  isPrimary?: boolean;
  isOwner?: boolean;
  fallbackWallet?: string | null;
}

const CREATOR_REWARDS_BPS = 5;

const Sparkline = ({ points, up }: { points: number[]; up: boolean }) => {
  if (points.length < 2) {
    return <div className="h-9 rounded-md bg-muted/30" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 240;
  const h = 36;
  const stride = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stride).toFixed(1)} ${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const color = up ? "hsl(142 71% 45%)" : "hsl(0 70% 55%)";
  const id = sparkId(points);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-9">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`url(#spark-${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};
const sparkId = (arr: number[]) =>
  arr.length ? Math.abs(Math.round(arr[0] * 1e6 + arr.length * 7919)).toString(36) : "x";

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div>
    <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    <p className={cn("font-display text-sm font-semibold tabular-nums leading-tight mt-0.5", accent)}>{value}</p>
  </div>
);

const CoinGalleryTile = ({ mint, ticker: ttk, isPrimary, isOwner, fallbackWallet }: Props) => {
  const { data: m, isLoading } = useCreatorTokenMetrics(mint);
  const up = (m?.change24h ?? 0) >= 0;
  const wallet = m?.creatorWallet ?? fallbackWallet ?? null;
  const estRewardsUsd =
    m?.volumeUsd != null ? (m.volumeUsd * CREATOR_REWARDS_BPS) / 10_000 : null;
  const athChange = m?.athChangePct ?? null;
  const athTone =
    athChange == null
      ? "text-muted-foreground"
      : athChange >= -25
        ? "text-emerald-600 dark:text-emerald-400"
        : athChange >= -60
          ? "text-amber-600 dark:text-amber-400"
          : "text-destructive";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm">
      {isPrimary && (
        <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-foreground/85 text-background text-[9px] uppercase tracking-[0.14em] font-semibold px-2 py-0.5">
          <Star className="h-2.5 w-2.5" /> Primary
        </div>
      )}

      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-fuchsia-500/15 flex items-center justify-center shrink-0">
            <Coins className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold leading-none">${ttk}</p>
            <p className="text-[10px] text-muted-foreground font-mono truncate mt-1">
              {mint.slice(0, 6)}…{mint.slice(-6)}
            </p>
          </div>
          {m?.change24h != null && (
            <span className={cn(
              "shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              up ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-destructive/12 text-destructive",
            )}>
              {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {up ? "+" : ""}{m.change24h.toFixed(1)}%
            </span>
          )}
        </div>

        <Sparkline points={m?.sparkline7d ?? []} up={up} />

        <div className="grid grid-cols-3 gap-x-3 gap-y-3">
          <Stat label="Market Cap" value={isLoading ? "…" : fmtUsdCompact(m?.marketCapUsd ?? null)} />
          <Stat label="ATH MC" value={isLoading ? "…" : fmtUsdCompact(m?.athMarketCapUsd ?? null)} />
          <Stat
            label="From ATH"
            value={athChange == null ? "—" : `${athChange >= 0 ? "+" : ""}${athChange.toFixed(0)}%`}
            accent={athTone}
          />
          <Stat label="Holders" value={fmtCount(m?.holderCount ?? null)} />
          <Stat label="Volume" value={fmtUsdCompact(m?.volumeUsd ?? null)} />
          <Stat
            label={isOwner ? "Rewards earned" : "Creator earned"}
            value={fmtUsdCompact(estRewardsUsd)}
            accent="text-emerald-600 dark:text-emerald-400"
          />
        </div>

        <div className="space-y-1.5">
          <a
            href={`https://pump.fun/coin/${mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 h-10 rounded-xl bg-foreground hover:bg-foreground/90 text-background text-sm font-medium transition-colors"
          >
            Trade ${ttk} on pump.fun
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {isOwner && wallet && (
            <Button asChild variant="outline" size="sm" className="w-full gap-1.5 rounded-xl">
              <a href={`https://pump.fun/profile/${wallet}`} target="_blank" rel="noopener noreferrer">
                <Award className="h-3.5 w-3.5" /> Open my rewards dashboard
              </a>
            </Button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Rewards estimate = volume × {CREATOR_REWARDS_BPS / 100}% (pump.fun creator-rewards rate).
          Rhozeland never custodies or guarantees any token.
        </p>
      </div>
    </div>
  );
};

export default CoinGalleryTile;
