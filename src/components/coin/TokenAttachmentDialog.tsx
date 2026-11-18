import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Coins, Loader2, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { TokenAttachmentController } from "@/hooks/useTokenAttachment";
import {
  isWalletConnectionRequiredError,
  isWalletSignatureRejectedError,
  tokenAttachmentErrorMessage,
  type TokenAttachmentTarget,
} from "@/lib/token-attachment";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Props extends TokenAttachmentTarget {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: TokenAttachmentController;
  hasExistingLink?: boolean;
}

type Method = "choose" | "approved" | "external";

const isValidMint = (value: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());

const showAttachmentError = (error: unknown) => {
  const message = tokenAttachmentErrorMessage(error);
  if (isWalletSignatureRejectedError(error) || isWalletConnectionRequiredError(error)) {
    toast.info(message);
  } else {
    toast.error(message);
  }
};

export default function TokenAttachmentDialog({ open, onOpenChange, targetType, targetId, attachment, hasExistingLink = false }: Props) {
  const { user } = useAuth();
  const [method, setMethod] = useState<Method>("choose");
  const [mintAddress, setMintAddress] = useState("");

  const approvedTokens = useQuery({
    queryKey: ["approved-creator-tokens", user?.id],
    enabled: open && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_tokens")
        .select("id, mint_address, ticker, name, is_primary")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) {
      setMethod("choose");
      setMintAddress("");
    }
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (attachment.isPending) return;
    onOpenChange(nextOpen);
  };

  const attachApproved = async (tokenId: string, ticker: string) => {
    try {
      const linked = await attachment.attachApproved({ tokenId, targetType, targetId });
      if (!linked) return;
      toast.success(`Attached $${ticker}`);
      onOpenChange(false);
    } catch (error) {
      showAttachmentError(error);
    }
  };

  const attachExternal = async () => {
    const mint = mintAddress.trim();
    if (!isValidMint(mint)) {
      toast.error("Enter a valid Solana mint address.");
      return;
    }
    try {
      const result = await attachment.attachExternal({ mintAddress: mint, targetType, targetId });
      if (!result) return;
      toast.success(`Attached $${result.token.ticker}`);
      onOpenChange(false);
    } catch (error) {
      showAttachmentError(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Attach a token</DialogTitle>
          <DialogDescription>
            {hasExistingLink
              ? `Choose a method to replace the current token on this ${targetType === "project" ? "Project" : "Work"}.`
              : `Choose how to link a token to this ${targetType === "project" ? "Project" : "Work"}.`}
          </DialogDescription>
        </DialogHeader>

        {method === "choose" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMethod("approved")}
              className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
            >
              <Check className="mb-3 h-5 w-5 text-emerald-500" />
              <div className="font-medium">Approved token</div>
              <div className="mt-1 text-xs text-muted-foreground">Link one of your approved creator tokens.</div>
            </button>
            <button
              type="button"
              onClick={() => setMethod("external")}
              className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
            >
              <Wallet className="mb-3 h-5 w-5" />
              <div className="font-medium">External pump.fun token</div>
              <div className="mt-1 text-xs text-muted-foreground">Prove creator-wallet ownership with a message signature.</div>
            </button>
          </div>
        )}

        {method === "approved" && (
          <div className="space-y-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMethod("choose")}>
              Back to methods
            </Button>
            {approvedTokens.isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading approved tokens…
              </div>
            ) : approvedTokens.isError ? (
              <p className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
                Could not load approved creator tokens. Try again.
              </p>
            ) : approvedTokens.data?.length ? (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {approvedTokens.data.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    disabled={attachment.isPending}
                    onClick={() => void attachApproved(token.id, token.ticker)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                  >
                    <Coins className="h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">${token.ticker} · {token.name ?? "Creator token"}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{token.mint_address}</span>
                    </span>
                    {token.is_primary && <span className="text-[10px] text-muted-foreground">Primary</span>}
                    {attachment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                <p>You do not have any approved creator tokens yet.</p>
                <Link to="/settings#token" onClick={() => onOpenChange(false)} className="mt-2 inline-block text-primary underline underline-offset-4">
                  Submit a token for approval
                </Link>
              </div>
            )}
          </div>
        )}

        {method === "external" && (
          <div className="space-y-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMethod("choose")} disabled={attachment.isPending}>
              Back to methods
            </Button>
            <label htmlFor="external-pump-mint" className="text-sm font-medium">Pump.fun mint address</label>
            <Input
              id="external-pump-mint"
              value={mintAddress}
              onChange={(event) => setMintAddress(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !attachment.isPending) void attachExternal(); }}
              placeholder="Paste the mint address"
              className="font-mono"
              disabled={attachment.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Your connected wallet must be the pump.fun creator wallet. Signing a message does not send a transaction or spend SOL.
            </p>
            <Button type="button" className="w-full" onClick={() => void attachExternal()} disabled={attachment.isPending || !mintAddress.trim()}>
              {attachment.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying and attaching…</> : "Verify creator wallet and attach"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
