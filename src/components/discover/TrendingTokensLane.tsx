/**
 * TrendingTokensLane — v10.2 Dexscreener-style horizontal lane.
 *
 * Reads creators with a linked Solana token (profiles.token_mint_address)
 * and renders their ticker + live USD price (Jupiter Price v3, batched).
 * Each card deep-links to pump.fun. Rhozeland NEVER simulates a swap;
 * this is pure discovery.
 *
 * Self-gated: if no creators have linked a token, returns null.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coins, ExternalLink, TrendingUp } from "lucide-react";

interface CreatorToken {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  token_mint_address: string;
  token_ticker: string;
}

const fmtPrice = (p: number) => {
  if (!Number.isFinite(p) || p <= 0) return null;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(2)}`;
};

const TrendingTokensLane = () => {
  const { data: creators = [] } = useQuery({
    queryKey: ["trending-tokens-lane"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, token_mint_address, token_ticker, show_token_chip")
        .not("token_mint_address", "is", null)
        .neq("show_token_chip", false)
        .limit(20);
      return ((data ?? []) as any[])
        .filter((p) => p.token_mint_address)
        .map((p) => ({
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          token_mint_address: p.token_mint_address as string,
          token_ticker: (p.token_ticker ?? "TOKEN") as string,
        })) as CreatorToken[];
    },
    staleTime: 5 * 60_000,
  });

  const mints = creators.map((c) => c.token_mint_address).join(",");

  const { data: prices = {} } = useQuery({
    queryKey: ["jup-price-v3-batch", mints],
    enabled: !!mints,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mints}`);
        if (!res.ok) return {};
        const json = await res.json();
        const out: Record<string, number | null> = {};
        for (const c of creators) {
          const raw = json?.[c.token_mint_address]?.usdPrice;
          const n = typeof raw === "string" ? parseFloat(raw) : raw;
          out[c.token_mint_address] = Number.isFinite(n) ? n : null;
        }
        return out;
      } catch {
        return {};
      }
    },
  });

  if (!creators.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Trending creator tokens
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live from pump.fun · prices via Jupiter
          </p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x scrollbar-thin">
        {creators.map((c) => {
          const price = prices[c.token_mint_address];
          const priceLabel = price != null ? fmtPrice(price) : null;
          const pumpUrl = `https://pump.fun/coin/${c.token_mint_address}`;
          const name = c.display_name || c.username || "Creator";
          return (
            <div
              key={c.id}
              className="snap-start shrink-0 w-[220px] rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm hover:border-border transition-colors overflow-hidden"
            >
              <Link
                to={c.username ? `/u/${c.username}` : `/profile/${c.id}`}
                className="flex items-center gap-2.5 p-3 hover:bg-muted/30 transition-colors"
              >
                <Avatar className="h-9 w-9 border border-border/60">
                  <AvatarImage src={c.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {c.username ? `@${c.username}` : ""}
                  </p>
                </div>
              </Link>
              <a
                href={pumpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-border/40 hover:bg-muted/30 transition-colors"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Coins className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-mono text-xs font-semibold text-foreground">
                    ${c.token_ticker}
                  </span>
                  {priceLabel && (
                    <span className="text-xs tabular-nums text-muted-foreground truncate">
                      {priceLabel}
                    </span>
                  )}
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TrendingTokensLane;
