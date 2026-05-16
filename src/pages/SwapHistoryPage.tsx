/**
 * SwapHistoryPage — receipt log of every simulated $RHOZE ↔ artist-coin
 * trade made by the signed-in user.
 *
 * Source of truth: `coin_swap_ledger` (immutable; written by the
 * `swap_rhoze_for_coin` SECURITY DEFINER RPC). Each row is joined to
 * `coin_launches` so we can render the ticker + artwork. Slippage is a
 * pre-trade max set client-side and isn't persisted per-row, so we surface
 * the realised price + 3% sell-fee (the only fee in the simulator) instead.
 */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Coins, Loader2, Receipt } from "lucide-react";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SwapRow = {
  id: string;
  created_at: string;
  side: "buy" | "sell";
  rhoze_amount: number;
  token_amount: number;
  rhoze_fee: number;
  price_per_token: number;
  rhoze_balance_after: number;
  launch_id: string;
  coin_launches: { ticker: string; name: string; image_url: string | null } | null;
};

const fmt = (n: number, d = 4) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: d });

const SwapHistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/vault");
  };

  const { data, isLoading } = useQuery({
    queryKey: ["swap-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_swap_ledger")
        .select(
          "id,created_at,side,rhoze_amount,token_amount,rhoze_fee,price_per_token,rhoze_balance_after,launch_id,coin_launches(ticker,name,image_url)",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SwapRow[];
    },
  });

  const totals = useMemo(() => {
    const rows = data ?? [];
    let buys = 0, sells = 0, fees = 0;
    for (const r of rows) {
      if (r.side === "buy") buys += Number(r.rhoze_amount);
      else sells += Number(r.rhoze_amount);
      fees += Number(r.rhoze_fee || 0);
    }
    return { count: rows.length, buys, sells, fees };
  }, [data]);

  if (!user) {
    return (
      <div className="container mx-auto max-w-3xl py-12">
        <Card className="p-8 text-center space-y-3">
          <Receipt className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="font-display text-xl">Sign in to view your swap history</h1>
          <Button asChild><Link to="/auth">Sign in</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" />
          Swap history
        </div>
        <h1 className="font-display text-3xl">$RHOZE ↔ Artist Coins</h1>
        <p className="text-sm text-muted-foreground">
          Every simulated trade you've made, newest first. Sells include a 3% fee paid in $RHOZE.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Trades" value={fmt(totals.count, 0)} />
        <StatTile label="$RHOZE in (buys)" value={fmt(totals.buys, 2)} tone="up" />
        <StatTile label="$RHOZE out (sells)" value={fmt(totals.sells, 2)} tone="down" />
        <StatTile label="Fees paid" value={fmt(totals.fees, 4)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Coins className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="font-display text-lg">No swaps yet</h2>
          <p className="text-sm text-muted-foreground">
            Find a coin you believe in and your trades will land here.
          </p>
          <Button asChild variant="outline"><Link to="/discover">Discover artists</Link></Button>
        </Card>
      ) : (
        <Card className="divide-y divide-border/50 overflow-hidden">
          {data.map((r) => {
            const ticker = r.coin_launches?.ticker ?? "COIN";
            const isBuy = r.side === "buy";
            return (
              <div key={r.id} className="p-4 flex items-center gap-4">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                    isBuy
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-rose-500/15 text-rose-500"
                  }`}
                >
                  {isBuy ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {isBuy ? "Buy" : "Sell"}
                    </Badge>
                    <span className="font-mono text-sm">${ticker}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {r.coin_launches?.name ?? "—"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    {isBuy ? (
                      <span>
                        <span className="text-muted-foreground">Spent</span>{" "}
                        <span className="font-mono">{fmt(r.rhoze_amount, 2)} $RHOZE</span>{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        <span className="font-mono">{fmt(r.token_amount)} ${ticker}</span>
                      </span>
                    ) : (
                      <span>
                        <span className="text-muted-foreground">Sold</span>{" "}
                        <span className="font-mono">{fmt(r.token_amount)} ${ticker}</span>{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        <span className="font-mono">{fmt(r.rhoze_amount, 2)} $RHOZE</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>Price {fmt(r.price_per_token, 6)} $RHOZE / token</span>
                    <span>Fee {fmt(r.rhoze_fee, 4)} $RHOZE</span>
                    <span>Balance after {fmt(r.rhoze_balance_after, 2)} $RHOZE</span>
                  </div>
                </div>

                <div className="text-right text-[11px] text-muted-foreground shrink-0">
                  <div>{format(new Date(r.created_at), "MMM d, yyyy")}</div>
                  <div className="font-mono">{format(new Date(r.created_at), "HH:mm:ss")}</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        Slippage is enforced as a pre-trade maximum (selectable in the trade panel) and isn't
        persisted per receipt — the price column above is the realised execution price.
      </p>
    </div>
  );
};

const StatTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) => (
  <Card className="p-3">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div
      className={`font-mono text-lg mt-1 ${
        tone === "up" ? "text-emerald-500" : tone === "down" ? "text-rose-500" : ""
      }`}
    >
      {value}
    </div>
  </Card>
);

export default SwapHistoryPage;
