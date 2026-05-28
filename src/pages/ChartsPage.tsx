/**
 * ChartsPage — /charts
 *
 * Creator coins ranked by momentum. Reads creators with linked Solana tokens
 * from `profiles.token_mint_address`, fans out to pump.fun frontend API to
 * fetch live market cap / trades / holders / 24h change, and renders a
 * Riipen × Dexscreener-style dense table. Fully read-only: every CTA links
 * back to the creator's Rhozeland profile.
 *
 * Tabs:
 *   • Trending   — biggest 24h % change (default)
 *   • New        — newest created on-chain
 *   • Top Holders — most unique wallets holding
 *   • Last Traded — most recent trade activity
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, LineChart, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { fmtUsdCompact, fmtCount } from "@/hooks/useCreatorTokenMetrics";
import Sparkline from "@/components/charts/Sparkline";

interface CreatorRow {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  token_mint_address: string;
  token_ticker: string;
  // signal score derived from profile completeness (same shape DiscoverTable uses)
  signalScore: number;
  workCount: number;
}

interface PumpData {
  marketCapUsd: number | null;
  change24h: number | null;
  holderCount: number | null;
  trades24h: number | null;
  createdTimestamp: number | null;
  lastTradeTimestamp: number | null;
}

const SIGNAL_MAX = 15;
const SIGNAL_THRESHOLD = 3;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};
const fetchPumpData = async (mint: string): Promise<PumpData> => {
  // Pump.fun's /coins/{mint} returns market cap + timestamps reliably, but
  // `num_holders`, `trades_24h`, and `price_change_24h` are frequently null
  // (especially for tokens that haven't graduated). We fan out to two more
  // endpoints to backfill: /coins/holders for holder count, and we derive
  // 24h change from /trades/all when pump itself doesn't report it.
  const [coinRes, holdersRes, tradesRes] = await Promise.all([
    fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`).catch(() => null),
    fetch(`https://frontend-api-v3.pump.fun/coins/holders/${mint}`).catch(() => null),
    fetch(
      `https://frontend-api-v3.pump.fun/trades/all/${mint}?limit=200&offset=0&minimumSize=0`,
    ).catch(() => null),
  ]);

  let coin: any = null;
  try {
    if (coinRes?.ok) coin = await coinRes.json();
  } catch {
    /* noop */
  }

  let holderCount: number | null = num(coin?.num_holders ?? coin?.holder_count);
  try {
    if (holdersRes?.ok) {
      const hj = await holdersRes.json();
      const arr = Array.isArray(hj?.holders) ? hj.holders : Array.isArray(hj) ? hj : [];
      if (arr.length) holderCount = arr.length;
    }
  } catch {
    /* noop */
  }

  let trades24h: number | null = num(coin?.trades_24h ?? coin?.txns_24h);
  let change24h: number | null = num(coin?.price_change_24h ?? coin?.priceChange24h);
  try {
    if (tradesRes?.ok) {
      const tj = await tradesRes.json();
      const arr: any[] = Array.isArray(tj) ? tj : Array.isArray(tj?.trades) ? tj.trades : [];
      if (arr.length) {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = arr.filter((t) => {
          const ts = Number(t?.timestamp ?? t?.created_timestamp ?? 0);
          // pump returns seconds OR milliseconds; normalize
          const ms = ts > 10 ** 12 ? ts : ts * 1000;
          return ms >= cutoff;
        });
        if (trades24h == null) trades24h = recent.length;
        if (change24h == null && recent.length >= 2) {
          // pump trade rows expose sol_amount + token_amount; price = sol/token
          const priceOf = (t: any) => {
            const sol = Number(t?.sol_amount ?? 0);
            const tok = Number(t?.token_amount ?? 0);
            return tok > 0 ? sol / tok : null;
          };
          const oldest = priceOf(recent[recent.length - 1]);
          const newest = priceOf(recent[0]);
          if (oldest && newest && oldest > 0) {
            change24h = ((newest - oldest) / oldest) * 100;
          }
        }
      }
    }
  } catch {
    /* noop */
  }

  // If pump didn't return usd_market_cap (rare), derive from virtual reserves.
  let marketCapUsd = num(coin?.usd_market_cap);
  if (marketCapUsd == null && coin?.virtual_sol_reserves && coin?.virtual_token_reserves) {
    try {
      const solRes = await fetch(
        "https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112",
      );
      const sj = await solRes.json();
      const solUsd = num(sj?.So11111111111111111111111111111111111111112?.usdPrice);
      if (solUsd) {
        const supply = 1_000_000_000; // pump.fun standard
        const priceSol =
          Number(coin.virtual_sol_reserves) / 1e9 /
          (Number(coin.virtual_token_reserves) / 1e6);
        marketCapUsd = priceSol * solUsd * supply;
      }
    } catch {
      /* noop */
    }
  }

  return {
    marketCapUsd,
    change24h,
    holderCount,
    trades24h,
    createdTimestamp: num(coin?.created_timestamp),
    lastTradeTimestamp: num(coin?.last_trade_timestamp),
  };
};

const fetchSparkline7d = async (mint: string): Promise<number[]> => {
  // Pump.fun trades — derive a 24h price walk from the last ~200 trades.
  // Birdeye public history_price requires an API key, so we skip it.
  try {
    const res = await fetch(
      `https://frontend-api-v3.pump.fun/trades/all/${mint}?limit=200&offset=0&minimumSize=0`,
    );
    if (!res.ok) return [];
    const j = await res.json();
    const arr: any[] = Array.isArray(j) ? j : Array.isArray(j?.trades) ? j.trades : [];
    if (!arr.length) return [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const points = arr
      .map((t) => {
        const ts = Number(t?.timestamp ?? t?.created_timestamp ?? 0);
        const ms = ts > 10 ** 12 ? ts : ts * 1000;
        const sol = Number(t?.sol_amount ?? 0);
        const tok = Number(t?.token_amount ?? 0);
        const price = tok > 0 ? sol / tok : null;
        return { ms, price };
      })
      .filter((p) => p.ms >= cutoff && p.price != null)
      .sort((a, b) => a.ms - b.ms)
      .map((p) => p.price as number);
    return points;
  } catch {
    return [];
  }
};


const HolderAvatars = ({ count }: { count: number }) => {
  // 3 deterministic placeholder dots whose hue derives from the count so two
  // creators in the same table don't end up with identical stacks.
  const seeds = [count * 17, count * 37 + 11, count * 53 + 7];
  return (
    <div className="flex -space-x-1.5 shrink-0">
      {seeds.map((s, i) => {
        const hue = Math.abs(s) % 360;
        return (
          <span
            key={i}
            className="h-5 w-5 rounded-full border border-background"
            style={{
              background: `hsl(${hue} 70% 65%)`,
            }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
};

const ChartsPage = () => {
  // 1) creators with linked tokens
  const { data: creators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ["charts-creators"],
    staleTime: 60_000,
    queryFn: async (): Promise<CreatorRow[]> => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select(
          "id, user_id, username, display_name, avatar_url, bio, verification_status, token_mint_address, token_ticker, show_token_chip, is_public",
        )
        .not("token_mint_address", "is", null)
        .neq("is_public", false)
        .limit(100);

      if (!profiles?.length) return [];

      const userIds = profiles.map((p: any) => p.user_id);
      const { data: worksRows } = await supabase
        .from("works")
        .select("user_id")
        .in("user_id", userIds);

      const workCount = new Map<string, number>();
      (worksRows ?? []).forEach((w: any) => {
        workCount.set(w.user_id, (workCount.get(w.user_id) ?? 0) + 1);
      });

      const filtered: CreatorRow[] = profiles
        .filter((p: any) => p.token_mint_address && p.show_token_chip !== false)
        .map((p: any) => {
          let score = 0;
          if (p.avatar_url) score += 3;
          if ((p.bio ?? "").length >= 40) score += 2;
          if (p.verification_status === "verified") score += 4;
          const wc = workCount.get(p.user_id) ?? 0;
          score += Math.min(wc, 5) * 3;
          return {
            id: p.id,
            user_id: p.user_id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            token_mint_address: p.token_mint_address,
            token_ticker: p.token_ticker ?? "TOKEN",
            signalScore: score,
            workCount: wc,
          };
        })
        .filter((r) => r.signalScore >= SIGNAL_THRESHOLD || true); // keep all listed tokens

      return filtered;
    },
  });

  // 2) live pump.fun metrics, one query per token, 60s refresh
  const pumpQueries = useQueries({
    queries: creators.map((c) => ({
      queryKey: ["charts-pump", c.token_mint_address],
      queryFn: () => fetchPumpData(c.token_mint_address),
      enabled: !!c.token_mint_address,
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  // 3) 24h sparkline per token
  const sparkQueries = useQueries({
    queries: creators.map((c) => ({
      queryKey: ["charts-spark", c.token_mint_address],
      queryFn: () => fetchSparkline7d(c.token_mint_address),
      enabled: !!c.token_mint_address,
      staleTime: 5 * 60_000,
      refetchInterval: 5 * 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  const enriched = useMemo(() => {
    return creators.map((c, i) => ({
      ...c,
      pump: (pumpQueries[i]?.data as PumpData | undefined) ?? null,
      sparkline: (sparkQueries[i]?.data as number[] | undefined) ?? [],
    }));
  }, [creators, pumpQueries, sparkQueries]);

  const sortFor = (
    tab: "trending" | "new" | "holders" | "traded",
  ): typeof enriched => {
    const arr = [...enriched];
    if (tab === "trending") {
      arr.sort(
        (a, b) =>
          (b.pump?.change24h ?? -Infinity) - (a.pump?.change24h ?? -Infinity),
      );
    } else if (tab === "new") {
      arr.sort(
        (a, b) =>
          (b.pump?.createdTimestamp ?? 0) - (a.pump?.createdTimestamp ?? 0),
      );
    } else if (tab === "holders") {
      arr.sort(
        (a, b) => (b.pump?.holderCount ?? 0) - (a.pump?.holderCount ?? 0),
      );
    } else if (tab === "traded") {
      arr.sort(
        (a, b) =>
          (b.pump?.lastTradeTimestamp ?? 0) -
          (a.pump?.lastTradeTimestamp ?? 0),
      );
    }
    return arr;
  };

  const renderTable = (rows: typeof enriched) => {
    if (creatorsLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-muted/50 animate-pulse"
            />
          ))}
        </div>
      );
    }

    if (!rows.length) {
      return (
        <EmptyState
          icon={Coins}
          title="No creator coins yet"
          description="Be the first to launch your coin through Creator Pass."
          cta={{ label: "Go to Creator Pass", to: "/credits" }}
          size="lg"
        />
      );
    }

    return (
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead className="w-12 text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Rank
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Creator
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground/70 text-right">
                Market cap
              </TableHead>
              <TableHead className="hidden md:table-cell text-[10px] uppercase tracking-widest text-muted-foreground/70 text-right">
                Trades
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Holders
              </TableHead>
              <TableHead className="hidden md:table-cell text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Signal
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground/70 text-right">
                Past 24h
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => {
              const change = r.pump?.change24h ?? null;
              const up = change != null ? change >= 0 : null;
              const profileHref = r.username
                ? `/u/${r.username}`
                : `/profiles/${r.id}`;
              const name = r.display_name || r.username || "Creator";
              const signalPct = Math.min(
                100,
                Math.round((r.signalScore / SIGNAL_MAX) * 100),
              );

              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer border-border/40 transition-colors hover:bg-muted/40"
                  onClick={(e) => {
                    // honor middle-click / cmd-click on inner links by ignoring those
                    if ((e.target as HTMLElement).closest("a")) return;
                    window.location.assign(profileHref);
                  }}
                >
                  <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">
                    #{idx + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={profileHref}
                      className="flex items-center gap-3 group"
                    >
                      <Avatar className="h-9 w-9 border border-border/60">
                        <AvatarImage src={r.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate group-hover:underline underline-offset-2">
                          {name}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          ${r.token_ticker}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center justify-end gap-1 text-sm font-semibold tabular-nums",
                        up == null
                          ? "text-foreground"
                          : up
                            ? "text-emerald-600"
                            : "text-red-500",
                      )}
                    >
                      {up != null &&
                        (up ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        ))}
                      {fmtUsdCompact(r.pump?.marketCapUsd ?? null)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right text-sm tabular-nums text-foreground">
                    {fmtCount(r.pump?.trades24h ?? null)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <HolderAvatars count={r.pump?.holderCount ?? 0} />
                      <span className="text-sm tabular-nums text-foreground">
                        {fmtCount(r.pump?.holderCount ?? null)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell w-32">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-foreground tabular-nums">
                        {r.signalScore}
                        <span className="text-muted-foreground">
                          /{SIGNAL_MAX}
                        </span>
                      </p>
                      <Progress value={signalPct} className="h-1" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Sparkline data={r.sparkline} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <LineChart className="h-6 w-6 text-primary" />
          Charts
        </h1>
        <p className="text-sm text-muted-foreground">
          Creator coins ranked by momentum.
        </p>
      </header>

      <Tabs defaultValue="trending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="holders">Top Holders</TabsTrigger>
          <TabsTrigger value="traded">Last Traded</TabsTrigger>
        </TabsList>
        <TabsContent value="trending">{renderTable(sortFor("trending"))}</TabsContent>
        <TabsContent value="new">{renderTable(sortFor("new"))}</TabsContent>
        <TabsContent value="holders">{renderTable(sortFor("holders"))}</TabsContent>
        <TabsContent value="traded">{renderTable(sortFor("traded"))}</TabsContent>
      </Tabs>
    </div>
  );
};

export default ChartsPage;
