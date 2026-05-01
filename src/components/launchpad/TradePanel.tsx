/**
 * TradePanel — buy/sell UI on the simulated bonding curve.
 *
 * Step 4a uses `simulate_coin_trade` (no real SOL movement). The on-chain
 * pump-style program lands in 4b and will replace this RPC call with a
 * wallet-signed transaction.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowDown } from "lucide-react";

interface Props {
  launchId: string;
  ticker: string;
  status: string;
  virtualSol: number;
  virtualToken: number;
  onTraded: () => void;
}

const TradePanel = ({ launchId, ticker, status, virtualSol, virtualToken, onTraded }: Props) => {
  const { user } = useAuth();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [holdings, setHoldings] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("coin_holdings")
      .select("balance")
      .eq("launch_id", launchId)
      .eq("trader_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHoldings(Number(data?.balance ?? 0)));
  }, [launchId, user, busy]);

  // Quote (preview only — server is source of truth)
  const num = Number(amount);
  let preview: string | null = null;
  if (num > 0 && status === "live") {
    const k = virtualSol * virtualToken;
    if (side === "buy") {
      const net = num * 0.97;
      const newSol = virtualSol + net;
      const newTok = k / newSol;
      const out = virtualToken - newTok;
      preview = `${out.toLocaleString(undefined, { maximumFractionDigits: 2 })} $${ticker}`;
    } else {
      const newTok = virtualToken + num;
      const newSol = k / newTok;
      const grossOut = virtualSol - newSol;
      const netOut = grossOut * 0.97;
      preview = `${netOut.toFixed(6)} SOL`;
    }
  }

  const submit = async () => {
    if (!user) {
      toast({ title: "Sign in to trade", variant: "destructive" });
      return;
    }
    if (!num || num <= 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("simulate_coin_trade", {
      _launch_id: launchId,
      _side: side,
      _amount: num,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Trade failed", description: error.message, variant: "destructive" });
      return;
    }
    const result = data as { graduated?: boolean } | null;
    toast({
      title: side === "buy" ? "Bought" : "Sold",
      description: result?.graduated
        ? "🎓 Curve filled — coin graduated to Raydium queue!"
        : `Trade settled on the curve.`,
    });
    setAmount("");
    onTraded();
  };

  if (status !== "live") {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {status === "graduated"
          ? "🎓 This coin graduated. Trading will resume once Raydium liquidity is live."
          : "Trading is closed for this coin."}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 backdrop-blur p-4 space-y-3">
      <Tabs value={side} onValueChange={(v) => setSide(v as "buy" | "sell")}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="sell">Sell</TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="space-y-3 pt-3">
          <div>
            <label className="text-xs text-muted-foreground">SOL to spend</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.5"
            />
          </div>
          <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
          <div className="rounded-md bg-muted/40 p-3 text-sm font-mono text-center min-h-[2.5rem] flex items-center justify-center">
            {preview ?? <span className="text-muted-foreground text-xs">Receive</span>}
          </div>
        </TabsContent>

        <TabsContent value="sell" className="space-y-3 pt-3">
          <div className="flex justify-between items-center">
            <label className="text-xs text-muted-foreground">${ticker} to sell</label>
            <button
              type="button"
              onClick={() => setAmount(String(holdings))}
              className="text-[11px] text-primary hover:underline"
            >
              Max: {holdings.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </button>
          </div>
          <Input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000"
          />
          <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
          <div className="rounded-md bg-muted/40 p-3 text-sm font-mono text-center min-h-[2.5rem] flex items-center justify-center">
            {preview ?? <span className="text-muted-foreground text-xs">Receive</span>}
          </div>
        </TabsContent>
      </Tabs>

      <Button onClick={submit} disabled={busy} className="w-full">
        {busy && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
        {side === "buy" ? `Buy $${ticker}` : `Sell $${ticker}`}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        Simulated curve · 3% fee · no real SOL is moved
      </p>
    </div>
  );
};

export default TradePanel;
