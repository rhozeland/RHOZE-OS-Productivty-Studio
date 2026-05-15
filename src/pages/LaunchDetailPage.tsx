/**
 * LaunchDetailPage — `/launchpad/:id`
 *
 * Pump.fun / Padre-style trading terminal:
 *   - Top header strip: ticker, name, status, quick stats (price, mcap, vol, holders)
 *   - Main column: PriceChartCard (toggle Price ↔ Bonding Curve), then
 *     a tab strip (Trades · Holders · About).
 *   - Right column: mode banner, trade panel, on-chain addresses + balances.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Coins,
  GraduationCap,
  ExternalLink,
  ArrowLeft,
  Copy,
  Activity,
  Users,
  Info,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CandlestickChart,
} from "lucide-react";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import TradePanel from "@/components/launchpad/TradePanel";
import LaunchpadModeBanner from "@/components/launchpad/LaunchpadModeBanner";
import OnChainBalancesCard from "@/components/launchpad/OnChainBalancesCard";
import PriceChartCard from "@/components/launchpad/PriceChartCard";
import GraduationProgressBar from "@/components/launchpad/GraduationProgressBar";
import HoldersList from "@/components/launchpad/HoldersList";
import { Button } from "@/components/ui/button";
import { deriveLaunchPda, isLaunchpadOnChainEnabled, LAUNCHPAD_NETWORK } from "@/lib/launchpad-onchain";
import MintAddressChip from "@/components/launchpad/MintAddressChip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TRADER_VIEW_KEY = "rhoze-trader-view";

type Launch = {
  id: string;
  work_id: string;
  creator_id: string;
  ticker: string;
  name: string;
  description: string | null;
  image_url: string | null;
  status: string;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  total_supply: number;
  graduation_sol_target: number;
  creator_fee_bps: number;
  platform_fee_bps: number;
  creator_fees_earned: number;
  lp_lock_months: number;
  graduated_at: string | null;
  created_at: string;
  mint_address: string | null;
  raydium_pool: string | null;
  creator_payout_rhoze: number | null;
  holder_bonus_rhoze: number | null;
};

type Trade = {
  id: string;
  side: string;
  sol_amount: number;
  token_amount: number;
  fee_sol: number;
  price_per_token: number;
  created_at: string;
  trader_id: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LaunchDetailPage = () => {
  // Route may be `/launchpad/:id` (UUID) or `/coin/:slug` (ticker, case-insensitive).
  const params = useParams();
  const slugOrId = (params.id ?? params.slug ?? "").trim();
  const { user } = useAuth();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [vol24h, setVol24h] = useState<number>(0);
  const [holderCount, setHolderCount] = useState<number | null>(null);
  const [workSig, setWorkSig] = useState<string | null>(null);
  const [myHolding, setMyHolding] = useState<{ balance: number; sol_invested: number } | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [traderView, setTraderView] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(TRADER_VIEW_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TRADER_VIEW_KEY, traderView ? "1" : "0");
  }, [traderView]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slugOrId) return;
    let l: Launch | null = null;
    if (UUID_RE.test(slugOrId)) {
      const { data } = await supabase.from("coin_launches").select("*").eq("id", slugOrId).maybeSingle();
      l = (data as Launch | null) ?? null;
    } else {
      // Slug may be the full mint address (CA) or a ticker (with optional $).
      const cleaned = slugOrId.replace(/^\$/, "");
      // Try mint address first (case-sensitive base58).
      const { data: byMint } = await supabase
        .from("coin_launches")
        .select("*")
        .eq("mint_address", cleaned)
        .neq("status", "cancelled")
        .maybeSingle();
      if (byMint) {
        l = byMint as Launch;
      } else {
        const { data } = await supabase
          .from("coin_launches")
          .select("*")
          .ilike("ticker", cleaned)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        l = (data as Launch | null) ?? null;
      }
    }
    setLaunch(l);
    if (!l) {
      setLoading(false);
      return;
    }
    if (l.work_id) {
      const { data: w } = await supabase
        .from("works")
        .select("solana_signature")
        .eq("id", l.work_id)
        .maybeSingle();
      setWorkSig(w?.solana_signature ?? null);
    }
    const { data: t } = await supabase
      .from("coin_trades")
      .select("id,side,sol_amount,token_amount,fee_sol,price_per_token,created_at,trader_id")
      .eq("launch_id", l.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTrades((t ?? []) as Trade[]);

    // 24h SOL volume
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: vol } = await supabase
      .from("coin_trades")
      .select("sol_amount")
      .eq("launch_id", l.id)
      .gte("created_at", since);
    setVol24h((vol ?? []).reduce((s, r) => s + Number(r.sol_amount), 0));

    // Holder count (creator-only RLS — fall back gracefully)
    const { count } = await supabase
      .from("coin_holdings")
      .select("trader_id", { count: "exact", head: true })
      .eq("launch_id", l.id);
    setHolderCount(count ?? null);

    // My holding (RLS lets the user read their own row)
    if (user?.id) {
      const { data: mine } = await supabase
        .from("coin_holdings")
        .select("balance, sol_invested")
        .eq("launch_id", l.id)
        .eq("trader_id", user.id)
        .maybeSingle();
      setMyHolding(mine ? { balance: Number(mine.balance), sol_invested: Number(mine.sol_invested) } : null);
    } else {
      setMyHolding(null);
    }

    setLoading(false);
  }, [slugOrId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!launch) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl text-center space-y-4">
        <p className="text-muted-foreground">Coin not found.</p>
        <Button asChild variant="outline">
          <Link to="/discover">
            <ArrowLeft className="h-3 w-3 mr-1" /> Back to Discover
          </Link>
        </Button>
      </div>
    );
  }

  const isCreator = user?.id === launch.creator_id;
  const progress = Math.min(
    100,
    (Number(launch.real_sol_reserves) / Number(launch.graduation_sol_target)) * 100,
  );
  const price = Number(launch.virtual_sol_reserves) / Number(launch.virtual_token_reserves);
  const marketCap = price * Number(launch.total_supply);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <Link to={`/profiles/${launch.creator_id}`}>
          <ArrowLeft className="h-3 w-3" /> Back to creator
        </Link>
      </Button>

      {/* ── Header strip ─────────────────────────────────────── */}
      <Card className="bg-card/40 backdrop-blur">
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex items-start gap-4">
            {launch.image_url ? (
              <img
                src={launch.image_url}
                alt={launch.name}
                className="h-16 w-16 md:h-20 md:w-20 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-lg bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center shrink-0">
                <Coins className="h-7 w-7 text-emerald-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold">
                  {launch.name}
                  <span className="text-sm md:text-base text-muted-foreground font-mono ml-2 align-middle">
                    · ${launch.ticker}
                  </span>
                </h1>
                {launch.status === "graduated" && (
                  <Badge variant="secondary" className="gap-1">
                    <GraduationCap className="h-3 w-3" /> Graduated
                  </Badge>
                )}
                {launch.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                <VerifiedIPBadge signature={workSig} size="xs" />
                {launch.mint_address && <MintAddressChip address={launch.mint_address} size="xs" />}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {traderView ? "Bonding-curve drop · backed in $RHOZE" : "A drop you can back · denominated in $RHOZE"}
              </p>
            </div>

            {/* Trader view toggle — fans see Kickstarter labels, traders flip back to market data */}
            <button
              type="button"
              onClick={() => setTraderView((v) => !v)}
              className="shrink-0 text-[10px] uppercase tracking-wide rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 hover:border-foreground/40 hover:text-foreground transition-colors text-muted-foreground"
              title={traderView ? "Switch to fan view (recommended)" : "Switch to trader view"}
            >
              {traderView ? "Trader view" : "Fan view"}
            </button>
          </div>

          {/* Hero stats — Kickstarter-style by default. Trader view flips to
              market cap / P&L / price labels for power users. */}
          {(() => {
            const RHOZE_PER_SOL = 100;
            const priceRhoze = price * RHOZE_PER_SOL;
            const mcapRhoze = marketCap * RHOZE_PER_SOL;
            const fmt = (n: number) =>
              n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(2);
            const fmtTiny = (n: number) => {
              if (n >= 1) return n.toFixed(4);
              if (n >= 0.0001) return n.toFixed(6);
              return n.toPrecision(3);
            };
            const myValueRhoze = myHolding ? myHolding.balance * price * RHOZE_PER_SOL : 0;
            const myCostRhoze = myHolding ? myHolding.sol_invested * RHOZE_PER_SOL : 0;
            const pnlRhoze = myValueRhoze - myCostRhoze;
            const pnlPct = myCostRhoze > 0 ? (pnlRhoze / myCostRhoze) * 100 : 0;
            const hasPosition = !!myHolding && myHolding.balance > 0;
            const pnlPositive = pnlRhoze >= 0;

            // Fan-view labels
            const primaryLabel = traderView ? "Market cap" : "Total raised";
            const primaryValue = fmt(mcapRhoze);
            const positionLabel = traderView ? "Your P&L" : "Your support value";
            const peopleLabel = traderView ? "Holders" : "Backers";
            const priceLabel = traderView ? "Price" : "Per-unit (small)";

            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* Primary stat — Total raised / Market cap */}
                <div className="md:col-span-2 rounded-lg bg-gradient-to-br from-emerald-500/10 to-fuchsia-500/10 border border-border/50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    {!traderView && <Sparkles className="h-2.5 w-2.5" />}
                    {primaryLabel}
                  </div>
                  <div className="text-2xl md:text-3xl font-mono font-bold mt-0.5">
                    {primaryValue} <span className="text-sm text-muted-foreground">$RHOZE</span>
                  </div>
                  {!traderView && (
                    <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      Pooled support from fans backing this drop
                    </div>
                  )}
                </div>

                {/* Position — Support value (no red, no %) in fan view; full P&L in trader view */}
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {positionLabel}
                  </div>
                  {hasPosition ? (
                    traderView ? (
                      <div
                        className={cn(
                          "text-base font-mono font-semibold mt-0.5 flex items-center gap-1",
                          pnlPositive ? "text-emerald-500" : "text-rose-500",
                        )}
                      >
                        {pnlPositive ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {pnlPositive ? "+" : ""}
                        {fmt(Math.abs(pnlRhoze))}
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({pnlPositive ? "+" : ""}
                          {pnlPct.toFixed(1)}%)
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="text-base font-mono font-semibold mt-0.5">
                          {fmt(myValueRhoze)}{" "}
                          <span className="text-[10px] text-muted-foreground">$RHOZE</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          You backed {fmt(myCostRhoze)} $RHOZE
                        </div>
                      </>
                    )
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1">Not backing yet</div>
                  )}
                </div>

                {/* Backers / Holders */}
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {peopleLabel}
                  </div>
                  <div className="text-base font-mono font-semibold mt-0.5">
                    {holderCount === null ? "—" : holderCount.toLocaleString()}
                  </div>
                </div>

                {/* Price — only meaningful in trader view; collapsed in fan view */}
                {traderView ? (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="rounded-lg bg-muted/30 p-3 cursor-help">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            Price <Info className="h-2.5 w-2.5 opacity-60" />
                          </div>
                          <div className="text-base font-mono font-semibold mt-0.5">
                            {fmtTiny(priceRhoze)}
                            <span className="text-[10px] text-muted-foreground ml-1">$RHOZE</span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px] text-xs">
                        Price per token from the bonding curve. Market cap = price × total supply.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Status
                    </div>
                    <div className="text-base font-mono font-semibold mt-0.5 capitalize">
                      {launch.status}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Graduated payout summary */}
          {launch.status === "graduated" && launch.creator_payout_rhoze ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-500">
                <GraduationCap className="h-3.5 w-3.5" /> Goal reached
                {launch.graduated_at && (
                  <span className="text-muted-foreground font-normal">
                    · {new Date(launch.graduated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid to creator</div>
                  <div>{Number(launch.creator_payout_rhoze).toLocaleString(undefined, { maximumFractionDigits: 0 })} $RHOZE</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Bonus to backers</div>
                  <div>{Number(launch.holder_bonus_rhoze ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} $RHOZE</div>
                </div>
              </div>
            </div>
          ) : null}

          {isCreator && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <span className="text-emerald-500 font-semibold">Your earnings:</span>{" "}
              <span className="font-mono">{(Number(launch.creator_fees_earned) * 100).toFixed(2)} $RHOZE</span>
              <span className="text-muted-foreground">
                {" "}
                · {launch.creator_fee_bps / 100}% of every backing & withdrawal
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Main grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: chart + tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Chart toggle: collapsed by default. Backing momentum lives inline
              in the header progress bar — this section is purely the price
              chart for power users. */}
          <button
            type="button"
            onClick={() => setShowChart((v) => !v)}
            className="w-full flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card/40 backdrop-blur px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <CandlestickChart className="h-3.5 w-3.5" />
              {showChart ? "Hide price chart" : "Show price chart"}
            </span>
            {showChart ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showChart && <PriceChartCard launchId={launch.id} ticker={launch.ticker} />}

          <Card className="bg-card/40 backdrop-blur">
            <CardContent className="p-3">
              <Tabs defaultValue="trades">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="trades" className="gap-1.5 text-xs">
                    <Activity className="h-3 w-3" /> Trades
                  </TabsTrigger>
                  <TabsTrigger value="holders" className="gap-1.5 text-xs">
                    <Users className="h-3 w-3" /> Holders
                  </TabsTrigger>
                  <TabsTrigger value="about" className="gap-1.5 text-xs">
                    <Info className="h-3 w-3" /> About
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="trades" className="mt-3">
                  {trades.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">
                      No trades yet — be the first.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {trades.map((t) => (
                        <div
                          key={t.id}
                          className="grid grid-cols-4 items-center gap-2 text-xs font-mono py-1.5 px-1 border-b border-border/30 last:border-0"
                        >
                          <span
                            className={
                              t.side === "buy" ? "text-emerald-500" : "text-rose-500"
                            }
                          >
                            {t.side.toUpperCase()}
                          </span>
                          <span className="truncate">
                            {Number(t.token_amount).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}{" "}
                            ${launch.ticker}
                          </span>
                          <span className="text-muted-foreground text-right">
                            {(Number(t.sol_amount) * 100).toFixed(2)} $RHOZE
                          </span>
                          <span className="text-muted-foreground text-[10px] text-right">
                            {new Date(t.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="holders" className="mt-3">
                  <HoldersList
                    launchId={launch.id}
                    totalSupply={Number(launch.total_supply)}
                    isCreator={isCreator}
                    ticker={launch.ticker}
                  />
                </TabsContent>

                <TabsContent value="about" className="mt-3 space-y-2 text-sm">
                  {launch.description ? (
                    <p className="leading-relaxed">{launch.description}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No description provided.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <Stat
                      label="Total supply"
                      value={Number(launch.total_supply).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    />
                    <Stat
                      label="In curve"
                      value={Number(launch.real_token_reserves).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    />
                    <Stat label="Creator fee" value={`${launch.creator_fee_bps / 100}%`} />
                    <Stat label="Platform fee" value={`${launch.platform_fee_bps / 100}%`} />
                  </div>
                  <Link
                    to={`/settings#provenance`}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground pt-1"
                  >
                    View underlying Verified IP <ExternalLink className="h-3 w-3" />
                  </Link>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: trade panel. The on-chain address + balance cards are
            hidden in simulation mode — the only Solana detail users care
            about is the CA chip in the header (links out when on-chain). */}
        <div className="space-y-4">
          <LaunchpadModeBanner />
          <TradePanel
            launchId={launch.id}
            ticker={launch.ticker}
            status={launch.status}
            virtualSol={Number(launch.virtual_sol_reserves)}
            virtualToken={Number(launch.virtual_token_reserves)}
            creatorFeeBps={Number(launch.creator_fee_bps)}
            platformFeeBps={Number(launch.platform_fee_bps)}
            onTraded={load}
          />
          {isLaunchpadOnChainEnabled() && (
            <>
              <OnChainAddressesCard
                mint={launch.mint_address}
                launchPda={deriveLaunchPda(launch.id)?.toBase58() ?? null}
                raydiumPool={launch.raydium_pool}
              />
              <OnChainBalancesCard
                workId={launch.id}
                ticker={launch.ticker}
                mint={launch.mint_address}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) => (
  <div className="rounded-md bg-muted/30 p-2.5">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
      {icon}
      {label}
    </div>
    <div className="text-sm font-mono font-semibold mt-0.5 truncate">{value}</div>
  </div>
);

const solscanCluster = LAUNCHPAD_NETWORK === "devnet" ? "?cluster=devnet" : "";

const AddressRow = ({
  label,
  address,
  kind,
}: {
  label: string;
  address: string;
  kind: "account" | "token";
}) => {
  const url = `https://solscan.io/${kind}/${address}${solscanCluster}`;
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(address);
    toast.success(`${label} copied`);
  };
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1 min-w-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs truncate hover:text-emerald-500 transition-colors"
          title={address}
        >
          {address.slice(0, 6)}…{address.slice(-6)}
        </a>
        <button
          onClick={copy}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3 w-3" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={`Open ${label} on Solscan`}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};

const OnChainAddressesCard = ({
  mint,
  launchPda,
  raydiumPool,
}: {
  mint: string | null;
  launchPda: string | null;
  raydiumPool: string | null;
}) => {
  const onChain = isLaunchpadOnChainEnabled();
  const hasAny = mint || launchPda || raydiumPool;
  return (
    <Card className="bg-card/40 backdrop-blur">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold">
            {onChain ? "On-chain addresses" : "Contract address"}
          </h2>
          <Badge variant="outline" className="text-[10px] font-mono">
            {onChain ? (LAUNCHPAD_NETWORK === "devnet" ? "Devnet" : "Mainnet") : "Simulated"}
          </Badge>
        </div>
        {!hasAny ? (
          <p className="text-xs text-muted-foreground py-2">
            No address yet.
          </p>
        ) : (
          <>
            {mint && (
              onChain
                ? <AddressRow label="Mint" address={mint} kind="token" />
                : <SimulatedAddressRow label="Mint (CA)" address={mint} />
            )}
            {onChain && launchPda && <AddressRow label="Launch PDA" address={launchPda} kind="account" />}
            {onChain && raydiumPool && (
              <AddressRow label="Raydium pool" address={raydiumPool} kind="account" />
            )}
            {!onChain && (
              <p className="text-[10px] text-muted-foreground pt-2 leading-relaxed">
                Vanity address ending in <span className="font-mono">RHOZE</span>. Trades are
                simulated against the bonding curve and stay on the platform. When the on-chain
                program ships, holdings migrate 1:1 and this becomes a real Solana mint.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const SimulatedAddressRow = ({ label, address }: { label: string; address: string }) => {
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(address);
    toast.success(`${label} copied`);
  };
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-mono text-xs truncate" title={address}>
          {address.slice(0, 6)}…{address.slice(-8)}
        </span>
        <button
          onClick={copy}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default LaunchDetailPage;
