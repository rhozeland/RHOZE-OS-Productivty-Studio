import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Coins, TrendingUp, TrendingDown, ArrowRight, Wallet } from "lucide-react";

type Holding = {
  launch_id: string;
  balance: number;
  sol_invested: number;
  name: string;
  ticker: string;
  image_url: string | null;
  status: string;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
};

const formatNum = (n: number, max = 2) =>
  n.toLocaleString(undefined, { maximumFractionDigits: max });

const CoinPortfolio = () => {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("coin_holdings")
        .select(
          "launch_id, balance, sol_invested, coin_launches!inner(name, ticker, image_url, status, virtual_sol_reserves, virtual_token_reserves)"
        )
        .eq("trader_id", user.id)
        .gt("balance", 0);

      const rows: Holding[] = (data ?? []).map((r: any) => ({
        launch_id: r.launch_id,
        balance: Number(r.balance),
        sol_invested: Number(r.sol_invested),
        name: r.coin_launches?.name ?? "Coin",
        ticker: r.coin_launches?.ticker ?? "?",
        image_url: r.coin_launches?.image_url ?? null,
        status: r.coin_launches?.status ?? "live",
        virtual_sol_reserves: Number(r.coin_launches?.virtual_sol_reserves ?? 0),
        virtual_token_reserves: Number(r.coin_launches?.virtual_token_reserves ?? 1),
      }));
      setHoldings(rows);
      setLoading(false);
    })();
  }, [user]);

  const enriched = (holdings ?? []).map((h) => {
    const spotPrice = h.virtual_sol_reserves / Math.max(h.virtual_token_reserves, 1);
    const value = h.balance * spotPrice;
    const pnl = value - h.sol_invested;
    const pnlPct = h.sol_invested > 0 ? (pnl / h.sol_invested) * 100 : 0;
    return { ...h, spotPrice, value, pnl, pnlPct };
  }).sort((a, b) => b.value - a.value);

  const totals = enriched.reduce(
    (acc, h) => {
      acc.value += h.value;
      acc.invested += h.sol_invested;
      return acc;
    },
    { value: 0, invested: 0 }
  );
  const totalPnl = totals.value - totals.invested;
  const totalPct = totals.invested > 0 ? (totalPnl / totals.invested) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-sm font-body font-semibold text-foreground flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          My portfolio
        </h3>
        <Link
          to="/discover"
          className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Discover artists →
        </Link>
      </div>

      {/* Totals strip */}
      <div className="surface-card p-4 grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Holdings</div>
          <div className="text-lg font-display font-bold text-foreground">{enriched.length}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Value ($RHOZE)</div>
          <div className="text-lg font-display font-bold text-foreground">{formatNum(totals.value)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P&L</div>
          <div
            className={`text-lg font-display font-bold flex items-center gap-1 ${
              totalPnl >= 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {totalPnl >= 0 ? "+" : ""}
            {formatNum(totalPnl)}
            <span className="text-xs font-body opacity-80">({formatNum(totalPct, 1)}%)</span>
          </div>
        </div>
      </div>

      {/* Holdings list */}
      {loading ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : enriched.length === 0 ? (
        <div className="surface-card p-8 text-center space-y-2">
          <Coins className="h-8 w-8 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">You don't hold any artist coins yet.</p>
          <Link
            to="/discover"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Find artists to support <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/30">
            <span>Coin</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Value</span>
            <span className="text-right">P&L</span>
            <span className="w-6" />
          </div>
          {enriched.map((h) => (
            <Link
              key={h.launch_id}
              to={`/launchpad/${h.launch_id}`}
              className="grid grid-cols-[1.5fr_1fr_auto] md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                  {h.image_url ? (
                    <img src={h.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Coins className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">${h.ticker}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{h.name}</div>
                </div>
              </div>
              <div className="text-right text-sm text-foreground tabular-nums md:block hidden">
                {formatNum(h.balance)}
              </div>
              <div className="text-right text-sm text-foreground tabular-nums">
                {formatNum(h.value)}
              </div>
              <div
                className={`text-right text-sm tabular-nums md:block hidden ${
                  h.pnl >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {h.pnl >= 0 ? "+" : ""}
                {formatNum(h.pnl)}
                <div className="text-[10px] opacity-70">
                  {formatNum(h.pnlPct, 1)}%
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoinPortfolio;
