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

const fetchPumpData = async (mint: string): Promise<{ data: PumpData; sparkline: number[] }> => {
  // Browser cannot hit pump.fun directly (Cloudflare 403 + CORS). Go through
  // our `creator-token-metrics` edge function, which proxies pump.fun +
  // Birdeye + Jupiter server-side and returns a normalized payload.
  const { data, error } = await supabase.functions.invoke("creator-token-metrics", {
    method: "GET",
    // supabase-js doesn't support GET query params on invoke; encode in body
    // by switching to a URL fetch instead.
  } as any).catch(() => ({ data: null, error: { message: "invoke failed" } } as any));

  // Fallback: hit the function URL directly with query string.
  if (!data || error) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/creator-token-metrics?mint=${encodeURIComponent(mint)}`;
    const res = await fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (!res.ok) {
      return {
        data: {
          marketCapUsd: null, change24h: null, holderCount: null,
          trades24h: null, createdTimestamp: null, lastTradeTimestamp: null,
        },
        sparkline: [],
      };
    }
    const j: any = await res.json();
    return {
      data: {
        marketCapUsd: num(j?.marketCapUsd),
        change24h: num(j?.change24h),
        holderCount: num(j?.holderCount),
        trades24h: num(j?.trades24h),
        createdTimestamp: num(j?.createdTimestamp),
        lastTradeTimestamp: num(j?.lastTradeTimestamp),
      },
      sparkline: Array.isArray(j?.sparkline7d) ? j.sparkline7d.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n)) : [],
    };
  }

  const j: any = data;
  return {
    data: {
      marketCapUsd: num(j?.marketCapUsd),
      change24h: num(j?.change24h),
      holderCount: num(j?.holderCount),
      trades24h: num(j?.trades24h),
      createdTimestamp: num(j?.createdTimestamp),
      lastTradeTimestamp: num(j?.lastTradeTimestamp),
    },
    sparkline: Array.isArray(j?.sparkline7d) ? j.sparkline7d.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n)) : [],
  };
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

const ChartsPage = ({ embedded = false }: { embedded?: boolean } = {}) => {
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

  const enriched = useMemo(() => {
    return creators.map((c, i) => {
      const q = pumpQueries[i]?.data as { data: PumpData; sparkline: number[] } | undefined;
      return {
        ...c,
        pump: q?.data ?? null,
        sparkline: q?.sparkline ?? [],
      };
    });
  }, [creators, pumpQueries]);

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

  const body = (
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
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-xs font-semibold tracking-[0.18em] uppercase text-foreground/70 shrink-0 flex items-center gap-1.5">
            <LineChart className="h-3.5 w-3.5" /> Coin momentum
          </h3>
          <div className="h-px flex-1 bg-border" />
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3 pb-12 space-y-8">
      <section>
        <div className="relative overflow-hidden rounded-2xl mb-5 shadow-[0_20px_50px_-20px_hsl(var(--foreground)/0.4)]">
          <div
            aria-hidden
            className="absolute inset-0 bg-[length:300%_300%] animate-gradient-shift"
            style={{
              backgroundImage:
                "linear-gradient(120deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 25%, hsl(38 92% 55%) 50%, hsl(292 84% 61%) 75%, hsl(330 85% 60%) 100%)",
            }}
          />
          <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, hsl(0 0% 100% / 0.25), transparent 40%), radial-gradient(circle at 80% 70%, hsl(0 0% 100% / 0.18), transparent 45%)" }} />
          <div className="relative px-5 py-4 sm:px-6 sm:py-5 text-white">
            <p className="text-[9px] uppercase tracking-[0.22em] text-white/80">
              Live from pump.fun
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight tracking-tight drop-shadow-sm mt-0.5">
              Charts
            </h1>
          </div>
        </div>
        <div className="relative rounded-3xl overflow-hidden border border-border/60 bg-card/40 p-4 md:p-6">
          {body}
        </div>
      </section>
    </div>
  );
};

export default ChartsPage;
