/**
 * UnlockButton — fan-facing CTA on a token-gated Work.
 *
 * Calls the SECURITY DEFINER `request_work_unlock` RPC, which checks the
 * caller's simulated holdings server-side and returns a short-lived signed
 * URL when they qualify. Owners always pass.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Lock, KeyRound, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGate } from "@/hooks/useAuthGate";
import { Button } from "@/components/ui/button";

type UnlockResult =
  | {
      allowed: true;
      signed_url: string;
      balance: number;
      threshold: number;
      ticker: string | null;
      is_owner: boolean;
    }
  | {
      allowed: false;
      reason:
        | "auth_required"
        | "not_found"
        | "not_gated"
        | "insufficient_holdings";
      balance?: number;
      threshold?: number;
      ticker?: string | null;
      launch_id?: string | null;
    };

type Props = {
  workId: string;
  /** Hint we already know is on the work; lets us render label state pre-call. */
  ticker?: string | null;
  threshold?: number | null;
  /** Override visual size. */
  size?: "sm" | "default";
};

export const UnlockButton = ({
  workId,
  ticker,
  threshold,
  size = "sm",
}: Props) => {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const [lastDenied, setLastDenied] = useState<{
    balance: number;
    threshold: number;
    ticker: string | null;
    launchId: string | null;
  } | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("request_work_unlock", {
        _work_id: workId,
      });
      if (error) throw error;
      return data as unknown as UnlockResult;
    },
    onSuccess: (res) => {
      if (res.allowed) {
        setLastDenied(null);
        // Open the signed URL in a new tab. It expires in 5 min.
        window.open(res.signed_url, "_blank", "noopener,noreferrer");
        toast.success(
          res.is_owner ? "Unlocked (owner)" : "Unlocked",
          { description: "Your link is valid for 5 minutes." },
        );
      } else if (res.reason === "insufficient_holdings") {
        setLastDenied({
          balance: res.balance ?? 0,
          threshold: res.threshold ?? 0,
          ticker: res.ticker ?? null,
          launchId: res.launch_id ?? null,
        });
      } else if (res.reason === "auth_required") {
        requireAuth("unlock this work");
      } else if (res.reason === "not_gated") {
        toast.info("This work is open — no unlock needed.");
      } else {
        toast.error("Could not unlock");
      }
    },
    onError: (e: any) =>
      toast.error("Unlock failed", { description: e.message }),
  });

  if (lastDenied) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-foreground font-medium">
          <Lock className="h-3 w-3" />
          Hold ≥ {lastDenied.threshold.toLocaleString()}{" "}
          {lastDenied.ticker ? `$${lastDenied.ticker}` : "tokens"} to unlock
        </div>
        <div className="text-muted-foreground">
          You hold {lastDenied.balance.toLocaleString()}.
        </div>
        {lastDenied.launchId && (
          <Link
            to={`/launchpad/${lastDenied.launchId}`}
            className="inline-flex items-center gap-1 text-foreground hover:opacity-80"
          >
            Buy on the curve <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <Button
      size={size}
      variant="outline"
      className="gap-1.5"
      onClick={() => {
        if (!user) {
          requireAuth("unlock this work");
          return;
        }
        mut.mutate();
      }}
      disabled={mut.isPending}
    >
      {mut.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <KeyRound className="h-3.5 w-3.5" />
      )}
      Unlock
      {ticker && threshold != null ? (
        <span className="text-muted-foreground">
          · ≥{threshold.toLocaleString()} ${ticker}
        </span>
      ) : null}
    </Button>
  );
};

export default UnlockButton;
