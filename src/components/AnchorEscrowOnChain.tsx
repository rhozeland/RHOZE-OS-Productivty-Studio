import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";
import { createMemoTransaction, buildEscrowMemo } from "@/lib/solana-memo";
import { getConnection } from "@/lib/solana";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, Wallet } from "lucide-react";

interface AnchorEscrowOnChainProps {
  action: "lock" | "release" | "refund";
  contractId: string;
  amount: number;
  milestoneTitle?: string;
  onAnchored?: (signature: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Button that records an escrow event as a Solana memo transaction.
 * Creates a verifiable on-chain audit trail.
 */
const AnchorEscrowOnChain = ({
  action,
  contractId,
  amount,
  milestoneTitle,
  onAnchored,
  className,
  disabled,
}: AnchorEscrowOnChainProps) => {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [loading, setLoading] = useState(false);

  const handleAnchor = async () => {
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    setLoading(true);
    try {
      const memo = buildEscrowMemo({ action, contractId, amount, milestoneTitle });
      const transaction = await createMemoTransaction(publicKey, memo);
      const signature = await sendTransaction(transaction, getConnection());

      toast.success(`Escrow ${action} anchored on-chain! Tx: ${signature.slice(0, 8)}...`);
      onAnchored?.(signature);
    } catch (error: any) {
      const msg = error?.message || "Failed to anchor on-chain";
      if (msg.includes("User rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <Button variant="outline" size="sm" className={className} onClick={() => setVisible(true)}>
        <Wallet className="mr-2 h-3 w-3" />
        Connect to Anchor
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={handleAnchor}
      disabled={loading || disabled}
    >
      {loading ? (
        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
      ) : (
        <LinkIcon className="mr-2 h-3 w-3" />
      )}
      {loading ? "Anchoring..." : `Anchor ${action} on Solana`}
    </Button>
  );
};

export default AnchorEscrowOnChain;
