/**
 * LaunchDetailPage — `/launchpad/:id`
 *
 * Single-coin trading view: hero, bonding-curve progress, trade panel,
 * recent trades, and (for the creator) a fees-earned readout.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, GraduationCap, Lock, ExternalLink, Loader2, ArrowLeft } from "lucide-react";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import TradePanel from "@/components/launchpad/TradePanel";
import { Button } from "@/components/ui/button";

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

const LaunchDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [workSig, setWorkSig] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: l } = await supabase.from("coin_launches").select("*").eq("id", id).maybeSingle();
    setLaunch(l as Launch | null);
    if (l?.work_id) {
      const { data: w } = await supabase.from("works").select("solana_signature").eq("id", l.work_id).maybeSingle();
      setWorkSig(w?.solana_signature ?? null);
    }
    const { data: t } = await supabase
      .from("coin_trades")
      .select("id,side,sol_amount,token_amount,fee_sol,price_per_token,created_at,trader_id")
      .eq("launch_id", id)
      .order("created_at", { ascending: false })
      .limit(25);
    setTrades((t ?? []) as Trade[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="container mx-auto px-4 py-8 max-w-5xl"><Skeleton className="h-96" /></div>;
  }
  if (!launch) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl text-center space-y-4">
        <p className="text-muted-foreground">Coin not found.</p>
        <Button asChild variant="outline"><Link to="/launchpad"><ArrowLeft className="h-3 w-3 mr-1" /> Back to Launchpad</Link></Button>
      </div>
    );
  }

  const isCreator = user?.id === launch.creator_id;
  const progress = Math.min(100, (Number(launch.real_sol_reserves) / Number(launch.graduation_sol_target)) * 100);
  const price = Number(launch.virtual_sol_reserves) / Number(launch.virtual_token_reserves);
  const marketCap = price * Number(launch.total_supply);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <Link to="/launchpad"><ArrowLeft className="h-3 w-3" /> Launchpad</Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hero / metadata */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card/40 backdrop-blur">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                {launch.image_url ? (
                  <img src={launch.image_url} alt={launch.name} className="h-20 w-20 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center">
                    <Coins className="h-8 w-8 text-emerald-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold font-mono">${launch.ticker}</h1>
                    {launch.status === "graduated" && (
                      <Badge variant="secondary" className="gap-1"><GraduationCap className="h-3 w-3" /> Graduated</Badge>
                    )}
                    {launch.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                    <VerifiedIPBadge signature={workSig} size="xs" />
                  </div>
                  <p className="text-muted-foreground">{launch.name}</p>
                  {launch.description && <p className="text-sm mt-2">{launch.description}</p>}
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span>{Number(launch.real_sol_reserves).toFixed(3)} / {launch.graduation_sol_target} SOL</span>
                  <span>{progress.toFixed(1)}% to graduation</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <Stat label="Price" value={`${price.toExponential(2)} SOL`} />
                <Stat label="Market cap" value={`${marketCap.toFixed(2)} SOL`} />
                <Stat label="In curve" value={Number(launch.real_token_reserves).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                <Stat label="LP lock" value={`${launch.lp_lock_months}mo`} icon={<Lock className="h-3 w-3" />} />
              </div>

              {isCreator && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                  <span className="text-emerald-500 font-semibold">Your earnings:</span>{" "}
                  <span className="font-mono">{Number(launch.creator_fees_earned).toFixed(6)} SOL</span>
                  <span className="text-muted-foreground"> · {launch.creator_fee_bps / 100}% of every trade</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent trades */}
          <Card className="bg-card/40 backdrop-blur">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3">Recent trades</h2>
              {trades.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No trades yet — be the first.</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {trades.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs font-mono py-1.5 border-b border-border/30 last:border-0">
                      <span className={t.side === "buy" ? "text-emerald-500" : "text-rose-500"}>
                        {t.side.toUpperCase()}
                      </span>
                      <span>{Number(t.token_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${launch.ticker}</span>
                      <span className="text-muted-foreground">{Number(t.sol_amount).toFixed(4)} SOL</span>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trade panel */}
        <div className="space-y-4">
          <TradePanel
            launchId={launch.id}
            ticker={launch.ticker}
            status={launch.status}
            virtualSol={Number(launch.virtual_sol_reserves)}
            virtualToken={Number(launch.virtual_token_reserves)}
            onTraded={load}
          />

          <Link
            to={`/settings#provenance`}
            className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            View underlying Verified IP <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="rounded-md bg-muted/30 p-2.5">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{icon}{label}</div>
    <div className="text-sm font-mono font-semibold mt-0.5 truncate">{value}</div>
  </div>
);

export default LaunchDetailPage;
