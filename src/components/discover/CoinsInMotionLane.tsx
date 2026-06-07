/**
 * CoinsInMotionLane — v11 Tier 2 discovery surface.
 *
 * Pulls every profile that has linked a pump.fun token via
 * `profiles.token_mint_address`, fans out to `useCreatorTokenMetrics` per
 * row (Birdeye → pump.fun → Jupiter), then ranks by absolute 24h price
 * change so both pumping and dumping coins surface as "in motion".
 *
 * Read-only — every card deeplinks to `pump.fun/coin/<mint>` for the trade
 * itself. No swap UI on Rhozeland.
 */
import { KeyboardEvent, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreatorTokenMetrics, fmtUsdCompact } from "@/hooks/useCreatorTokenMetrics";
import { ExternalLink, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type TokenProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  token_mint_address: string;
  token_ticker: string | null;
  archetype: string | null;
};

const useTokenedProfiles = () =>
  useQuery({
    queryKey: ["coins-in-motion-profiles"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("creator_tokens_public" as any)
        .select("id, user_id, display_name, username, avatar_url, token_mint_address, token_ticker, archetype")
        .limit(24);
      return ((data ?? []) as any[]).filter((p) => !!p.token_mint_address) as TokenProfile[];

    },
  });

const Sparkline = ({ points }: { points: number[] }) => {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 96;
  const h = 28;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((p - min) / span) * h).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path
        d={d}
        fill="none"
        strokeWidth={1.5}
        className={up ? "stroke-emerald-500" : "stroke-rose-500"}
      />
    </svg>
  );
};

const CoinCard = ({ profile }: { profile: TokenProfile }) => {
  const navigate = useNavigate();
  const { data: metrics } = useCreatorTokenMetrics(profile.token_mint_address);
  const ticker = profile.token_ticker || "TOKEN";
  const name = profile.display_name || profile.username || "Artist";
  const change = metrics?.change24h ?? null;
  const up = change != null && change >= 0;
  const pumpUrl = `https://pump.fun/coin/${profile.token_mint_address}`;
  const profileHref = `/profiles/${profile.user_id}`;

  const openProfile = () => navigate(profileHref);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProfile();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openProfile}
      onKeyDown={handleKeyDown}
      className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3.5 hover:border-foreground/30 transition-colors block w-full"
    >
      <div className="flex items-center gap-2.5">
        <div className="shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={name}
              className="h-9 w-9 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground truncate block">
            {name}
          </span>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
            ${ticker}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Market cap</p>
          <p className="font-display text-base font-semibold text-foreground tabular-nums">
            {fmtUsdCompact(metrics?.marketCapUsd ?? null)}
          </p>
        </div>
        <Sparkline points={metrics?.sparkline7d ?? []} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            change == null
              ? "bg-muted text-muted-foreground"
              : up
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
          )}
        >
          {change == null ? (
            "—"
          ) : up ? (
            <>
              <TrendingUp className="h-3 w-3" />+{change.toFixed(1)}%
            </>
          ) : (
            <>
              <TrendingDown className="h-3 w-3" />
              {change.toFixed(1)}%
            </>
          )}
        </span>
        <a
          href={pumpUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          title={`Trade $${ticker} on pump.fun`}
        >
          pump.fun <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};

const CoinsInMotionLane = () => {
  const { data: profiles, isLoading } = useTokenedProfiles();

  // We can't rank by metrics here without subscribing to every child query's
  // result. Order stable by name; cards reveal their own movement.
  const ordered = useMemo(
    () => (profiles ?? []).slice(0, 16),
    [profiles],
  );

  if (isLoading || ordered.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold">
          Coins in Motion
        </p>
        <Link
          to="/charts"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 [&>*]:w-full">
        {ordered.map((p) => (
          <CoinCard key={p.id} profile={p} />
        ))}
      </div>

    </section>
  );
};

export default CoinsInMotionLane;
