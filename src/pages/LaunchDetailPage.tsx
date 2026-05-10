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
import {
  Coins,
  GraduationCap,
  Lock,
  ExternalLink,
  ArrowLeft,
  Copy,
  Activity,
  Users,
  Info,
} from "lucide-react";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import TradePanel from "@/components/launchpad/TradePanel";
import LaunchpadModeBanner from "@/components/launchpad/LaunchpadModeBanner";
import OnChainBalancesCard from "@/components/launchpad/OnChainBalancesCard";
import PriceChartCard from "@/components/launchpad/PriceChartCard";
import HoldersList from "@/components/launchpad/HoldersList";
import { Button } from "@/components/ui/button";
import { deriveLaunchPda, isLaunchpadOnChainEnabled, LAUNCHPAD_NETWORK } from "@/lib/launchpad-onchain";
import MintAddressChip from "@/components/launchpad/MintAddressChip";
import { toast } from "sonner";

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

    setLoading(false);
  }, [slugOrId]);

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
                <h1 className="text-xl md:text-2xl font-bold font-mono">${launch.ticker}</h1>
                {launch.status === "graduated" && (
                  <Badge variant="secondary" className="gap-1">
                    <GraduationCap className="h-3 w-3" /> Graduated
                  </Badge>
                )}
                {launch.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                <VerifiedIPBadge signature={workSig} size="xs" />
                {launch.mint_address && <MintAddressChip address={launch.mint_address} size="xs" />}
              </div>
              <p className="text-sm text-muted-foreground truncate">{launch.name}</p>
            </div>
          </div>

          {/* Quick stats — prices are shown in $RHOZE. Reserve/graduation values
              are already stored in the same simulated in-app units, so they
              must never be multiplied by an extra conversion factor. */}
          {(() => {
            const RHOZE_PER_SOL = 100;
            const priceRhoze = price * RHOZE_PER_SOL;
            const mcapRhoze = marketCap * RHOZE_PER_SOL;
            const vol24Rhoze = vol24h * RHOZE_PER_SOL;
            const targetRaised = Number(launch.graduation_sol_target);
            const currentRaised = Number(launch.real_sol_reserves);
            const fmt = (n: number) =>
              n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(2);
            const fmtTiny = (n: number) => {
              if (n >= 1) return n.toFixed(4);
              if (n >= 0.0001) return n.toFixed(6);
              return n.toPrecision(3);
            };
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Stat label="Price" value={`${fmtTiny(priceRhoze)} $RHOZE`} />
                  <Stat label="Market cap" value={`${fmt(mcapRhoze)} $RHOZE`} />
                  <Stat label="24h volume" value={`${fmt(vol24Rhoze)} $RHOZE`} />
                  <Stat
                    label="Holders"
                    value={holderCount === null ? "—" : holderCount.toLocaleString()}
                  />
                  <Stat label="LP lock" value={`${launch.lp_lock_months}mo`} icon={<Lock className="h-3 w-3" />} />
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>
                      {fmt(currentRaised)} / {fmt(targetRaised)} $RHOZE raised
                    </span>
                    <span>{progress.toFixed(1)}% to graduation</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </>
            );
          })()}

          {isCreator && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <span className="text-emerald-500 font-semibold">Your earnings:</span>{" "}
              <span className="font-mono">{(Number(launch.creator_fees_earned) * 100).toFixed(2)} $RHOZE</span>
              <span className="text-muted-foreground">
                {" "}
                · {launch.creator_fee_bps / 100}% of every trade
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Main grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: chart + tabs */}
        <div className="lg:col-span-2 space-y-4">
          <PriceChartCard launchId={launch.id} ticker={launch.ticker} />

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
