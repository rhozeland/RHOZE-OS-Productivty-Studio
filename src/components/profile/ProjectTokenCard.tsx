/**
 * ProjectTokenCard — v10.4
 *
 * Replaces the small TokenDiscoveryChip on profile pages with a bigger,
 * editorial "Live Project" fundraising card. Still read-only (no swap UI,
 * no custody) — fans tap "Back creator" and land on pump.fun. Reads from
 * `profiles.token_mint_address` / `token_ticker` / `show_token_chip`.
 *
 * Returns null if the creator hasn't linked a token or opted out, so it
 * can be dropped in unconditionally.
 */
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreatorTokenMetrics, fmtUsdCompact } from "@/hooks/useCreatorTokenMetrics";
import { cn } from "@/lib/utils";

interface Props {
  creatorId: string;
  creatorName?: string | null;
  className?: string;
}

const fmtPrice = (p: number | null): string => {
  if (p == null) return "—";
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(2)}`;
};

const ProjectTokenCard = ({ creatorId, creatorName, className }: Props) => {
  const { data: token } = useQuery({
    queryKey: ["profile-project-token", creatorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("token_mint_address, token_ticker, show_token_chip")
        .eq("id", creatorId)
        .maybeSingle();
      if (!data || data.show_token_chip === false || !data.token_mint_address) return null;
      return {
        mint: data.token_mint_address as string,
        ticker: (data.token_ticker ?? "TOKEN") as string,
      };
    },
  });

  const { data: metrics } = useCreatorTokenMetrics(token?.mint ?? null);

  if (!token) return null;

  const up = (metrics?.change24h ?? 0) >= 0;
  const pumpUrl = `https://pump.fun/coin/${token.mint}`;
  const name = creatorName ?? "this creator";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-slate-900 dark:bg-slate-950 text-white",
        "border border-white/5 shadow-2xl shadow-slate-900/20 p-6",
        className,
      )}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-fuchsia-500/20 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 w-44 h-44 rounded-full bg-indigo-500/15 blur-[80px]" />

      <div className="relative z-10">
        {/* Header row */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-300 text-[10px] font-black uppercase tracking-wider mb-2 border border-fuchsia-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
              Live project
            </div>
            <h3 className="text-3xl font-display font-black tracking-tighter">
              ${token.ticker}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              {name}'s fundraising token
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-display font-bold tabular-nums leading-none">
              {fmtPrice(metrics?.priceUsd ?? null)}
            </p>
            {metrics?.change24h != null && (
              <p
                className={cn(
                  "mt-1 text-[11px] tabular-nums inline-flex items-center gap-0.5 font-medium",
                  up ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}{metrics.change24h.toFixed(2)}%
              </p>
            )}
          </div>
        </div>

        {/* Mini stats */}
        {metrics && (metrics.marketCapUsd != null || metrics.holderCount != null) && (
          <div className="grid grid-cols-2 gap-3 mb-5 pb-5 border-b border-white/10">
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-bold">
                Market cap
              </p>
              <p className="text-sm font-display font-bold tabular-nums mt-0.5">
                {fmtUsdCompact(metrics.marketCapUsd ?? null)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-bold">
                Backers
              </p>
              <p className="text-sm font-display font-bold tabular-nums mt-0.5">
                {metrics.holderCount?.toLocaleString() ?? "—"}
              </p>
            </div>
          </div>
        )}

        <p className="text-slate-400 text-xs leading-relaxed mb-5">
          Back {name}'s work directly. Trade ${token.ticker} on pump.fun — Rhozeland doesn't
          custody or guarantee any token.
        </p>

        <a
          href={pumpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-center gap-2 w-full py-3.5 bg-white text-slate-900 hover:bg-slate-100 transition-colors rounded-xl text-center font-black text-sm shadow-lg shadow-black/10"
        >
          Back creator on pump.fun
          <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>

        <div className="mt-3 flex items-center justify-between opacity-60">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Tokenized on pump.fun
          </span>
          <span className="font-mono text-[9px] text-slate-500">
            {token.mint.slice(0, 4)}…{token.mint.slice(-4)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectTokenCard;
