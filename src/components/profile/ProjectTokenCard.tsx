/**
 * ProjectTokenCard — v10.5
 *
 * Editorial "Live Project" card on creator profiles. Adds:
 *  - 3-stat row (Market Cap · Holders · 24h change)
 *  - 7d price sparkline (white line on the dark card)
 *  - Wallet-aware CTA: disconnected → pump.fun deeplink (unchanged);
 *    Phantom/Solflare connected → in-app Jupiter swap (SOL → token).
 *
 * Read-only data still pulled via useCreatorTokenMetrics (pump.fun +
 * Birdeye fallback). Swap path uses Jupiter v6 quote/swap endpoints —
 * Rhozeland never custodies; the wallet signs and broadcasts directly.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";
import { useCreatorTokenMetrics, fmtUsdCompact } from "@/hooks/useCreatorTokenMetrics";
import { getConnection } from "@/lib/solana";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  creatorId: string;
  creatorName?: string | null;
  className?: string;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

const fmtPrice = (p: number | null): string => {
  if (p == null) return "—";
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(2)}`;
};

const Sparkline = ({ points }: { points: number[] }) => {
  if (points.length < 2) {
    return <div className="h-[52px] flex items-center justify-center text-[10px] text-slate-500">chart loading…</div>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 320;
  const h = 52;
  const stride = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stride).toFixed(1)} ${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-[52px]">
      <defs>
        <linearGradient id="proj-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#proj-spark-fill)" />
      <path d={path} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const InAppSwap = ({ mint, ticker }: { mint: string; ticker: string }) => {
  const { publicKey, sendTransaction } = useWallet();
  const [amount, setAmount] = useState("0.1");
  const [busy, setBusy] = useState(false);

  const handleSwap = async () => {
    if (!publicKey) return;
    const sol = parseFloat(amount);
    if (!Number.isFinite(sol) || sol <= 0) {
      toast.error("Enter a valid SOL amount");
      return;
    }
    setBusy(true);
    try {
      const lamports = Math.round(sol * 1_000_000_000);
      // 1) Quote
      const quoteRes = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${mint}&amount=${lamports}&slippageBps=150`,
      );
      if (!quoteRes.ok) throw new Error("Couldn't get a price quote");
      const quote = await quoteRes.json();
      if (!quote || quote.error) throw new Error(quote?.error ?? "No route available");

      // 2) Swap tx
      const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
        }),
      });
      if (!swapRes.ok) throw new Error("Swap build failed");
      const { swapTransaction } = await swapRes.json();
      const txBuf = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
      const tx = VersionedTransaction.deserialize(txBuf);

      // 3) Sign & send
      const connection = getConnection();
      const sig = await sendTransaction(tx, connection);
      toast.info("Swap sent, confirming…");
      await connection.confirmTransaction(sig, "confirmed");
      toast.success(`Bought $${ticker}! Tx ${sig.slice(0, 6)}…`);
    } catch (e: any) {
      const msg = e?.message ?? "Swap failed";
      if (msg.includes("User rejected")) toast.error("Swap cancelled");
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] uppercase tracking-[0.14em] text-slate-500 font-bold">
        Enter SOL amount
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono tabular-nums focus:outline-none focus:border-white/30 disabled:opacity-50"
          placeholder="0.1"
        />
        <button
          onClick={handleSwap}
          disabled={busy}
          className="px-5 h-11 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-black text-sm shadow-lg shadow-black/10 inline-flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Buy ${ticker}
        </button>
      </div>
    </div>
  );
};

const ProjectTokenCard = ({ creatorId, creatorName, className }: Props) => {
  const { connected } = useWallet();
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
            <h3 className="text-3xl font-display font-black tracking-tighter">${token.ticker}</h3>
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

        {/* 3-stat row */}
        <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-white/10">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-bold">Market cap</p>
            <p className="text-sm font-display font-bold tabular-nums mt-0.5 text-white">
              {fmtUsdCompact(metrics?.marketCapUsd ?? null)}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-bold">Holders</p>
            <p className="text-sm font-display font-bold tabular-nums mt-0.5 text-white">
              {metrics?.holderCount?.toLocaleString() ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-bold">24h change</p>
            <p
              className={cn(
                "text-sm font-display font-bold tabular-nums mt-0.5",
                metrics?.change24h == null
                  ? "text-white"
                  : up
                    ? "text-emerald-400"
                    : "text-rose-400",
              )}
            >
              {metrics?.change24h != null
                ? `${up ? "+" : ""}${metrics.change24h.toFixed(2)}%`
                : "—"}
            </p>
          </div>
        </div>

        <p className="text-slate-400 text-xs leading-relaxed mb-3">
          Back {name}'s work directly. Trade ${token.ticker} on pump.fun.
        </p>

        {/* 7d sparkline */}
        <div className="mb-5">
          <Sparkline points={metrics?.sparkline7d ?? []} />
          <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-bold mt-1">
            7-day price
          </p>
        </div>

        {/* Wallet-aware CTA */}
        {connected ? (
          <InAppSwap mint={token.mint} ticker={token.ticker} />
        ) : (
          <a
            href={pumpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2 w-full py-3.5 bg-white text-slate-900 hover:bg-slate-100 transition-colors rounded-xl text-center font-black text-sm shadow-lg shadow-black/10"
          >
            Back creator on pump.fun
            <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        )}

        <div className="mt-3 flex items-center justify-between opacity-60">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Token trades on pump.fun. Price fluctuates with market activity.
          </span>
          <span className="font-mono text-[9px] text-slate-500 shrink-0 ml-2">
            {token.mint.slice(0, 4)}…{token.mint.slice(-4)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectTokenCard;
