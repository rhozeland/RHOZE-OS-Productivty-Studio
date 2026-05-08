import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Coins, CreditCard, ShoppingBag, Repeat, Wallet, ArrowRight, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RhozeBalanceChip from "@/components/RhozeBalanceChip";

/**
 * THE VAULT — Room 3 (Finance / Growth).
 *
 * Front door for portfolio, $RHOZE balance, credits, purchases, swaps, and
 * payouts. Composes existing finance-related surfaces — every linked route
 * is unchanged.
 */
const VAULT_LINKS = [
  { to: "/credits", label: "Creator Pass", desc: "Tier · rewards · how it works", Icon: CreditCard },
  { to: "/credits?tab=purchases", label: "Purchases", desc: "Tickets & receipts", Icon: ShoppingBag },
  { to: "/swaps", label: "Swaps", desc: "$RHOZE ↔ artist coins", Icon: Repeat },
  { to: "/settings", label: "Wallet & Payouts", desc: "Withdraw earnings", Icon: Wallet },
];

const VaultRoomPage = () => {
  const { user } = useAuth();

  // Lightweight portfolio peek — coin holdings count + $RHOZE balance.
  const { data: holdings } = useQuery({
    queryKey: ["vault-coin-holdings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("coin_holdings")
        .select("coin_id, balance")
        .eq("user_id", user!.id);
      return (data ?? []) as Array<{ coin_id: string; balance: number }>;
    },
  });

  const heldCoins = (holdings ?? []).filter((h: any) => Number(h.balance) > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <span className="text-[10px] uppercase tracking-[0.28em] text-primary font-semibold">
          Room 3 · The Vault
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Finance · Growth
        </span>
      </div>

      {/* Header: balance + portfolio summary */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-1">
              Your portfolio
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
              Own what you back.
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Track your $RHOZE, the artist coins you hold, and your earnings — all in one room.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <RhozeBalanceChip />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>
                {heldCoins} artist coin{heldCoins === 1 ? "" : "s"} held
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Vault sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VAULT_LINKS.map(({ to, label, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="group relative rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="font-display text-base font-semibold leading-tight">{label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
          </Link>
        ))}
      </div>

      {/* Footer cue */}
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 flex items-center gap-3">
        <Coins className="h-5 w-5 text-primary shrink-0" />
        <div className="text-xs text-muted-foreground">
          Earn $RHOZE by being active across Rhozeland — hold it to unlock Spark · Bloom · Glow · Play tier perks.
          <Link to="/credits?tab=how" className="ml-1 text-foreground underline underline-offset-2 hover:no-underline">
            How rewards work →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VaultRoomPage;
