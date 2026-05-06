/**
 * RhozeBalanceChip — top-bar pill showing the user's in-app $RHOZE balance.
 *
 * Tapping the chip opens a slide-in drawer (Sheet) with the current balance,
 * a "Claim to Wallet" shortcut, and a link to the Creator Pass page —
 * keeping the user in-context instead of navigating away.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Coins, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import ClaimRhozeButton from "@/components/ClaimRhozeButton";

const formatBalance = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
};

const RhozeBalanceChip = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

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

  const balanceNum = balance ?? 0;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-8 inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-muted/50 px-3 text-xs font-medium font-body text-foreground transition-colors"
            aria-label="Your $RHOZE balance"
          >
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span className="tabular-nums">{formatBalance(balanceNum)}</span>
            <span className="text-muted-foreground">$RHOZE</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs font-body">
          In-app $RHOZE balance
        </TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[360px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle className="font-display">Your $RHOZE</SheetTitle>
            <SheetDescription className="font-body">
              In-app balance · earned through activity and rewards.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
              <Coins className="h-3.5 w-3.5 text-primary" />
              Current balance
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-display font-semibold tabular-nums">
                {Math.round(balanceNum).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground font-body">$RHOZE</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-body mb-2">
                Claim to wallet
              </div>
              <ClaimRhozeButton />
            </div>

            <Link
              to="/credits"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl border border-border bg-card hover:bg-muted/50 px-4 py-3 text-sm font-body text-foreground transition-colors"
            >
              <span>View Creator Pass</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default RhozeBalanceChip;
