import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  Wallet,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Fuel,
  Hash,
  Network,
} from "lucide-react";
import RhozeClaimCelebration from "@/components/RhozeClaimCelebration";

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;
// Base sig fee (5000 lamports) + small priority buffer; ATA creation adds ~0.00203928 SOL rent (paid by payout wallet, not user)
const ESTIMATED_FEE_LAMPORTS = 5000;

interface TxPreview {
  blockhash: string;
  lastValidBlockHeight: number;
  feeLamports: number;
  slot: number;
}

const formatSol = (lamports: number) =>
  (lamports / LAMPORTS_PER_SOL).toFixed(9).replace(/0+$/, "").replace(/\.$/, "");

interface ClaimRhozeButtonProps {
  creditsToClaim: number;
  onSuccess?: () => void;
  className?: string;
  disabled?: boolean;
}

const shortenAddress = (addr: string) =>
  addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : addr;

const ClaimRhozeButton = ({
  creditsToClaim,
  onSuccess,
  className,
  disabled,
}: ClaimRhozeButtonProps) => {
  const { publicKey, connected, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [celebration, setCelebration] = useState<{ open: boolean; amount: number; signature?: string }>({
    open: false,
    amount: 0,
  });
  const [preview, setPreview] = useState<TxPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() ?? "";

  const fetchPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [{ commitment: "finalized" }] },
          { jsonrpc: "2.0", id: 2, method: "getSlot", params: [{ commitment: "finalized" }] },
        ]),
      });
      const json = await res.json();
      const bhResult = Array.isArray(json) ? json.find((r) => r.id === 1)?.result?.value : null;
      const slotResult = Array.isArray(json) ? json.find((r) => r.id === 2)?.result : null;
      if (!bhResult?.blockhash) throw new Error("No blockhash returned");
      setPreview({
        blockhash: bhResult.blockhash,
        lastValidBlockHeight: bhResult.lastValidBlockHeight,
        feeLamports: ESTIMATED_FEE_LAMPORTS,
        slot: typeof slotResult === "number" ? slotResult : 0,
      });
    } catch (e: any) {
      setPreviewError(e?.message || "Couldn't fetch network preview");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openConfirm = () => {
    if (!publicKey || !user) {
      toast.error("Connect your wallet and sign in first");
      return;
    }
    if (creditsToClaim <= 0) {
      toast.error("Enter an amount to claim");
      return;
    }
    setAcknowledged(false);
    setPreview(null);
    setPreviewError(null);
    setClaimError(null);
    setConfirmOpen(true);
  };

  useEffect(() => {
    if (!confirmOpen) return;
    fetchPreview();
  }, [confirmOpen]);

  // Detect wallet disconnect while the confirm dialog is open
  useEffect(() => {
    if (!confirmOpen) return;
    if (connected && publicKey) return;
    if (loading) return; // claim in flight — don't yank dialog
    toast.error("Wallet disconnected", {
      description: "Reconnect your wallet to continue claiming $RHOZE.",
    });
    setConfirmOpen(false);
    setClaimError(null);
  }, [connected, publicKey, confirmOpen, loading]);

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy address");
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !connected || !user) {
      const msg = "Wallet disconnected — reconnect to claim.";
      setClaimError(msg);
      toast.error(msg);
      return;
    }

    if (creditsToClaim <= 0) {
      const msg = "Enter an amount to claim.";
      setClaimError(msg);
      toast.error(msg);
      return;
    }

    setClaimError(null);
    setLoading(true);
    try {
      setStatus("Sending tokens...");
      const { data, error } = await supabase.functions.invoke("claim-rhoze", {
        body: {
          wallet_address: publicKey.toBase58(),
          credits_to_claim: creditsToClaim,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.signature) throw new Error("Transaction did not return a signature.");

      setConfirmOpen(false);
      setCelebration({ open: true, amount: creditsToClaim, signature: data.signature });
      toast.success(`Claimed ${creditsToClaim} $RHOZE!`, {
        description: `Tx: ${data.signature.slice(0, 8)}…${data.signature.slice(-6)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      queryClient.invalidateQueries({ queryKey: ["rhoze-balance"] });
      queryClient.invalidateQueries({ queryKey: ["reward-history"] });
      queryClient.invalidateQueries({ queryKey: ["rhoze-claim-history"] });
      onSuccess?.();
    } catch (error: any) {
      const raw = error?.message || "Claim failed unexpectedly.";
      const friendly = /network|fetch|failed to fetch|timeout/i.test(raw)
        ? "Network error reaching the claim service. Check your connection and try again."
        : /insufficient|balance/i.test(raw)
        ? raw
        : /wallet/i.test(raw)
        ? raw
        : raw;
      setClaimError(friendly);
      toast.error("Claim failed", { description: friendly });
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  if (!connected) {
    return (
      <Button variant="outline" className={className} onClick={() => setVisible(true)}>
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet to Claim
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        className={className}
        onClick={openConfirm}
        disabled={loading || disabled || creditsToClaim <= 0}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {status || "Processing..."}
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Claim {creditsToClaim} $RHOZE to Wallet
          </>
        )}
      </Button>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (loading) return;
          setConfirmOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Confirm $RHOZE claim
            </DialogTitle>
            <DialogDescription className="font-body">
              Review the destination wallet and amount carefully — claims are
              final and recorded on Solana.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount */}
            <div className="rounded-xl border border-border bg-card/60 p-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body mb-1">
                You will receive
              </p>
              <p className="font-display text-4xl text-foreground tabular-nums">
                {creditsToClaim.toLocaleString()}{" "}
                <span className="text-base font-body text-muted-foreground">
                  $RHOZE
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground font-body mt-1">
                1 credit = 1 $RHOZE token
              </p>
            </div>

            {/* Destination wallet */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body">
                  Destination wallet
                </p>
                {wallet?.adapter?.name && (
                  <span className="text-[10px] font-body text-muted-foreground">
                    via {wallet.adapter.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 font-mono text-sm text-foreground break-all">
                  {shortenAddress(walletAddress)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="h-7 px-2 shrink-0"
                  title="Copy full address"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground break-all">
                {walletAddress}
              </p>
            </div>

            {/* Transaction preview */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body flex items-center gap-1.5">
                  <Network className="h-3 w-3" />
                  Transaction preview
                </p>
                <button
                  type="button"
                  onClick={fetchPreview}
                  disabled={previewLoading}
                  className="text-[10px] font-body text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
                  title="Refresh preview"
                >
                  <RefreshCw className={`h-3 w-3 ${previewLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {previewLoading && !preview ? (
                <div className="space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted/50 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted/50 animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-muted/50 animate-pulse" />
                </div>
              ) : previewError ? (
                <p className="text-[11px] text-destructive font-body">
                  {previewError}. You can still claim — preview is informational only.
                </p>
              ) : preview ? (
                <div className="space-y-2 text-[11px] font-body">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <Network className="h-3 w-3" /> Network
                    </span>
                    <span className="font-mono text-foreground">Solana mainnet-beta</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <Fuel className="h-3 w-3" /> Est. network fee
                    </span>
                    <span className="font-mono text-foreground tabular-nums">
                      ~{formatSol(preview.feeLamports)} SOL
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Fees paid by</span>
                    <span className="font-mono text-foreground">Rhozeland payout wallet</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <Hash className="h-3 w-3" /> Recent blockhash
                    </span>
                    <span className="font-mono text-foreground" title={preview.blockhash}>
                      {preview.blockhash.slice(0, 6)}…{preview.blockhash.slice(-6)}
                    </span>
                  </div>
                  {preview.slot > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Current slot</span>
                      <span className="font-mono text-foreground tabular-nums">
                        {preview.slot.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Valid until block</span>
                    <span className="font-mono text-foreground tabular-nums">
                      {preview.lastValidBlockHeight.toLocaleString()}
                    </span>
                  </div>

                  <a
                    href={`https://explorer.solana.com/address/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline font-body"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Preview destination on Solana Explorer
                  </a>
                </div>
              ) : null}
            </div>

            {/* Warning + acknowledgment */}
            <button
              type="button"
              onClick={() => setAcknowledged((a) => !a)}
              className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                acknowledged
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card/40 hover:bg-card/60"
              }`}
            >
              <div
                className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                  acknowledged
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/40"
                }`}
              >
                {acknowledged && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs font-body font-medium text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-primary" />
                  I confirm this is my wallet
                </p>
                <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
                  Tokens sent to the wrong address cannot be recovered. Your
                  account will be permanently bound to this wallet.
                </p>
              </div>
            </button>

            {/* Inline claim error */}
            {claimError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-body font-medium text-destructive">
                    Claim failed
                  </p>
                  <p className="text-[11px] text-destructive/90 font-body leading-relaxed break-words">
                    {claimError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setClaimError(null)}
                  className="text-[10px] font-body text-destructive/80 hover:text-destructive shrink-0"
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              {claimError ? "Close" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={handleClaim}
              disabled={loading || !acknowledged || creditsToClaim <= 0 || !connected}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {status || "Sending..."}
                </>
              ) : claimError ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry claim
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Confirm & claim
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RhozeClaimCelebration
        open={celebration.open}
        amount={celebration.amount}
        signature={celebration.signature}
        onClose={() => setCelebration((c) => ({ ...c, open: false }))}
      />
    </>
  );
};

export default ClaimRhozeButton;
