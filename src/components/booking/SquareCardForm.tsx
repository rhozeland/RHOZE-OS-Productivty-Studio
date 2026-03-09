import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Lock } from "lucide-react";

const SQUARE_APP_ID = "sq0idp-6DOCO8-ecgOxWj6fNpywsQ";
const SQUARE_LOCATION_ID = "DDWDTXBFW3T4R";

interface SquareCardFormProps {
  amount: number; // in USD
  onTokenize: (token: string) => Promise<void>;
  disabled?: boolean;
}

declare global {
  interface Window {
    Square: any;
  }
}

const SquareCardForm = ({ amount, onTokenize, disabled }: SquareCardFormProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInstanceRef = useRef<any>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait for Square SDK to load
  useEffect(() => {
    const check = () => {
      if (window.Square) {
        setSdkReady(true);
        return;
      }
      setTimeout(check, 200);
    };
    check();
  }, []);

  // Initialize card payment form
  useEffect(() => {
    if (!sdkReady || !cardRef.current) return;

    let cancelled = false;

    const init = async () => {
      try {
        const payments = window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();

        if (cancelled) {
          await card.destroy();
          return;
        }

        await card.attach(cardRef.current);
        cardInstanceRef.current = card;
        setCardReady(true);
      } catch (err: any) {
        console.error("Square card init error:", err);
        setError("Failed to load payment form. Please refresh and try again.");
      }
    };

    init();

    return () => {
      cancelled = true;
      if (cardInstanceRef.current) {
        cardInstanceRef.current.destroy().catch(() => {});
        cardInstanceRef.current = null;
        setCardReady(false);
      }
    };
  }, [sdkReady]);

  const handlePay = useCallback(async () => {
    if (!cardInstanceRef.current || processing || disabled) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await cardInstanceRef.current.tokenize();

      if (result.status === "OK") {
        await onTokenize(result.token);
      } else {
        const errors = result.errors?.map((e: any) => e.message).join(", ") || "Card validation failed";
        setError(errors);
      }
    } catch (err: any) {
      setError(err.message || "Payment failed");
    } finally {
      setProcessing(false);
    }
  }, [onTokenize, processing, disabled]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Card Details</span>
        <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
        <span className="text-xs text-muted-foreground">Secured by Square</span>
      </div>

      <div
        ref={cardRef}
        className="min-h-[44px] rounded-lg border border-border bg-card p-1"
      />

      {!sdkReady && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading payment form...
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <Button
        className="w-full"
        onClick={handlePay}
        disabled={!cardReady || processing || disabled}
      >
        {processing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
        ) : (
          <>Pay ${amount.toFixed(2)}</>
        )}
      </Button>
    </div>
  );
};

export { SQUARE_LOCATION_ID };
export default SquareCardForm;
