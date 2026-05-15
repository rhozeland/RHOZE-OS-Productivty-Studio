/**
 * GraduationProgressBar — slim header strip combining graduation progress
 * with a backing-momentum sparkline. Replaces the bulky standalone
 * BackingMomentumChart inside the launch header.
 *
 * Layout: [label · raised / target · % · 24h delta]
 *         [════════ progress bar with sparkline overlay ════════]
 */
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, TrendingUp, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const RHOZE_PER_SOL = 100;

type TradeRow = {
  id: string;
  side: "buy" | "sell";
  sol_amount: number | string;
  trader_id: string;
  created_at: string;
};

const fmt = (n: number) =>
  n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(0);

interface Props {
  launchId: string;
  /** Cumulative $RHOZE backed (= real_sol_reserves * 100). Pre-loaded from launch row. */
  raisedRhoze: number;
  /** Graduation target in $RHOZE (= graduation_sol_target * 100). */
  targetRhoze: number;
  /** "live" / "graduated" / "cancelled" — shown as label suffix when graduated. */
  status: string;
  className?: string;
}

const GraduationProgressBar = ({ launchId, raisedRhoze, targetRhoze, status, className }: Props) => {
  const qc = useQueryClient();

  const { data: trades } = useQuery({
    queryKey: ["graduation-spark-trades", launchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_trades")
        .select("id, side, sol_amount, trader_id, created_at")
        .eq("launch_id", launchId)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as TradeRow[];
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`graduation-spark:${launchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coin_trades", filter: `launch_id=eq.${launchId}` },
        () => qc.invalidateQueries({ queryKey: ["graduation-spark-trades", launchId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [launchId, qc]);

  const { sparkPath, last24hDelta, backers } = useMemo(() => {
    if (!trades?.length) return { sparkPath: "", last24hDelta: 0, backers: 0 };
    let cum = 0;
    const seen = new Set<string>();
    const points: Array<{ t: number; v: number }> = [];
    for (const t of trades) {
      if (t.side === "buy") {
        cum += Number(t.sol_amount) * RHOZE_PER_SOL;
        seen.add(t.trader_id);
      }
      points.push({ t: new Date(t.created_at).getTime(), v: cum });
    }
    if (points.length < 2) return { sparkPath: "", last24hDelta: cum, backers: seen.size };

    const t0 = points[0].t;
    const tN = points[points.length - 1].t;
    const tSpan = Math.max(tN - t0, 1);
    const maxV = Math.max(...points.map((p) => p.v), 1);
    // Normalize to a 100×24 viewBox
    const path = points
      .map((p, i) => {
        const x = ((p.t - t0) / tSpan) * 100;
        const y = 24 - (p.v / maxV) * 22;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    const cutoff = Date.now() - 24 * 3600_000;
    const before = [...points].reverse().find((p) => p.t < cutoff);
    return { sparkPath: path, last24hDelta: cum - (before?.v ?? 0), backers: seen.size };
  }, [trades]);

  const pct = Math.min(100, (raisedRhoze / Math.max(targetRhoze, 1)) * 100);
  const graduated = status === "graduated";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide">
        <span className="flex items-center gap-1 text-muted-foreground">
          {graduated ? <GraduationCap className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {graduated ? "Graduated" : "Backing momentum"}
          <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
            · {backers} {backers === 1 ? "backer" : "backers"}
          </span>
        </span>
        <span className="flex items-center gap-2 font-mono">
          {last24hDelta > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 normal-case tracking-normal">
              <TrendingUp className="h-2.5 w-2.5" />+{fmt(last24hDelta)} 24h
            </span>
          )}
          <span className="text-foreground">
            {fmt(raisedRhoze)}{" "}
            <span className="text-muted-foreground">/ {fmt(targetRhoze)} $RHOZE</span>
          </span>
          <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
        </span>
      </div>

      {/* Bar with sparkline overlaid */}
      <div className="relative h-6 w-full overflow-hidden rounded-full border border-border/60 bg-muted/30">
        {/* Filled progress */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/70 via-emerald-500/60 to-fuchsia-500/60 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* Sparkline overlay across the full bar */}
        {sparkPath && (
          <svg
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`spark-fill-${launchId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.22" />
                <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${sparkPath} L 100 24 L 0 24 Z`}
              fill={`url(#spark-fill-${launchId})`}
            />
            <path
              d={sparkPath}
              fill="none"
              stroke="hsl(var(--foreground))"
              strokeOpacity="0.55"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {/* Graduation marker pip at 100% */}
        <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
          <GraduationCap
            className={cn(
              "h-3 w-3 transition-colors",
              graduated || pct >= 100 ? "text-emerald-500" : "text-muted-foreground/60",
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default GraduationProgressBar;
