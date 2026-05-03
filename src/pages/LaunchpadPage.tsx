/**
 * LaunchpadPage — `/launchpad`
 *
 * Browser of every artist coin launched on Rhozeland. Step 4a is read-only
 * for non-creators (anyone can browse and trade); only Verified-IP work
 * owners can press "Launch a coin" from the work itself.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, Flame, GraduationCap, TrendingUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LaunchpadModeBanner from "@/components/launchpad/LaunchpadModeBanner";
import LaunchpadEarnPanel from "@/components/launchpad/LaunchpadEarnPanel";
import MintAddressChip from "@/components/launchpad/MintAddressChip";
import { isLaunchpadOnChainEnabled } from "@/lib/launchpad-onchain";

type Launch = {
  id: string;
  ticker: string;
  name: string;
  description: string | null;
  image_url: string | null;
  status: string;
  real_sol_reserves: number;
  graduation_sol_target: number;
  creator_id: string;
  created_at: string;
  mint_address: string | null;
};

const useLaunches = (status: "live" | "graduated") => {
  const [rows, setRows] = useState<Launch[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("coin_launches")
      .select("id,ticker,name,description,image_url,status,real_sol_reserves,graduation_sol_target,creator_id,created_at,mint_address")
      .eq("status", status)
      .order(status === "live" ? "real_sol_reserves" : "graduated_at", { ascending: false })
      .limit(60)
      .then(({ data }) => { if (!cancelled) setRows((data ?? []) as Launch[]); });
    return () => { cancelled = true; };
  }, [status]);

  return rows;
};

const LaunchCard = ({ l }: { l: Launch }) => {
  const progress = Math.min(100, (Number(l.real_sol_reserves) / Number(l.graduation_sol_target)) * 100);
  return (
    <Link to={`/launchpad/${l.id}`} className="group">
      <Card className="overflow-hidden hover:border-primary/40 transition-colors h-full bg-card/40 backdrop-blur">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            {l.image_url ? (
              <img src={l.image_url} alt={l.name} className="h-12 w-12 rounded-md object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-md bg-gradient-to-br from-emerald-500/30 to-fuchsia-500/30 flex items-center justify-center">
                <Coins className="h-5 w-5 text-emerald-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold">${l.ticker}</span>
                {l.status === "graduated" && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] gap-0.5">
                    <GraduationCap className="h-2.5 w-2.5" /> Grad
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{l.name}</p>
            </div>
          </div>

          {l.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">{l.description}</p>
          )}

          {l.mint_address && <MintAddressChip address={l.mint_address} size="xs" />}

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{Number(l.real_sol_reserves).toFixed(2)} $RHOZE raised</span>
                <span>{Number(l.graduation_sol_target).toFixed(2)} $RHOZE goal</span>
              </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-fuchsia-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const LaunchpadPage = () => {
  const live = useLaunches("live");
  const graduated = useLaunches("graduated");

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6 text-emerald-500" />
          <h1 className="text-3xl font-bold tracking-tight">Launchpad</h1>
          <Badge variant="outline" className="ml-2 text-[10px]">
            {isLaunchpadOnChainEnabled() ? "On-chain · Devnet" : "Beta · Simulated"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Coins minted by artists, gated to <strong>Verified IP</strong> works only.
          Trade on a bonding curve until graduation, then liquidity migrates to
          Raydium with creator-locked LP.
        </p>
        <LaunchpadModeBanner />
      </header>

      <LaunchpadEarnPanel />

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live" className="gap-1.5"><Flame className="h-3.5 w-3.5" /> Live</TabsTrigger>
          <TabsTrigger value="graduated" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Graduated</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-6">
          <Grid rows={live} emptyHint="No live coins yet. Verify a Work and press 'Launch a coin' to seed the curve." />
        </TabsContent>
        <TabsContent value="graduated" className="mt-6">
          <Grid rows={graduated} emptyHint="No coins have graduated yet." />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Grid = ({ rows, emptyHint }: { rows: Launch[] | null; emptyHint: string }) => {
  if (rows === null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-12 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{emptyHint}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rows.map((l) => <LaunchCard key={l.id} l={l} />)}
    </div>
  );
};

export default LaunchpadPage;
