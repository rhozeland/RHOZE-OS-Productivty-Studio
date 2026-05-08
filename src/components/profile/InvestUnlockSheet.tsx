/**
 * InvestUnlockSheet — primary "Invest & Unlock" CTA sheet.
 *
 * Used from:
 *  - Profile pages (primary CTA above Follow/Message/Book)
 *  - Flow Mode locked cards ("Invest & Unlock" overlay)
 *
 * Reuses the simulated `swap_rhoze_for_coin` RPC (buy side). Buying any
 * non-zero amount of an artist's Share unlocks their private feed.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Lock, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGate } from "@/components/AuthGateDialog";
import { toast } from "sonner";
import {
  CREDITS_LABEL,
  CREDITS_LABEL_SHORT,
  MARKET_GROWTH_LABEL,
  SHARE_LABEL,
  SHARES_LABEL,
} from "@/lib/economy-copy";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Artist whose Shares are being purchased. */
  artistId: string;
  artistName?: string | null;
}

const InvestUnlockSheet = ({ open, onOpenChange, artistId, artistName }: Props) => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const qc = useQueryClient();
  const [spend, setSpend] = useState(50); // Platform Credits to spend
  const [busy, setBusy] = useState(false);

  // Look up the artist's active coin/share launch.
  const { data: launch, isLoading: launchLoading } = useQuery({
    queryKey: ["invest-unlock-launch", artistId],
    enabled: open && !!artistId,
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, status, virtual_sol_reserves, virtual_token_reserves, real_sol_reserves, graduation_sol_target")
        .eq("creator_id", artistId)
        .neq("status", "cancelled")
        .order("work_id", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: balance } = useQuery({
    queryKey: ["invest-unlock-balance", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  const { data: holdings } = useQuery({
    queryKey: ["invest-unlock-holdings", user?.id, launch?.id],
    enabled: open && !!user && !!launch?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_holdings")
        .select("balance")
        .eq("trader_id", user!.id)
        .eq("launch_id", launch!.id)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  const maxSpend = Math.max(0, Math.floor(Number(balance ?? 0)));
  const safeSpend = Math.min(spend, Math.max(maxSpend, 1));

  useEffect(() => {
    if (maxSpend > 0 && spend > maxSpend) setSpend(maxSpend);
  }, [maxSpend, spend]);

  const growthPct = launch
    ? Math.min(
        100,
        (Number(launch.real_sol_reserves) / Math.max(Number(launch.graduation_sol_target), 1e-9)) * 100,
      )
    : 0;

  // Estimate Shares received (mirror TradePanel buy quote logic, simplified).
  const estShares = (() => {
    if (!launch || safeSpend <= 0) return 0;
    const k = Number(launch.virtual_sol_reserves) * Number(launch.virtual_token_reserves);
    const fee = (safeSpend * 300) / 10000; // 3%
    const net = safeSpend - fee;
    const newSol = Number(launch.virtual_sol_reserves) + net;
    const newTok = k / newSol;
    return Math.max(0, Number(launch.virtual_token_reserves) - newTok);
  })();

  const handleBuy = async () => {
    if (!user) {
      requireAuth("Sign in to invest in this artist.");
      return;
    }
    if (!launch || launch.status !== "live") {
      toast.error("This artist's Shares aren't available right now.");
      return;
    }
    if (safeSpend <= 0 || safeSpend > maxSpend) {
      toast.error("Not enough Platform Credits.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("swap_rhoze_for_coin", {
      _launch_id: launch.id,
      _side: "buy",
      _amount: safeSpend,
      _min_out: 0,
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn't complete purchase", { description: error.message });
      return;
    }
    toast.success(`Unlocked! You now hold $${launch.ticker}`, {
      description: `Spent ${safeSpend} ${CREDITS_LABEL_SHORT} on ${artistName || "this artist"}'s ${SHARES_LABEL.toLowerCase()}.`,
    });
    // Invalidate gating + balance queries so locked Flow cards un-blur in place.
    qc.invalidateQueries({ queryKey: ["flow-unlock-holdings"] });
    qc.invalidateQueries({ queryKey: ["invest-unlock-holdings"] });
    qc.invalidateQueries({ queryKey: ["invest-unlock-balance"] });
    qc.invalidateQueries({ queryKey: ["rhoze-balance-chip"] });
    qc.invalidateQueries({ queryKey: ["profile-coin", artistId] });
    onOpenChange(false);
  };

  const alreadyHolds = Number(holdings ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Invest & Unlock
          </DialogTitle>
          <DialogDescription>
            Buy a {SHARE_LABEL} in {artistName || "this artist"} to unlock their
            private feed, drops, and behind-the-scenes.
          </DialogDescription>
        </DialogHeader>

        {launchLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !launch ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-5 text-center space-y-2">
            <Lock className="h-5 w-5 text-muted-foreground mx-auto" />
            <p className="text-sm text-foreground font-medium">
              Shares haven't launched yet
            </p>
            <p className="text-xs text-muted-foreground">
              Follow {artistName || "this artist"} to be notified when they go live.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Market Growth */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  {MARKET_GROWTH_LABEL}
                </span>
                <span className="font-mono tabular-nums">{growthPct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500"
                  style={{ width: `${growthPct}%` }}
                />
              </div>
            </div>

            {/* Spend */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label className="text-xs font-medium text-foreground">
                  Spend ({CREDITS_LABEL})
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Balance: {maxSpend.toLocaleString()}
                </span>
              </div>
              <Input
                type="number"
                min={1}
                max={maxSpend}
                value={spend}
                onChange={(e) => setSpend(Math.max(1, Number(e.target.value) || 0))}
                className="font-mono"
              />
              {maxSpend > 0 && (
                <Slider
                  min={1}
                  max={maxSpend}
                  step={1}
                  value={[Math.min(spend, maxSpend)]}
                  onValueChange={(v) => setSpend(v[0])}
                />
              )}
            </div>

            <div className="rounded-xl border border-border/60 bg-card/60 p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">You receive</span>
              <span className="font-mono font-semibold tabular-nums">
                ≈ {estShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                ${launch.ticker}
              </span>
            </div>

            {alreadyHolds && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                You already hold {Number(holdings).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${launch.ticker} — buying more boosts your stake.
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                onClick={handleBuy}
                disabled={busy || maxSpend <= 0 || safeSpend <= 0 || launch.status !== "live"}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {alreadyHolds ? "Buy more Shares" : "Invest & Unlock"}
              </Button>
              {maxSpend <= 0 && (
                <Link
                  to="/credits"
                  onClick={() => onOpenChange(false)}
                  className="text-[11px] text-center text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
                >
                  Get Platform Credits <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvestUnlockSheet;
