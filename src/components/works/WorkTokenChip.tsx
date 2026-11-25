/**
 * WorkTokenChip — v11 Pillar 4 "token-attached works"
 *
 * Compact read-only chip rendered for either an approved creator-token link
 * (`works.linked_token_id`) or a verified external pump.fun mint
 * (`works.linked_token_mint`).
 *
 * Returns null if the linked token can't be resolved — never blocks rendering.
 */
import { useQuery } from "@tanstack/react-query";
import { Coins, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  mint?: string | null;
  tokenId?: string | null;
  variant?: "default" | "compact";
  className?: string;
}

const WorkTokenChip = ({ mint, tokenId, variant = "default", className }: Props) => {
  const { data: token } = useQuery({
    queryKey: ["work-token-chip", mint, tokenId],
    enabled: !!mint || !!tokenId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (tokenId) {
        const { data: creatorToken } = await supabase
          .from("creator_tokens")
          .select("mint_address, ticker, status")
          .eq("id", tokenId)
          .maybeSingle();
        if (creatorToken?.status === "approved") {
          return { mint: creatorToken.mint_address, ticker: creatorToken.ticker };
        }
        return null;
      }
      if (!mint) return null;

      // 1. Approved profile token slot (admin-gated)
      const { data: profile } = await supabase
        .from("profiles")
        .select("token_ticker, show_token_chip")
        .eq("token_mint_address", mint!)
        .maybeSingle();
      if (profile && profile.show_token_chip !== false) {
        return { mint, ticker: profile.token_ticker ?? "TOKEN" };
      }
      // 2. Denormalized ticker from any work/project row that attached this coin.
      const { data: workRow } = await (supabase as any)
        .from("works")
        .select("linked_token_ticker")
        .eq("linked_token_mint", mint!)
        .not("linked_token_ticker", "is", null)
        .limit(1)
        .maybeSingle();
      if (workRow?.linked_token_ticker) return { mint, ticker: workRow.linked_token_ticker };
      const { data: projRow } = await (supabase as any)
        .from("projects")
        .select("linked_token_ticker")
        .eq("linked_token_mint", mint!)
        .not("linked_token_ticker", "is", null)
        .limit(1)
        .maybeSingle();
      if (projRow?.linked_token_ticker) return { mint, ticker: projRow.linked_token_ticker };
      return null;
    },
  });

  if (!token?.mint) return null;
  const pumpUrl = `https://pump.fun/coin/${token.mint}`;
  const isCompact = variant === "compact";

  return (
    <a
      href={pumpUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-medium transition-colors hover:bg-emerald-500/15",
        isCompact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className,
      )}
      title={`Backs $${token.ticker} on pump.fun`}
    >
      <Coins className={isCompact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      <span>Backs ${token.ticker}</span>
      {!isCompact && <ExternalLink className="h-3 w-3 opacity-60" />}
    </a>
  );
};

export default WorkTokenChip;
