import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getConnection } from "@/lib/solana";
import { toast } from "sonner";
import { Loader2, Wallet, Coins } from "lucide-react";

const RHOZE_MINT = new PublicKey("7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump");
const TREASURY = new PublicKey("6znjR2ttDJ5c6ScePsE4jU8e2g29dChX7cCVk6xjizr");
const RHOZE_DECIMALS = 6;

interface PayWithRhozeButtonProps {
  tokenAmount: number;
  creditsToAdd: number;
  description: string;
  type?: string;
  onSuccess?: () => void;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

const PayWithRhozeButton = ({
  tokenAmount,
  creditsToAdd,
  description,
  type = "purchase",
  onSuccess,
  label,
  className,
  variant = "outline",
  disabled,
}: PayWithRhozeButtonProps) => {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handlePay = async () => {
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    setLoading(true);
    try {
      setStatus("Building transaction...");
      const connection = getConnection();
      const rawAmount = BigInt(Math.floor(tokenAmount * Math.pow(10, RHOZE_DECIMALS)));

      const senderATA = getAssociatedTokenAddressSync(RHOZE_MINT, publicKey);
      const treasuryATA = getAssociatedTokenAddressSync(RHOZE_MINT, TREASURY);

      const transaction = new Transaction();

      // Check if treasury ATA exists
      const treasuryATAInfo = await connection.getAccountInfo(treasuryATA);
      if (!treasuryATAInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(publicKey, treasuryATA, TREASURY, RHOZE_MINT)
        );
      }

      transaction.add(
        createTransferInstruction(senderATA, treasuryATA, publicKey, rawAmount)
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      setStatus("Confirm in wallet...");
      const signature = await sendTransaction(transaction, connection);

      setStatus("Confirming...");
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      setStatus("Verifying...");
      const { data, error } = await supabase.functions.invoke("verify-rhoze-payment", {
        body: {
          signature,
          expected_tokens: tokenAmount,
          credits_to_add: creditsToAdd,
          description,
          type,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Paid ${tokenAmount} $RHOZE! ${creditsToAdd} credits added.`);
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
      <Button variant={variant} className={className} onClick={() => setVisible(true)}>
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
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
          <Coins className="mr-2 h-4 w-4" />
          {label || `Pay ${tokenAmount} $RHOZE`}
        </>
      )}
    </Button>
  );
};

export default PayWithRhozeButton;
