/**
 * RhozeBalanceChip — top-bar pill showing the user's in-app $RHOZE balance.
 *
 * Replaces the legacy "Select Wallet" Solana adapter button. Wallet
 * connection now lives only inside Creator Pass / Wallet settings (used
 * for withdrawals). Tier eligibility reads from this same in-app
 * `user_credits.balance`, so this chip is the canonical balance view.
 *
 * Click → /credits (Creator Pass).
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const formatBalance = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
};

const RhozeBalanceChip = () => {
  const { user } = useAuth();

  const { data: balance } = useQuery({
    queryKey: ["rhoze-balance-chip", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  if (!user) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/credits"
          className="h-8 inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-muted/50 px-3 text-xs font-medium font-body text-foreground transition-colors"
          aria-label="Your $RHOZE balance"
        >
          <Coins className="h-3.5 w-3.5 text-primary" />
          <span className="tabular-nums">{formatBalance(balance ?? 0)}</span>
          <span className="text-muted-foreground">$RHOZE</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs font-body">
        In-app $RHOZE balance · Open Creator Pass
      </TooltipContent>
    </Tooltip>
  );
};

export default RhozeBalanceChip;
