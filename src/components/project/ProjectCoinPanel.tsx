/**
 * ProjectCoinPanel — unified inline crypto surface for a Release.
 *
 * Replaces the popup-based AttachCoinToProjectCard + ProjectCoinLiveCard combo.
 *
 * States (owner-driven):
 *  - No coin linked + owner → inline paste-CA field with live preview + Attach.
 *  - No coin linked + non-owner → renders nothing.
 *  - Coin linked → editorial crypto card: sparkline chart, live price, market
 *    cap, holders, creator-rewards estimate (~5 bps × 24h volume), and two
 *    distinct primary buttons (Trade on pump.fun · Unlink for owner).
 *
 * No dialogs. Everything happens in place.
 */
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Coins,
  ExternalLink,
  Loader2,
  Link2Off,
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  BarChart3,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreatorTokenMetrics, fmtUsdCompact, fmtCount } from "@/hooks/useCreatorTokenMetrics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  isOwner: boolean;
  /** Full project row (needs linked_token_id + linked_token_mint fields). */
  project: any;
}

const isValidMint = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(v.trim());

const fmtPrice = (p: number | null): string => {
  if (p == null) return "—";
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(2)}`;
};

/** Small SVG sparkline — no libs, no 24h clutter. */
const Sparkline = ({ points, up }: { points: number[]; up: boolean }) => {
  if (!points || points.length < 2) {
    return (
      <div className="h-16 grid place-items-center text-[10px] text-slate-500">
        chart loading…
      </div>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 600;
  const h = 64;
  const stride = w / (points.length - 1);
  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${(i * stride).toFixed(1)} ${(h - ((p - min) / range) * h).toFixed(1)}`,
    )
    .join(" ");
  const color = up ? "hsl(142 71% 55%)" : "hsl(0 78% 62%)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-16">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
};

const ProjectCoinPanel = ({ projectId, isOwner, project }: Props) => {
  const qc = useQueryClient();

  // Resolve linked token → mint + display info from either linked_token_id
  // (an approved creator_tokens row) or the freeform linked_token_mint fields.
  const linkedTokenId: string | null = project?.linked_token_id ?? null;
  const linkedMintDirect: string | null = project?.linked_token_mint ?? null;

  const { data: dbToken } = useQuery({
    queryKey: ["project-linked-token", linkedTokenId],
    enabled: !!linkedTokenId,
    queryFn: async () => {
      const { data } = await supabase
        .from("creator_tokens")
        .select("mint_address, ticker, name, status")
        .eq("id", linkedTokenId!)
        .maybeSingle();
      if (!data || data.status !== "approved") return null;
      return data;
    },
  });

  const mint =
    dbToken?.mint_address ??
    linkedMintDirect ??
    null;
  const ticker =
    dbToken?.ticker ??
    project?.linked_token_ticker ??
    null;
  const displayName =
    dbToken?.name ??
    project?.linked_token_name ??
    null;
  const imageUrl = project?.linked_token_image_url ?? null;

  const { data: metrics, isLoading: metricsLoading } = useCreatorTokenMetrics(mint);

  // Attach / unlink state (owner only)
  const [ca, setCa] = useState("");
  const [preview, setPreview] = useState<any | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchPreview = async () => {
    const m = ca.trim();
    if (!isValidMint(m)) {
      toast.error("That doesn't look like a Solana mint address");
      return;
    }
    setFetching(true);
    try {
      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/creator-token-metrics?mint=${m}`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) throw new Error("Could not fetch coin data");
      const j = await res.json();
      setPreview({
        mint: m,
        symbol: j.symbol ?? "TOKEN",
        name: j.name ?? "Unknown coin",
        imageUri: j.imageUri ?? null,
        priceUsd: j.priceUsd ?? null,
        marketCapUsd: j.marketCapUsd ?? null,
        holderCount: j.holderCount ?? null,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not fetch coin data");
    } finally {
      setFetching(false);
    }
  };

  const attach = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Verify a contract first");
      const { error } = await (supabase as any)
        .from("projects")
        .update({
          linked_token_id: null,
          linked_token_mint: preview.mint,
          linked_token_ticker: preview.symbol,
          linked_token_name: preview.name,
          linked_token_image_url: preview.imageUri,
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["release"] });
      toast.success(`Attached $${preview?.symbol}`);
      setCa("");
      setPreview(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not attach coin"),
  });

  const unlink = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("projects")
        .update({
          linked_token_id: null,
          linked_token_mint: null,
          linked_token_ticker: null,
          linked_token_name: null,
          linked_token_image_url: null,
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["release"] });
      toast.success("Coin unlinked");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not unlink"),
  });

  const up = (metrics?.change24h ?? 0) >= 0;
  const rewardsEst = useMemo(() => {
    // pump.fun creator rewards ≈ 5 bps of trade volume
    if (!metrics?.volumeUsd) return null;
    return metrics.volumeUsd * 0.0005;
  }, [metrics?.volumeUsd]);

  // ── EMPTY STATE ─────────────────────────────────────────────────────────
  if (!mint) {
    if (!isOwner) return null;
    return (
      <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden shadow-lg shadow-emerald-500/5">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/15 grid place-items-center">
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-sm font-semibold tracking-tight">
              Attach a coin to this release
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Paste a pump.fun contract — we'll fetch price, holders, and chart.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="relative">
            <input
              type="text"
              value={ca}
              onChange={(e) => {
                setCa(e.target.value);
                if (preview) setPreview(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && !fetching && fetchPreview()}
              placeholder="Contract address…"
              className={cn(
                "w-full font-mono text-sm rounded-xl px-4 py-3 pr-28 outline-none border transition-colors",
                "bg-slate-900/60 border-white/10 text-white placeholder:text-slate-600",
                ca && !isValidMint(ca) && "border-red-500/60",
                preview && "border-emerald-500/50",
              )}
            />
            <button
              type="button"
              onClick={fetchPreview}
              disabled={fetching || !ca.trim() || !!preview}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 px-4 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {fetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : preview ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Verified
                </>
              ) : (
                "Verify"
              )}
            </button>
          </div>

          {preview && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                {preview.imageUri ? (
                  <img src={preview.imageUri} alt="" className="h-11 w-11 rounded-lg object-cover" />
                ) : (
                  <div className="h-11 w-11 rounded-lg bg-emerald-500 grid place-items-center font-black text-slate-950">
                    {preview.symbol.slice(0, 1)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg leading-none">${preview.symbol}</div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{preview.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{fmtPrice(preview.priceUsd)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    MC {fmtUsdCompact(preview.marketCapUsd)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => attach.mutate()}
                disabled={attach.isPending}
                className="w-full h-11 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-100 transition-colors disabled:opacity-60"
              >
                {attach.isPending ? "Attaching…" : `Attach $${preview.symbol} to this release`}
              </button>
            </div>
          )}

          <p className="text-[10px] text-slate-500 leading-relaxed">
            Rhozeland never custodies or trades. The chip on your public release page
            deep-links to pump.fun.
          </p>
        </div>
      </section>
    );
  }

  // ── LINKED STATE ────────────────────────────────────────────────────────
  const pumpUrl = `https://pump.fun/coin/${mint}`;
  const chartUrl = `https://dexscreener.com/solana/${mint}`;

  return (
    <section className="mt-6 rounded-2xl overflow-hidden border border-white/5 bg-slate-950 text-white shadow-xl shadow-slate-950/40 relative">
      {/* aurora glow */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-40",
          up ? "bg-emerald-500/40" : "bg-rose-500/40",
        )}
      />

      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/5 flex items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
        ) : (
          <div className="h-11 w-11 rounded-xl bg-emerald-500 grid place-items-center font-black text-slate-950">
            {(ticker ?? "?").slice(0, 1)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-display text-2xl font-black leading-none tracking-tight">
              ${ticker ?? "COIN"}
            </div>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-black uppercase tracking-wider border border-emerald-500/30">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          {displayName && (
            <p className="text-[11px] text-slate-400 truncate mt-1">{displayName}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-2xl font-bold tabular-nums leading-none">
            {fmtPrice(metrics?.priceUsd ?? null)}
          </div>
          {metrics?.change24h != null && (
            <div
              className={cn(
                "mt-1 text-[10px] font-semibold inline-flex items-center gap-0.5",
                up ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {up ? "+" : ""}
              {metrics.change24h.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative px-2 pt-3">
        {metricsLoading && !metrics ? (
          <div className="h-16 grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          </div>
        ) : (
          <Sparkline points={metrics?.sparkline7d ?? []} up={up} />
        )}
        <div className="px-3 -mt-1 flex items-center justify-between text-[9px] uppercase tracking-widest text-slate-500">
          <span>7d price</span>
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-2.5 w-2.5" /> pump.fun · birdeye
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="relative px-5 py-4 grid grid-cols-3 gap-3 border-t border-white/5">
        <Stat
          icon={<Coins className="h-3 w-3" />}
          label="Market cap"
          value={fmtUsdCompact(metrics?.marketCapUsd ?? null)}
        />
        <Stat
          icon={<Users className="h-3 w-3" />}
          label="Holders"
          value={fmtCount(metrics?.holderCount ?? null)}
        />
        <Stat
          icon={<BarChart3 className="h-3 w-3" />}
          label="Volume"
          value={fmtUsdCompact(metrics?.volumeUsd ?? null)}
        />
      </div>

      {/* Creator rewards analytics */}
      <div className="relative mx-5 mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/15 grid place-items-center shrink-0">
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest text-emerald-300/80 font-bold">
                Creator rewards
              </p>
              <p className="text-[10px] text-slate-500 font-mono">≈ 5 bps of volume</p>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-xl font-bold text-emerald-300 tabular-nums">
                {rewardsEst != null ? fmtUsdCompact(rewardsEst) : "—"}
              </span>
              <span className="text-[10px] text-slate-500">est. earned</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              pump.fun pays the coin creator ~0.05% of every trade. Claim on{" "}
              <a
                href={metrics?.creatorWallet ? `https://pump.fun/profile/${metrics.creatorWallet}` : pumpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-300"
              >
                pump.fun
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Distinct action buttons */}
      <div className="relative px-5 pb-5 flex items-center gap-2">
        <a
          href={pumpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-100 transition-colors"
        >
          Trade ${ticker ?? "coin"} <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <a
          href={chartUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors"
        >
          <BarChart3 className="h-4 w-4" /> Chart
        </a>
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Unlink this coin from the release?")) unlink.mutate();
            }}
            disabled={unlink.isPending}
            className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-white/15 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            title="Unlink coin"
          >
            <Link2Off className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="relative px-5 pb-3 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>
          {mint.slice(0, 6)}…{mint.slice(-6)}
        </span>
        <span>{metrics?.source ?? "—"}</span>
      </div>
    </section>
  );
};

const Stat = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
    <div className="flex items-center gap-1 text-slate-500 text-[9px] uppercase tracking-widest font-bold">
      {icon}
      {label}
    </div>
    <div className="mt-1 font-display text-base font-bold tabular-nums text-white">{value}</div>
  </div>
);

export default ProjectCoinPanel;
