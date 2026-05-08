import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Coins, CreditCard, ShoppingBag, Repeat, Wallet, ArrowRight, ArrowDownToLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RhozeBalanceChip from "@/components/RhozeBalanceChip";
import { Button } from "@/components/ui/button";

/**
 * THE VAULT — Room 3 (Finance / Growth).
 * Shows portfolio value of held Artist Shares + a clear Cash Out CTA.
 */
const VAULT_LINKS = [
  { to: "/credits", label: "Creator Pass", desc: "Tier · rewards · how it works", Icon: CreditCard },
  { to: "/credits?tab=purchases", label: "Purchases", desc: "Tickets & receipts", Icon: ShoppingBag },
  { to: "/swaps", label: "Swaps", desc: "Credits ↔ Artist Shares", Icon: Repeat },
  { to: "/settings", label: "Wallet", desc: "Payout details & history", Icon: Wallet },
];

const VaultRoomPage = () => {
  const { user } = useAuth();

  // Holdings + live coin prices → estimated portfolio value (in $RHOZE)
  const { data: portfolio } = useQuery({
    queryKey: ["vault-portfolio", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: holdings } = await (supabase as any)
        .from("coin_holdings")
        .select("launch_id, balance")
        .eq("trader_id", user!.id)
        .gt("balance", 0);

      const rows = (holdings ?? []) as Array<{ launch_id: string; balance: number }>;
      if (!rows.length) return { heldCoins: 0, valueRhoze: 0 };

      const launchIds = rows.map((r) => r.launch_id);
      const { data: launches } = await supabase
        .from("coin_launches")
        .select("id, virtual_sol_reserves, virtual_token_reserves")
        .in("id", launchIds);

      const priceById = new Map<string, number>();
      (launches ?? []).forEach((l: any) => {
        const p = l.virtual_token_reserves > 0 ? l.virtual_sol_reserves / l.virtual_token_reserves : 0;
        priceById.set(l.id, p);
      });

      const valueRhoze = rows.reduce(
        (sum, r) => sum + Number(r.balance) * (priceById.get(r.launch_id) ?? 0),
        0,
      );
      return { heldCoins: rows.length, valueRhoze };
    },
  });

  const heldCoins = portfolio?.heldCoins ?? 0;
  const valueRhoze = portfolio?.valueRhoze ?? 0;
  // 100 $RHOZE ≈ $1
  const valueUsd = valueRhoze / 100;

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

      {/* Header: portfolio value + Cash Out */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-1">
              Portfolio value
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold leading-none">
              ${valueUsd.toFixed(2)}
            </h1>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-mono">{valueRhoze.toFixed(0)}</span> $RHOZE across{" "}
              <span className="font-medium text-foreground">{heldCoins}</span> Artist Share
              {heldCoins === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <RhozeBalanceChip />
            <Button asChild size="sm" className="rounded-full gap-1.5">
              <Link to="/settings">
                <ArrowDownToLine className="h-3.5 w-3.5" />
                Cash Out
              </Link>
            </Button>
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
          Earn Platform Credits by being active across Rhozeland — hold them to unlock Spark · Bloom · Glow · Play tier perks.
          <Link to="/credits?tab=how" className="ml-1 text-foreground underline underline-offset-2 hover:no-underline">
            How rewards work →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VaultRoomPage;
