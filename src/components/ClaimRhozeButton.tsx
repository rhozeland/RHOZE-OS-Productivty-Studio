import { useState } from "react";
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
import { Loader2, Download, Wallet, Copy, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import RhozeClaimCelebration from "@/components/RhozeClaimCelebration";

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

  const walletAddress = publicKey?.toBase58() ?? "";

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
    setConfirmOpen(true);
  };

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
    if (!publicKey || !user) {
      toast.error("Connect your wallet and sign in first");
      return;
    }

    if (creditsToClaim <= 0) {
      toast.error("Enter an amount to claim");
      return;
    }

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

      setConfirmOpen(false);
      setCelebration({ open: true, amount: creditsToClaim, signature: data.signature });
      toast.success(`Claimed ${creditsToClaim} $RHOZE! Tx: ${data.signature?.slice(0, 8)}...`);
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      queryClient.invalidateQueries({ queryKey: ["rhoze-balance"] });
      queryClient.invalidateQueries({ queryKey: ["reward-history"] });
      queryClient.invalidateQueries({ queryKey: ["rhoze-claim-history"] });
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.message || "Claim failed");
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
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleClaim}
              disabled={loading || !acknowledged || creditsToClaim <= 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {status || "Sending..."}
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
