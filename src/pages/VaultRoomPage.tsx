import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Coins,
  CreditCard,
  ShoppingBag,
  Repeat,
  Wallet,
  ArrowRight,
  ArrowDownToLine,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RhozeBalanceChip from "@/components/RhozeBalanceChip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import RoomHero from "@/components/rooms/RoomHero";
import { todayGradient } from "@/lib/rhoze-gradients";
import WithdrawalPanel from "@/components/seller/WithdrawalPanel";
import WalletInfoPanel from "@/components/wallet/WalletInfoPanel";

/**
 * THE VAULT — Room 3 (Finance / Growth).
 * Portfolio of Artist Shares + Cash Out → wallet withdrawal.
 */
const VAULT_LINKS: Array<{
  to?: string;
  action?: "activity" | "wallet";
  label: string;
  desc: string;
  Icon: typeof CreditCard;
}> = [
  { to: "/credits", label: "Creator Pass", desc: "Tier · rewards · how it works", Icon: CreditCard },
  { action: "activity", label: "Activity", desc: "Earns, spends & receipts", Icon: ShoppingBag },
  { to: "/swaps", label: "Swaps", desc: "Credits ↔ Artist Shares", Icon: Repeat },
  { action: "wallet", label: "Wallet", desc: "Connected wallet & limits", Icon: Wallet },
];

const VaultRoomPage = () => {
  const { user } = useAuth();
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const grad = todayGradient();

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
  const valueUsd = valueRhoze / 100;

  return (
    <div className="space-y-6">
      <RoomHero
        eyebrow="The Vault"
        title="Your portfolio."
        subtitle="Track what you hold and cash out when you're ready."
      />

      {/* Portfolio value card — animated gradient blob behind */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div
          className="room-hero-blob"
          style={{ background: grad.surface, opacity: 0.7 }}
          aria-hidden
        />
        <div
          className="room-hero-blob"
          style={{
            background: grad.text,
            opacity: 0.15,
            animationDuration: "22s",
            inset: "-20% 30% 20% -20%",
          }}
          aria-hidden
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
              Portfolio value
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-none">
              ${valueUsd.toFixed(2)}
            </h2>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-mono">{valueRhoze.toFixed(0)}</span> $RHOZE across{" "}
              <span className="font-medium text-foreground">{heldCoins}</span> Artist Share
              {heldCoins === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <RhozeBalanceChip />
            <Button
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => setCashOutOpen(true)}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Cash Out
            </Button>
          </div>
        </div>
      </div>

      {/* Vault sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VAULT_LINKS.map(({ to, action, label, desc, Icon }) => {
          const inner = (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="font-display text-base font-semibold leading-tight">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
            </>
          );
          const className =
            "group relative rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors p-4 text-left w-full";
          if (action === "activity" || action === "wallet") {
            const onClick = action === "activity" ? () => setActivityOpen(true) : () => setWalletOpen(true);
            return (
              <button key={label} onClick={onClick} className={className}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={to} to={to!} className={className}>
              {inner}
            </Link>
          );
        })}
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

      {/* Cash Out dialog — wallet withdrawal */}
      <Dialog open={cashOutOpen} onOpenChange={setCashOutOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Cash Out</DialogTitle>
            <DialogDescription>
              Withdraw available funds from your Rhozeland wallet to your payout method.
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-2">
            <WithdrawalPanel />
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity quick-preview dialog */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Recent activity</DialogTitle>
            <DialogDescription>
              A quick peek at your latest earns and spends.
            </DialogDescription>
          </DialogHeader>
          <ActivityQuickList userId={user?.id ?? null} />
          <div className="pt-2 flex justify-end">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/credits?tab=activity" onClick={() => setActivityOpen(false)}>
                Open full activity
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet dialog — connected wallet + claim limits */}
      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Wallet</DialogTitle>
            <DialogDescription>
              Your connected Solana wallet and on-chain claim limits.
            </DialogDescription>
          </DialogHeader>
          <WalletInfoPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* Compact activity list for the dialog — last 6 credit transactions. */
const ActivityQuickList = ({ userId }: { userId: string | null }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["vault-activity-preview", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("credit_transactions")
        .select("id, amount, description, type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6);
      return (data ?? []) as Array<{
        id: string;
        amount: number;
        description: string | null;
        type: string | null;
        created_at: string;
      }>;
    },
  });

  if (!userId) return null;
  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activity yet — start exploring to earn Credits.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/60 max-h-[320px] overflow-y-auto">
      {data.map((t) => {
        const isPositive = Number(t.amount) >= 0;
        return (
          <li key={t.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="text-sm text-foreground truncate">
                {t.description || t.type || "Activity"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(t.created_at).toLocaleString()}
              </div>
            </div>
            <span
              className={`font-mono text-sm tabular-nums shrink-0 ${
                isPositive ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {isPositive ? "+" : ""}
              {Number(t.amount).toFixed(0)}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default VaultRoomPage;
