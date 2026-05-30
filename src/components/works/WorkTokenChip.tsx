/**
 * WorkTokenChip — v11 Pillar 4 "token-attached works"
 *
 * Compact read-only chip rendered on any work whose owner has linked
 * a pump.fun coin via `works.linked_token_mint`. Resolves the ticker
 * by looking up the mint on `profiles` (only admin-approved tokens
 * show, by virtue of `token_mint_address` being the approved slot).
 *
 * Returns null if the mint can't be resolved — never blocks rendering.
 */
import { useQuery } from "@tanstack/react-query";
import { Coins, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  mint: string | null | undefined;
  variant?: "default" | "compact";
  className?: string;
}

const WorkTokenChip = ({ mint, variant = "default", className }: Props) => {
  const { data: token } = useQuery({
    queryKey: ["work-token-chip", mint],
    enabled: !!mint,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("token_ticker, show_token_chip")
        .eq("token_mint_address", mint!)
        .maybeSingle();
      if (!data) return null;
      if (data.show_token_chip === false) return null;
      return { ticker: data.token_ticker ?? "TOKEN" };
    },
  });

  if (!mint || !token) return null;
  const pumpUrl = `https://pump.fun/coin/${mint}`;
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
