import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import {
  createTransferTransaction,
  confirmTransaction,
  getConnection,
  isValidSolanaAddress,
} from "@/lib/solana";
import { toast } from "sonner";

interface PayWithSolButtonProps {
  recipientAddress: string;
  solAmount: number;
  label?: string;
}

const PayWithSolButton = ({
  recipientAddress,
  solAmount,
  label,
}: PayWithSolButtonProps) => {
  const { publicKey, signTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    if (!isValidSolanaAddress(recipientAddress)) {
      toast.error("Invalid recipient wallet address");
      return;
    }

    setLoading(true);
    try {
      const recipient = new PublicKey(recipientAddress);
      const connection = getConnection();
      const transaction = await createTransferTransaction(
        publicKey,
        recipient,
        solAmount,
        connection,
      );

      if (!signTransaction) {
        throw new Error("Your connected wallet does not support transaction signing.");
      }
      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        { preflightCommitment: "confirmed" },
      );
      toast.info("Transaction sent, confirming...");

      await confirmTransaction(signature, transaction, connection);
      toast.success(`Sent ${solAmount} SOL! Tx: ${signature.slice(0, 8)}...`);
    } catch (error: any) {
      const msg = error?.message || "Transaction failed";
      if (msg.includes("User rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!connected) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePay}
      disabled={loading}
      className="gap-1.5 text-xs"
    >
      {loading ? "Sending..." : label || `Pay ${solAmount} SOL`}
    </Button>
  );
};

export default PayWithSolButton;
