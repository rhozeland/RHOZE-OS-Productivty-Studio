/**
 * BuyRhozeSection — two clear paths to load up:
 *
 *  1. Pump.fun deeplink (on-chain, requires a Solana wallet).
 *  2. Card top-up via Square — user buys a USD amount of $RHOZE; the
 *     actual token amount they receive is estimated from the live market
 *     price (Jupiter / DexScreener) instead of a fixed 100:1 conversion.
 *
 * v9.4: removed the "$1 = 100 $RHOZE" framing and the fixed RHOZE amounts
 * on each tier card. Pricing tracks the real market — anything extra
 * (airdrops, bonuses) is handled manually by admin for now.
 *
 * The card flow still calls `topup-rhoze` which charges the user's
 * tokenized card and credits balance + ledger.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Coins, ExternalLink, CreditCard, Sparkles, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SquareCardForm, { SQUARE_LOCATION_ID } from "@/components/booking/SquareCardForm";
import { useRhozeMarketPrice, formatRhozeUsd } from "@/hooks/useRhozeMarketPrice";

const RHOZE_CA = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const PUMP_FUN_URL = `https://pump.fun/coin/${RHOZE_CA}`;

const PRESETS = [
  { usd: 5,   label: "Starter",   blurb: "Try it out" },
  { usd: 25,  label: "Regular",   blurb: "Most popular", highlight: true },
  { usd: 100, label: "Believer",  blurb: "Stack up" },
  { usd: 500, label: "Whale",     blurb: "Top of the ladder" },
];

/** Format a $RHOZE estimate with sensible precision. */
const formatRhozeAmount = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return n.toFixed(2);
};

const BuyRhozeSection = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<number>(25);
  const [customMode, setCustomMode] = useState(false);
  const [customUsd, setCustomUsd] = useState("");

  const { data: market } = useRhozeMarketPrice();
  const priceUsd = market?.priceUsd ?? 0;
  const haveMarket = priceUsd > 0;

  const usdAmount = customMode ? Math.max(1, Math.min(5000, Number(customUsd) || 0)) : selected;
  /** Estimated $RHOZE the user would receive at the current market price. */
  const estRhoze = haveMarket ? usdAmount / priceUsd : 0;

  const handleTokenize = async (token: string) => {
    if (!usdAmount || usdAmount < 1) {
      toast.error("Enter an amount of at least $1");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("topup-rhoze", {
        body: {
          amount_cents: Math.round(usdAmount * 100),
          source_id: token,
          location_id: SQUARE_LOCATION_ID,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Payment failed");

      toast.success(`+${data.credits.toLocaleString()} $RHOZE added`, {
        description: `Charged $${usdAmount.toFixed(2)} to your card.`,
      });
      qc.invalidateQueries({ queryKey: ["user-credits"] });
      qc.invalidateQueries({ queryKey: ["credit-transactions"] });
    } catch (err: any) {
      toast.error("Payment failed", { description: err?.message ?? "Unknown error" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-card p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          <Coins className="h-3.5 w-3.5" /> Buy $RHOZE
        </div>
        <h3 className="font-display text-2xl font-bold text-foreground">
          Two ways to load up.
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Trade on Pump.fun if you've got a Solana wallet, or buy with a card —
          credits land in your in-app balance instantly. The amount of $RHOZE you
          receive tracks the live market price.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Card path ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-display font-semibold text-foreground">Buy with card</p>
                <p className="text-xs text-muted-foreground">Powered by Square · USD</p>
              </div>
            </div>
            {haveMarket && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Market
                </p>
                <p className="text-xs text-foreground font-mono">
                  {formatRhozeUsd(priceUsd)} <span className="text-muted-foreground">/ $RHOZE</span>
                </p>
              </div>
            )}
          </div>

          {/* Preset packages — USD-first; live $RHOZE estimate underneath. */}
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const active = !customMode && selected === p.usd;
              const presetEst = haveMarket ? p.usd / priceUsd : 0;
              return (
                <button
                  key={p.usd}
                  onClick={() => { setSelected(p.usd); setCustomMode(false); }}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background/40 hover:border-foreground/30"
                  }`}
                >
                  {p.highlight && !active && (
                    <span className="absolute -top-1.5 right-2 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Popular
                    </span>
                  )}
                  {active && (
                    <span className="absolute top-2 right-2">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground">{p.label}</p>
                  <p className="font-display text-lg font-bold text-foreground mt-0.5">
                    ${p.usd}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.blurb}</p>
                  {haveMarket ? (
                    <p className="text-[10px] text-primary/80 font-medium mt-1.5">
                      ≈ {formatRhozeAmount(presetEst)} $RHOZE
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                      market price loading…
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom amount */}
          <div className={`rounded-xl border p-3 transition-all ${customMode ? "border-primary bg-primary/5" : "border-border"}`}>
            <Label className="text-xs text-muted-foreground">Custom amount (USD)</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                min={1}
                max={5000}
                step={1}
                placeholder="50"
                value={customUsd}
                onFocus={() => setCustomMode(true)}
                onChange={(e) => { setCustomMode(true); setCustomUsd(e.target.value); }}
                className="h-8 text-sm"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">$1 – $5,000 per transaction.</p>
          </div>

          {/* Order summary — live market estimate, not a fixed promise. */}
          <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">You'll receive</span>
              <span className="font-display font-bold text-foreground inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {haveMarket ? `≈ ${formatRhozeAmount(estRhoze)} $RHOZE` : "—"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground inline-flex items-start gap-1 leading-snug">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              Estimate at the current market price
              {haveMarket ? ` (${formatRhozeUsd(priceUsd)}/token)` : ""}. The
              exact amount credited may move slightly with market price at
              the moment of purchase.
            </p>
          </div>

          {usdAmount >= 1 ? (
            <SquareCardForm amount={usdAmount} onTokenize={handleTokenize} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">
              Pick a package or enter a custom amount.
            </p>
          )}
        </motion.div>

        {/* ─── On-chain path ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Coins className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="font-display font-semibold text-foreground">Trade on Pump.fun</p>
              <p className="text-xs text-muted-foreground">On-chain · requires SOL wallet</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            $RHOZE trades live on Pump.fun. Connect your Solana wallet, swap SOL → $RHOZE,
            then bind your wallet in Settings to use it across Rhozeland.
          </p>

          <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Contract Address
            </p>
            <code className="text-[11px] text-foreground bg-background px-2 py-1 rounded font-mono break-all block">
              {RHOZE_CA}
            </code>
            <p className="text-[10px] text-muted-foreground">Solana · SPL Token</p>
          </div>

          <a href={PUMP_FUN_URL} target="_blank" rel="noopener noreferrer">
            <Button className="w-full h-11 rounded-full gap-2" variant="outline">
              <ExternalLink className="h-4 w-4" /> Open Pump.fun
            </Button>
          </a>

          <p className="text-[10px] text-muted-foreground text-center">
            On-chain $RHOZE is the same token. The price floats with the bonding curve.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default BuyRhozeSection;
