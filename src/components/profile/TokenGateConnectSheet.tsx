/**
 * TokenGateConnectSheet — Pillar 2.
 *
 * Opens from <SubscriberLock /> when a creator has a linked, approved
 * pump.fun token. Flow:
 *   1) Connect Solana wallet (reuses @solana/wallet-adapter modal).
 *   2) Build a fresh signed message: "Rhozeland token-gate access for {creatorId} at {ISO}".
 *   3) Wallet signMessage → POST /verify-token-grant.
 *   4) Edge fn checks SPL balance for creator.token_mint_address → upserts 24h grant.
 *   5) On success, invalidate token-gate-access query → SubscriberLock unlocks in place.
 */
import { useState } from "react";
import { Loader2, Wallet, Sparkles, ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorId: string;
  creatorName?: string | null;
  ticker?: string | null;
}

export default function TokenGateConnectSheet({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  ticker,
}: Props) {
  const { user } = useAuth();
  const { publicKey, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const handleVerify = async () => {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    if (!connected || !publicKey || !signMessage) {
      setVisible(true);
      return;
    }
    setBusy(true);
    try {
      const message = `Rhozeland token-gate access for ${creatorId} at ${new Date().toISOString()}`;
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(sigBytes);

      const { data, error } = await supabase.functions.invoke("verify-token-grant", {
        body: {
          creatorId,
          walletAddress: publicKey.toBase58(),
          signature,
          message,
        },
      });
      if (error) throw error;
      if (!data?.granted) {
        toast.error("Wallet doesn't hold this token", {
          description: ticker
            ? `Buy some $${ticker} on pump.fun then try again.`
            : "Buy some of this creator's token on pump.fun then try again.",
        });
        return;
      }
      toast.success(`Unlocked via $${data.ticker || ticker || "TOKEN"}`, {
        description: `Access valid 24h — auto-refreshes while you hold.`,
      });
      qc.invalidateQueries({ queryKey: ["token-gate-access"] });
      qc.invalidateQueries({ queryKey: ["works"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Verification failed", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Unlock with ${ticker || "TOKEN"}
          </DialogTitle>
          <DialogDescription>
            Hold any amount of {creatorName || "this creator"}'s token in your
            Solana wallet to unlock their private feed for 24 hours. No payment,
            no subscription.
          </DialogDescription>
        </DialogHeader>

        <ol className="text-sm text-muted-foreground space-y-2 pl-5 list-decimal">
          <li>Connect your Solana wallet (Phantom, Solflare).</li>
          <li>Sign a free verification message — no transaction, no gas.</li>
          <li>We check the on-chain balance and unlock instantly.</li>
        </ol>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleVerify}
            disabled={busy}
            size="lg"
            className="gap-2"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : connected ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            {connected
              ? busy
                ? "Verifying…"
                : `Verify & unlock`
              : "Connect wallet"}
          </Button>

          {ticker && (
            <a
              href={`https://pump.fun/coin/${encodeURIComponent(ticker)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] text-center text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
            >
              Don't hold ${ticker}? Buy on pump.fun{" "}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
