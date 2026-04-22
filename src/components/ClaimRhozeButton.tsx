import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Download, Wallet } from "lucide-react";
import RhozeClaimCelebration from "@/components/RhozeClaimCelebration";

interface ClaimRhozeButtonProps {
  creditsToClaim: number;
  onSuccess?: () => void;
  className?: string;
  disabled?: boolean;
}

const ClaimRhozeButton = ({
  creditsToClaim,
  onSuccess,
  className,
  disabled,
}: ClaimRhozeButtonProps) => {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [celebration, setCelebration] = useState<{ open: boolean; amount: number; signature?: string }>({
    open: false,
    amount: 0,
  });

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

      setCelebration({ open: true, amount: creditsToClaim, signature: data.signature });
      toast.success(`Claimed ${creditsToClaim} $RHOZE! Tx: ${data.signature?.slice(0, 8)}...`);
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      queryClient.invalidateQueries({ queryKey: ["rhoze-balance"] });
      queryClient.invalidateQueries({ queryKey: ["reward-history"] });
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
        onClick={handleClaim}
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
