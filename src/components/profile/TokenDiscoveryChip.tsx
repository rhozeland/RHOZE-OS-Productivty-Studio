/**
 * TokenDiscoveryChip — v10 read-only discovery overlay
 *
 * Replaces the v9 `<ProfileCoinTab />` everywhere a creator's token used to
 * surface. NO swap, NO custody, NO bonding-curve UI — just:
 *   • ticker + truncated CA
 *   • live price (Jupiter price API v2, no key required) when available
 *   • "Trade on pump.fun ↗" deeplink
 *
 * Renders null if the creator has no launched coin (or no mint address),
 * so callers can drop it in unconditionally.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  creatorId: string;
  className?: string;
  /** Hide if no on-chain mint address (default true — pre-graduation coins stay hidden) */
  requireMint?: boolean;
}

const trunc = (s: string, head = 4, tail = 4) =>
  s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;

const fmtPrice = (p: number) => {
  if (!Number.isFinite(p) || p <= 0) return null;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(2)}`;
};

const TokenDiscoveryChip = ({ creatorId, className, requireMint = true }: Props) => {
  const { data: coin } = useQuery({
    queryKey: ["token-discovery-chip", creatorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, mint_address, status")
        .eq("creator_id", creatorId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const mint = coin?.mint_address ?? null;

  // Live price from Jupiter — graceful fail (no spinner, just no price)
  const { data: price } = useQuery({
    queryKey: ["jup-price", mint],
    enabled: !!mint,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`);
        if (!res.ok) return null;
        const json = await res.json();
        const raw = json?.data?.[mint!]?.price;
        const n = typeof raw === "string" ? parseFloat(raw) : raw;
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    },
  });

  if (!coin) return null;
  if (requireMint && !mint) return null;

  const priceLabel = price != null ? fmtPrice(price) : null;
  const pumpUrl = mint ? `https://pump.fun/coin/${mint}` : null;

  return (
    <a
      href={pumpUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!pumpUrl) e.preventDefault();
      }}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm",
        "px-3 py-1.5 text-xs hover:bg-card hover:border-border transition-colors max-w-full",
        className,
      )}
      title={mint ? `Trade $${coin.ticker} on pump.fun` : `$${coin.ticker}`}
    >
      <Coins className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="font-mono font-medium text-foreground shrink-0">${coin.ticker}</span>
      {priceLabel && (
        <span className="text-muted-foreground tabular-nums shrink-0">{priceLabel}</span>
      )}
      {mint && (
        <span className="text-muted-foreground/60 font-mono text-[10px] hidden sm:inline truncate">
          {trunc(mint)}
        </span>
      )}
      {pumpUrl && (
        <span className="ml-auto inline-flex items-center gap-0.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
          <span className="hidden sm:inline">pump.fun</span>
          <ExternalLink className="h-3 w-3" />
        </span>
      )}
    </a>
  );
};

export default TokenDiscoveryChip;
