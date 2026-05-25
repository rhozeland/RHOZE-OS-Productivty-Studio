/**
 * CreatorTokenHoldings — Portfolio section that surfaces every creator
 * token (linked via `profiles.token_mint_address`) currently held in the
 * connected Solana wallet. Read-only, no swap UI.
 *
 *  • Wallet disconnected → connect-wallet card.
 *  • Wallet connected, no matches → empty state w/ Discover link.
 *  • Wallet connected, matches → one row per token: ticker, creator, amount,
 *    USD value (live price via Birdeye public endpoint, Jupiter fallback),
 *    24h change %, "View Creator" link.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Wallet as WalletIcon, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import WalletButton from "@/components/WalletButton";
import { Button } from "@/components/ui/button";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

interface Holding {
  mint: string;
  amount: number;
}

interface CreatorMatch {
  mint: string;
  amount: number;
  creatorId: string;
  username: string | null;
  displayName: string | null;
  ticker: string | null;
  priceUsd: number | null;
  change24h: number | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};

async function fetchPriceForMint(mint: string): Promise<{ priceUsd: number | null; change24h: number | null }> {
  // Birdeye public price first (gives 24h change)
  try {
    const res = await fetch(`https://public-api.birdeye.so/defi/price?address=${mint}&include_liquidity=false`, {
      headers: { "x-chain": "solana" },
    });
    if (res.ok) {
      const j = await res.json();
      const v = j?.data;
      const price = num(v?.value);
      if (price != null) {
        return { priceUsd: price, change24h: num(v?.priceChange24h) };
      }
    }
  } catch {
    /* noop */
  }
  // Jupiter fallback (no 24h)
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`);
    if (res.ok) {
      const j = await res.json();
      return { priceUsd: num(j?.[mint]?.usdPrice), change24h: null };
    }
  } catch {
    /* noop */
  }
  return { priceUsd: null, change24h: null };
}

const fmtUsd = (n: number | null): string => {
  if (n == null) return "—";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n > 0) return `$${n.toExponential(2)}`;
  return "$0";
};

const fmtAmount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
};

const CreatorTokenHoldings = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();

  const { data: rows, isLoading } = useQuery<CreatorMatch[]>({
    queryKey: ["portfolio-token-holdings", publicKey?.toBase58()],
    enabled: connected && !!publicKey,
    staleTime: 60_000,
    queryFn: async () => {
      if (!publicKey) return [];

      // 1. SPL token holdings from the wallet (both Token + Token-2022 programs)
      const [tk, tk22] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
        connection
          .getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID })
          .catch(() => ({ value: [] as any[] })),
      ]);
      const holdings: Holding[] = [];
      for (const acc of [...tk.value, ...tk22.value]) {
        const info: any = (acc.account.data as any)?.parsed?.info;
        const mint = info?.mint as string | undefined;
        const amount = Number(info?.tokenAmount?.uiAmount ?? 0);
        if (mint && amount > 0) holdings.push({ mint, amount });
      }
      if (holdings.length === 0) return [];

      // 2. Match against Rhozeland creators
      const mints = Array.from(new Set(holdings.map((h) => h.mint)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, token_mint_address, token_ticker")
        .in("token_mint_address", mints);

      const profByMint = new Map<string, any>();
      (profiles ?? []).forEach((p: any) => {
        if (p.token_mint_address) profByMint.set(p.token_mint_address, p);
      });

      const matched = holdings.filter((h) => profByMint.has(h.mint));
      if (matched.length === 0) return [];

      // 3. Fetch live prices in parallel
      const prices = await Promise.all(matched.map((m) => fetchPriceForMint(m.mint)));

      return matched.map((m, i): CreatorMatch => {
        const p = profByMint.get(m.mint);
        return {
          mint: m.mint,
          amount: m.amount,
          creatorId: p.id,
          username: p.username,
          displayName: p.display_name,
          ticker: p.token_ticker,
          priceUsd: prices[i].priceUsd,
          change24h: prices[i].change24h,
        };
      });
    },
  });

  const totalValue = useMemo(
    () =>
      (rows ?? []).reduce(
        (sum, r) => sum + (r.priceUsd != null ? r.priceUsd * r.amount : 0),
        0,
      ),
    [rows],
  );

  /* ───── Disconnected ───── */
  if (!connected) {
    return (
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-foreground">Your Token Holdings</h2>
          <p className="text-sm text-muted-foreground">Creator coins in your wallet</p>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center space-y-4">
          <WalletIcon className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect your wallet to see your token holdings.
          </p>
          <div className="flex justify-center">
            <WalletButton />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-foreground">Your Token Holdings</h2>
          <p className="text-sm text-muted-foreground">Creator coins in your wallet</p>
        </div>
        {rows && rows.length > 0 && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total value</p>
            <p className="font-display text-lg font-bold text-foreground">{fmtUsd(totalValue)}</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
          <div className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">No creator tokens in your wallet yet</p>
          <Link to="/discover">
            <Button size="sm" variant="outline">
              Discover Creators
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {rows.map((r) => {
            const value = r.priceUsd != null ? r.priceUsd * r.amount : null;
            const up = r.change24h != null && r.change24h >= 0;
            return (
              <div
                key={r.mint}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                {/* Ticker pill */}
                <div className="shrink-0 h-10 w-10 rounded-full bg-foreground/10 flex items-center justify-center">
                  <span className="font-mono text-[11px] font-bold text-foreground">
                    ${(r.ticker || "?").slice(0, 4).toUpperCase()}
                  </span>
                </div>
                {/* Identity */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      ${r.ticker || "—"}
                    </p>
                    {r.change24h != null && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                          up ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {up ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {up ? "+" : ""}
                        {r.change24h.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.displayName || r.username || "Creator"}
                  </p>
                </div>
                {/* Amount + value */}
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-medium text-foreground tabular-nums">
                    {fmtAmount(r.amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {fmtUsd(value)}
                  </p>
                </div>
                {/* CTA */}
                <Link
                  to={`/profiles/${r.creatorId}`}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                >
                  View Creator <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CreatorTokenHoldings;
