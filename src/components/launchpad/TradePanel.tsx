/**
 * TradePanel — buy/sell UI on the bonding curve.
 *
 * Two modes:
 *   - Simulation (4a): server RPC `simulate_coin_trade` (no real SOL moved).
 *   - On-chain (4b):   wallet-signed tx via `onChainBuy` / `onChainSell`.
 *                      Surfaces the full lifecycle: sending → sent → confirmed
 *                      → finalized, plus decoded program errors.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowDown,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Radio,
} from "lucide-react";
import {
  isLaunchpadOnChainEnabled,
  LAUNCHPAD_NETWORK,
  getLaunchpadConnection,
  deriveLaunchPda,
  onChainBuy,
  onChainSell,
} from "@/lib/launchpad-onchain";
import { decodeTradeError, type DecodedTradeError } from "@/lib/launchpad-error-decoder";

interface Props {
  launchId: string;
  ticker: string;
  status: string;
  virtualSol: number;
  virtualToken: number;
  onTraded: () => void;
}

type TxPhase =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "signing" }
  | { kind: "sent"; signature: string }
  | { kind: "confirmed"; signature: string }
  | { kind: "finalized"; signature: string }
  | { kind: "error"; decoded: DecodedTradeError; signature?: string; logs?: string[] };

const TradePanel = ({ launchId, ticker, status, virtualSol, virtualToken, onTraded }: Props) => {
  const { user } = useAuth();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [holdings, setHoldings] = useState<number>(0);
  const [phase, setPhase] = useState<TxPhase>({ kind: "idle" });

  const onChainEnabled = isLaunchpadOnChainEnabled();

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

  const explorerUrl = useMemo(() => {
    if (phase.kind === "idle" || phase.kind === "building" || phase.kind === "signing") return null;
    const sig = "signature" in phase ? phase.signature : undefined;
    if (!sig) return null;
    const cluster = LAUNCHPAD_NETWORK === "devnet" ? "?cluster=devnet" : "";
    return `https://solscan.io/tx/${sig}${cluster}`;
  }, [phase]);

  const submitSimulated = async () => {
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

  const submitOnChain = async () => {
    setBusy(true);
    setPhase({ kind: "building" });

    const launchPda = deriveLaunchPda(launchId)?.toBase58();
    if (!launchPda) {
      setBusy(false);
      setPhase({
        kind: "error",
        decoded: decodeTradeError("Launch PDA could not be derived. Program ID missing."),
      });
      return;
    }

    setPhase({ kind: "signing" });
    const result =
      side === "buy"
        ? await onChainBuy({ launchPda, solIn: num, minTokensOut: 0 })
        : await onChainSell({ launchPda, tokensIn: num, minSolOut: 0 });

    if (result.enabled === false) {
      setBusy(false);
      setPhase({
        kind: "error",
        decoded: decodeTradeError("On-chain mode unexpectedly disabled."),
      });
      return;
    }
    if (result.ok === false) {
      const decoded = decodeTradeError(result.error);
      setBusy(false);
      setPhase({ kind: "error", decoded });
      toast({ title: decoded.title, description: decoded.detail, variant: "destructive" });
      return;
    }

    const signature = result.data.signature;
    setPhase({ kind: "sent", signature });

    // Poll confirmation → finalization. Stop early on error.
    try {
      const conn = getLaunchpadConnection();
      const status1 = await conn.confirmTransaction(signature, "confirmed");
      if (status1.value.err) {
        const errStr = JSON.stringify(status1.value.err);
        const tx = await conn.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
        const logs = tx?.meta?.logMessages ?? [];
        const decoded = decodeTradeError(errStr, logs);
        setBusy(false);
        setPhase({ kind: "error", decoded, signature, logs });
        toast({ title: decoded.title, description: decoded.detail, variant: "destructive" });
        return;
      }
      setPhase({ kind: "confirmed", signature });

      // Finalization is best-effort; UI works fine with confirmed.
      conn
        .confirmTransaction(signature, "finalized")
        .then((s) => {
          if (!s.value.err) setPhase({ kind: "finalized", signature });
        })
        .catch(() => {/* no-op */});

      toast({
        title: side === "buy" ? "Bought" : "Sold",
        description: `Confirmed on Solana ${LAUNCHPAD_NETWORK}.`,
      });
      setAmount("");
      onTraded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const decoded = decodeTradeError(msg);
      setPhase({ kind: "error", decoded, signature });
      toast({ title: decoded.title || "Couldn't confirm", description: decoded.detail, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!user) {
      toast({ title: "Sign in to trade", variant: "destructive" });
      return;
    }
    if (!num || num <= 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }
    if (onChainEnabled) await submitOnChain();
    else await submitSimulated();
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

      {/* On-chain transaction lifecycle — only renders in 4b mode */}
      {onChainEnabled && phase.kind !== "idle" && (
        <TxStatus phase={phase} explorerUrl={explorerUrl} />
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        {onChainEnabled
          ? `Live on Solana ${LAUNCHPAD_NETWORK} · 3% fee · wallet signature required`
          : "Simulated curve · 3% fee · no real SOL is moved"}
      </p>
    </div>
  );
};

const PHASE_STEPS: TxPhase["kind"][] = ["building", "signing", "sent", "confirmed", "finalized"];
const PHASE_LABELS: Record<TxPhase["kind"], string> = {
  idle: "",
  building: "Building transaction",
  signing: "Awaiting wallet signature",
  sent: "Sent to validator",
  confirmed: "Confirmed",
  finalized: "Finalized",
  error: "Failed",
};

const TxStatus = ({ phase, explorerUrl }: { phase: TxPhase; explorerUrl: string | null }) => {
  const isError = phase.kind === "error";
  const currentIdx = PHASE_STEPS.indexOf(phase.kind);
  const sig = "signature" in phase ? phase.signature : undefined;

  return (
    <div
      className={`rounded-md border px-3 py-2.5 space-y-2 text-xs ${
        isError
          ? "border-destructive/40 bg-destructive/5"
          : phase.kind === "finalized" || phase.kind === "confirmed"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/60 bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {isError ? (
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
        ) : phase.kind === "finalized" || phase.kind === "confirmed" ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        )}
        <span className="font-medium">{PHASE_LABELS[phase.kind]}</span>
        <Badge variant="outline" className="ml-auto text-[9px] uppercase gap-1">
          <Radio className="h-2.5 w-2.5" /> {LAUNCHPAD_NETWORK}
        </Badge>
      </div>

      {/* Step pips */}
      {!isError && (
        <div className="flex gap-1">
          {PHASE_STEPS.map((step, i) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentIdx ? "bg-emerald-500" : "bg-muted"
              }`}
              title={PHASE_LABELS[step]}
            />
          ))}
        </div>
      )}

      {sig && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          {sig.slice(0, 8)}…{sig.slice(-8)}
        </a>
      )}

      {isError && phase.kind === "error" && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-destructive font-medium">{phase.decoded.title}</p>
              <p className="text-[11px] text-destructive/80">{phase.decoded.detail}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <Badge variant="outline" className="text-[9px] uppercase border-destructive/40 text-destructive">
                {phase.decoded.source}
              </Badge>
              {phase.decoded.code !== null && (
                <span className="text-[9px] font-mono text-muted-foreground">
                  code {phase.decoded.code}
                  {phase.decoded.name ? ` · ${phase.decoded.name}` : ""}
                </span>
              )}
            </div>
          </div>
          {phase.logs && phase.logs.length > 0 && (
            <details className="text-[10px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">Program logs ({phase.logs.length})</summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">
                {phase.logs.join("\n")}
              </pre>
            </details>
          )}
          {phase.decoded.source === "anchor" && phase.decoded.code !== null && phase.decoded.name === null && (
            <p className="text-[10px] text-muted-foreground italic">
              No matching entry in your IDL. Paste the latest IDL in Settings → Verified IP for richer messages.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default TradePanel;
