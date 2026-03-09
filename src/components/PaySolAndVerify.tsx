import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  createTransferTransaction,
  confirmTransaction,
  getConnection,
} from "@/lib/solana";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";

export const TREASURY_ADDRESS = "6znjR2ttDJ5c6ScePsE4jU8e2g29dChX7cCVk6xjizr";

interface PaySolAndVerifyProps {
  solAmount: number;
  creditsToAdd: number;
  description: string;
  type?: string;
  onSuccess?: () => void;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

const PaySolAndVerify = ({
  solAmount,
  creditsToAdd,
  description,
  type = "purchase",
  onSuccess,
  label,
  className,
  variant = "outline",
  disabled,
}: PaySolAndVerifyProps) => {
  const { publicKey, sendTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handlePay = async () => {
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Send SOL to treasury
      setStatus("Sending SOL...");
      const recipient = new PublicKey(TREASURY_ADDRESS);
      const transaction = await createTransferTransaction(publicKey, recipient, solAmount);
      const signature = await sendTransaction(transaction, getConnection());

      // Step 2: Wait for confirmation
      setStatus("Confirming on-chain...");
      await confirmTransaction(signature);

      // Step 3: Verify on backend and credit user
      setStatus("Verifying & crediting...");
      const { data, error } = await supabase.functions.invoke("verify-sol-payment", {
        body: {
          signature,
          expected_sol: solAmount,
          credits_to_add: creditsToAdd,
          description,
          type,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Payment confirmed! ${creditsToAdd} credit(s) added. Tx: ${signature.slice(0, 8)}...`);
      onSuccess?.();
    } catch (error: any) {
      const msg = error?.message || "Transaction failed";
      if (msg.includes("User rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  if (!connected) {
    return (
      <Button variant={variant} className={className} disabled>
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet First
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handlePay}
      disabled={loading || disabled}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {status || "Processing..."}
        </>
      ) : (
        <>
          <Wallet className="mr-2 h-4 w-4" />
          {label || `Pay ${solAmount} SOL`}
        </>
      )}
    </Button>
  );
};

export default PaySolAndVerify;
