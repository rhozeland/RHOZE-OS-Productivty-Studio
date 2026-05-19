/**
 * BackCreatorSheet — the rebuilt "back this creator" flow.
 *
 * Replaces InvestUnlockSheet for non-crypto-native users. Three screens:
 *   1. AMOUNT      — quick $5/$10/$25 presets or custom
 *   2. WHAT YOU GET — value props (private feed, drops, upside)
 *   3. PAY         — Credits (live) or Card (coming soon)
 *
 * No mint addresses, no slippage, no bonding-curve language. Reuses the
 * existing `swap_rhoze_for_coin` RPC under the hood — the on-chain layer
 * is invisible to the user.
 *
 * Drop-in for InvestUnlockSheet — same props.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Sparkles,
  Lock,
  ArrowRight,
  ArrowLeft,
  Check,
  CreditCard,
  Coins,
  Unlock,
  TrendingUp,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artistId: string;
  artistName?: string | null;
}

type Step = "amount" | "value" | "pay" | "done";
type PayMethod = "credits" | "card";

// 1 USD ≈ 100 Credits (matches verify-rhoze-payment)
const CREDITS_PER_USD = 100;
const PRESETS_USD = [5, 10, 25] as const;

const BackCreatorSheet = ({ open, onOpenChange, artistId, artistName }: Props) => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("amount");
  const [amountUsd, setAmountUsd] = useState<number>(10);
  const [method, setMethod] = useState<PayMethod>("credits");
  const [busy, setBusy] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("amount");
        setAmountUsd(10);
        setMethod("credits");
        setBusy(false);
      }, 250);
    }
  }, [open]);

  const displayName = artistName || "this creator";
  const amountCredits = Math.max(1, Math.round(amountUsd * CREDITS_PER_USD));

  // Pull the artist's live share launch (we hide all the on-chain terms).
  const { data: launch, isLoading: launchLoading } = useQuery({
    queryKey: ["back-sheet-launch", artistId],
    enabled: open && !!artistId,
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select(
          "id, ticker, status, virtual_sol_reserves, virtual_token_reserves, real_sol_reserves, graduation_sol_target, creator_fee_bps, platform_fee_bps",
        )
        .eq("creator_id", artistId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: balance } = useQuery({
    queryKey: ["back-sheet-balance", user?.id],
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

  const creditBalance = Math.max(0, Math.floor(Number(balance ?? 0)));
  const hasEnoughCredits = creditBalance >= amountCredits;

  // Quick estimate of Shares received — used in screen 1 reassurance copy.
  const estShares = useMemo(() => {
    if (!launch) return 0;
    const k =
      Number(launch.virtual_sol_reserves) * Number(launch.virtual_token_reserves);
    const totalFeeBps =
      Number(launch.creator_fee_bps ?? 200) + Number(launch.platform_fee_bps ?? 100);
    const fee = (amountCredits * totalFeeBps) / 10000;
    const net = amountCredits - fee;
    const newSol = Number(launch.virtual_sol_reserves) + net;
    const newTok = k / newSol;
    return Math.max(0, Number(launch.virtual_token_reserves) - newTok);
  }, [launch, amountCredits]);

  const handleConfirm = async () => {
    if (!user) {
      requireAuth(`Sign in to back ${displayName}.`);
      return;
    }
    if (method === "card") {
      toast.info("Card payment coming soon", {
        description: "For now, top up Credits and back them with Credits.",
      });
      return;
    }
    if (!launch || launch.status !== "live") {
      toast.error("Shares aren't live yet for this creator.");
      return;
    }
    if (!hasEnoughCredits) {
      toast.error("Not enough Credits.", {
        description: "Top up your balance to back this creator.",
      });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("swap_rhoze_for_coin", {
      _launch_id: launch.id,
      _side: "buy",
      _amount: amountCredits,
      _min_out: 0,
      _platform_fee_bps: Number(launch.platform_fee_bps ?? 100),
      _creator_fee_bps: Number(launch.creator_fee_bps ?? 200),
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn't complete", { description: error.message });
      return;
    }
    qc.invalidateQueries({ queryKey: ["flow-unlock-holdings"] });
    qc.invalidateQueries({ queryKey: ["invest-unlock-holdings"] });
    qc.invalidateQueries({ queryKey: ["invest-unlock-balance"] });
    qc.invalidateQueries({ queryKey: ["back-sheet-balance"] });
    qc.invalidateQueries({ queryKey: ["rhoze-balance-chip"] });
    qc.invalidateQueries({ queryKey: ["profile-coin", artistId] });
    setStep("done");
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {step === "done" ? (
              <>
                <Check className="h-5 w-5 text-emerald-500" />
                You're in
              </>
            ) : (
              <>Back {displayName}</>
            )}
          </DialogTitle>
          {step !== "done" && (
            <DialogDescription className="text-xs">
              {step === "amount" && "Pick an amount. Every dollar is real support."}
              {step === "value" && "Here's what you get."}
              {step === "pay" && "Choose how to pay."}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Step indicator */}
        {step !== "done" && (
          <div className="px-6 pb-2 flex gap-1">
            {(["amount", "value", "pay"] as const).map((s, i) => {
              const active = s === step;
              const done =
                (step === "value" && s === "amount") ||
                (step === "pay" && (s === "amount" || s === "value"));
              return (
                <div
                  key={s}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    done ? "bg-emerald-500/70" : active ? "bg-foreground" : "bg-muted",
                  )}
                />
              );
            })}
          </div>
        )}

        {launchLoading && step === "amount" ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !launch && step === "amount" ? (
          <div className="px-6 pb-6 space-y-3">
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-5 text-center space-y-2">
              <Lock className="h-5 w-5 text-muted-foreground mx-auto" />
              <p className="text-sm text-foreground font-medium">
                Shares aren't live yet
              </p>
              <p className="text-xs text-muted-foreground">
                Follow {displayName} and you'll be first to know when they open.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : step === "amount" ? (
          <div className="px-6 pb-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {PRESETS_USD.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmountUsd(p)}
                  className={cn(
                    "rounded-xl border-2 py-3 text-center transition-colors",
                    amountUsd === p
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/40",
                  )}
                >
                  <p className="font-display text-xl font-bold">${p}</p>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Or custom (USD)
              </label>
              <Input
                type="number"
                min={1}
                step={1}
                value={amountUsd}
                onChange={(e) =>
                  setAmountUsd(Math.max(1, Number(e.target.value) || 0))
                }
                className="font-mono text-lg"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              ≈ {estShares.toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
              Shares · unlocks {displayName}'s private feed
            </p>
            <Button className="w-full gap-1.5" onClick={() => setStep("value")}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : step === "value" ? (
          <div className="px-6 pb-5 space-y-3">
            {[
              {
                icon: Unlock,
                label: "Private feed access",
                blurb: "See drops, BTS, and member-only posts.",
              },
              {
                icon: Sparkles,
                label: "Early access to new work",
                blurb: "Hear it first, see it first, own it first.",
              },
              {
                icon: TrendingUp,
                label: "Your share grows with them",
                blurb: "If their momentum builds, your Shares track it.",
              },
              {
                icon: MessageSquare,
                label: "Direct line",
                blurb: "Higher priority when you DM or comment.",
              },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {row.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.blurb}
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setStep("amount")}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={() => setStep("pay")}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : step === "pay" ? (
          <div className="px-6 pb-5 space-y-3">
            <button
              type="button"
              onClick={() => setMethod("credits")}
              className={cn(
                "w-full text-left rounded-xl border-2 p-3 flex items-center gap-3 transition-colors",
                method === "credits"
                  ? "border-foreground bg-foreground/5"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <Coins className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Pay with Credits</p>
                <p className="text-[11px] text-muted-foreground">
                  Balance: {creditBalance.toLocaleString()} ·{" "}
                  {amountCredits.toLocaleString()} needed
                </p>
              </div>
              {method === "credits" && (
                <Check className="h-4 w-4 text-foreground" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMethod("card")}
              className={cn(
                "w-full text-left rounded-xl border-2 p-3 flex items-center gap-3 transition-colors",
                method === "card"
                  ? "border-foreground bg-foreground/5"
                  : "border-border hover:border-foreground/40",
                "opacity-60",
              )}
            >
              <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  Pay with Card{" "}
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground ml-1">
                    Soon
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ${amountUsd.toFixed(2)} via card · arrives later this month
                </p>
              </div>
            </button>

            {method === "credits" && !hasEnoughCredits && (
              <Link
                to="/credits?tab=topup"
                onClick={() => onOpenChange(false)}
                className="block rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              >
                Not enough Credits. Top up →
              </Link>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setStep("value")}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleConfirm}
                disabled={
                  busy ||
                  (method === "credits" && !hasEnoughCredits) ||
                  !launch ||
                  launch.status !== "live"
                }
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Back {displayName} · ${amountUsd}
              </Button>
            </div>
          </div>
        ) : (
          // ─── DONE ─────────────────────────────────────────────
          <div className="px-6 pb-6 space-y-4 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">
                You backed {displayName}.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Their private feed is now unlocked. ${amountUsd} ·{" "}
                {estShares.toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
                Shares.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full gap-1.5"
              >
                Open their private feed <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="px-6 pb-5 pt-1 border-t border-border/40">
          <Link
            to="/credits?tab=how"
            onClick={() => onOpenChange(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            How backing works <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BackCreatorSheet;
