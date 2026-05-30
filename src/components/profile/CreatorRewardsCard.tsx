/**
 * CreatorRewardsCard — Pillar 3 owner-only card.
 *
 * Shown on the artist's own profile when they have an approved pump.fun
 * token. Surfaces the slice of trade volume that pump.fun routes back to
 * the original mint deployer (the "creator rewards" stream) plus a
 * one-tap deeplink to their pump.fun creator dashboard.
 *
 * Rhozeland never custodies the rewards — we just expose them and
 * teach why launching a coin is worth it.
 */
import { Coins, ArrowUpRight, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCreatorTokenMetrics, fmtUsdCompact } from "@/hooks/useCreatorTokenMetrics";

interface Props {
  mint: string;
  ticker: string;
  /** Optional fallback wallet (from `profiles.solana_wallet`) used when
   *  pump.fun's API doesn't return the creator field. */
  fallbackWallet?: string | null;
  className?: string;
}

/** pump.fun creator-rewards rate (bps of trade volume that routes to the
 *  mint deployer). Source: pump.fun docs. Tweak if pump.fun updates. */
const CREATOR_REWARDS_BPS = 5;

export default function CreatorRewardsCard({
  mint,
  ticker,
  fallbackWallet,
  className,
}: Props) {
  const navigate = useNavigate();
  const { data: m, isLoading } = useCreatorTokenMetrics(mint);

  const wallet = m?.creatorWallet ?? fallbackWallet ?? null;
  const estRewardsUsd =
    m?.volumeUsd != null ? (m.volumeUsd * CREATOR_REWARDS_BPS) / 10_000 : null;

  return (
    <section
      className={[
        "relative overflow-hidden rounded-2xl border border-foreground/20",
        "bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.06] to-fuchsia-500/[0.08]",
        "p-5",
        className ?? "",
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl"
      />
      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              <Sparkles className="h-3 w-3" />
              Creator rewards · ${ticker}
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground leading-tight">
              You earn on every trade
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              pump.fun routes a slice of every ${ticker} trade back to the
              wallet that minted it — that's you. Fees stream in real time,
              no payout schedule.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Stat
            label="Est. earned"
            value={isLoading ? "…" : fmtUsdCompact(estRewardsUsd)}
            sub={`~${CREATOR_REWARDS_BPS / 100}% of ${fmtUsdCompact(
              m?.volumeUsd ?? null,
            )} vol`}
          />
          <Stat
            label="Market cap"
            value={isLoading ? "…" : fmtUsdCompact(m?.marketCapUsd ?? null)}
            sub="more vol = more rewards"
          />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button
            asChild
            size="lg"
            className="w-full rounded-full gap-2"
            disabled={!wallet}
          >
            {wallet ? (
              <a
                href={`https://pump.fun/profile/${wallet}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Coins className="h-4 w-4" />
                Open my pump.fun rewards
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : (
              <span>
                <Coins className="h-4 w-4" />
                Connect wallet to see rewards
              </span>
            )}
          </Button>
          <button
            type="button"
            onClick={() => navigate("/why-coin")}
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-4 hover:underline text-center"
          >
            How rewards work &rarr;
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-1">
          Estimates use pump.fun reported volume × {CREATOR_REWARDS_BPS / 100}%.
          Exact payouts live on your pump.fun creator dashboard.
        </p>
      </div>
    </section>
  );
}

const Stat = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) => (
  <div className="rounded-xl border border-border/60 bg-background/40 p-3">
    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      {label}
    </p>
    <p className="text-base font-display font-semibold tabular-nums mt-0.5">
      {value}
    </p>
    <p className="text-[10px] text-muted-foreground/70 mt-1">{sub}</p>
  </div>
);
