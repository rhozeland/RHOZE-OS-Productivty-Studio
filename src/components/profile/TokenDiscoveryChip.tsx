/**
 * TokenDiscoveryChip — v10.2 read-only discovery overlay
 *
 * Reads the creator's linked Solana token directly off
 * `profiles.token_mint_address` / `token_ticker` — Rhozeland no longer
 * operates a simulated launchpad, so there's no `coin_launches` row to
 * resolve. Renders:
 *   • ticker + truncated CA
 *   • live price (Jupiter price API v3, no key required) when available
 *   • "Trade on pump.fun ↗" deeplink
 *
 * Returns null if the creator hasn't linked a token (or opted out via
 * `show_token_chip = false`), so callers can drop it in unconditionally.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  creatorId: string;
  className?: string;
}

const trunc = (s: string, head = 4, tail = 4) =>
  s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;

const fmtPrice = (p: number) => {
  if (!Number.isFinite(p) || p <= 0) return null;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(2)}`;
};

const TokenDiscoveryChip = ({ creatorId, className }: Props) => {
  const { data: token } = useQuery({
    queryKey: ["token-discovery-chip-v2", creatorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("token_mint_address, token_ticker, show_token_chip")
        .eq("id", creatorId)
        .maybeSingle();
      if (!data) return null;
      if (data.show_token_chip === false) return null;
      if (!data.token_mint_address) return null;
      return {
        mint: data.token_mint_address as string,
        ticker: (data.token_ticker ?? "TOKEN") as string,
      };
    },
  });

  const mint = token?.mint ?? null;

  const { data: price } = useQuery({
    queryKey: ["jup-price-v3", mint],
    enabled: !!mint,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`);
        if (!res.ok) return null;
        const json = await res.json();
        const raw = json?.[mint!]?.usdPrice;
        const n = typeof raw === "string" ? parseFloat(raw) : raw;
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    },
  });

  if (!token) return null;

  const priceLabel = price != null ? fmtPrice(price) : null;
  const pumpUrl = `https://pump.fun/coin/${token.mint}`;

  return (
    <a
      href={pumpUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm",
        "px-3 py-1.5 text-xs hover:bg-card hover:border-border transition-colors max-w-full",
        className,
      )}
      title={`Trade $${token.ticker} on pump.fun`}
    >
      <Coins className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="font-mono font-medium text-foreground shrink-0">${token.ticker}</span>
      {priceLabel && (
        <span className="text-muted-foreground tabular-nums shrink-0">{priceLabel}</span>
      )}
      <span className="text-muted-foreground/60 font-mono text-[10px] hidden sm:inline truncate">
        {trunc(token.mint)}
      </span>
      <span className="ml-auto inline-flex items-center gap-0.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
        <span className="hidden sm:inline">pump.fun</span>
        <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  );
};

export default TokenDiscoveryChip;
