/**
 * ConciergeProgramDashboard — Phase 5
 *
 * Admin-only operations dashboard for the Concierge SKU. Shows the
 * intake → conversion funnel, headline economics, conversion velocity,
 * and the top curators driving converted briefs.
 *
 * Mounts at the top of /admin?tab=concierge above <AdminConciergeRequests>.
 *
 * Data sources:
 *   - public.concierge_requests  (full funnel; admin RLS allows read-all)
 *   - public.projects             (intake_tier='concierge' for billed totals)
 *   - public.profiles             (curator display names)
 *
 * Notes:
 *   - Platform fee is a flat 25% for Concierge projects (see convert_
 *     concierge_request RPC). Estimated fees = 25% of converted gross
 *     billed.
 *   - "Time to scope" averages (scoped_at_proxy - created_at) — we don't
 *     store a dedicated scoped_at column yet, so we approximate using
 *     updated_at for rows currently in scoped/converted status.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Inbox,
  Search,
  ClipboardList,
  CheckCircle2,
  XCircle,
  DollarSign,
  TrendingUp,
  Timer,
  Trophy,
} from "lucide-react";
import { formatDistanceStrict } from "date-fns";

type Status =
  | "new"
  | "reviewing"
  | "scoped"
  | "converted"
  | "declined"
  | "closed";

const STATUS_ORDER: Status[] = [
  "new",
  "reviewing",
  "scoped",
  "converted",
  "declined",
];

const STATUS_META: Record<
  Status,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  new: { label: "New", icon: Inbox },
  reviewing: { label: "Reviewing", icon: Search },
  scoped: { label: "Scoped", icon: ClipboardList },
  converted: { label: "Converted", icon: CheckCircle2 },
  declined: { label: "Declined", icon: XCircle },
  closed: { label: "Closed", icon: XCircle },
};

const FEE_BPS = 2500; // flat 25% Concierge platform fee

export default function ConciergeProgramDashboard() {
  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ["concierge-program-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concierge_requests")
        .select("id, status, created_at, updated_at, curator_id, scoped_budget_cents, converted_project_id");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["concierge-program-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, total_budget, curator_id, created_at")
        .eq("intake_tier", "concierge");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const curatorIds = useMemo(() => {
    const set = new Set<string>();
    (requests ?? []).forEach((r) => r.curator_id && set.add(r.curator_id));
    (projects ?? []).forEach((p) => p.curator_id && set.add(p.curator_id));
    return Array.from(set);
  }, [requests, projects]);

  const { data: curatorProfiles } = useQuery({
    queryKey: ["concierge-program-curators", curatorIds.sort().join(",")],
    enabled: curatorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", curatorIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const stats = useMemo(() => {
    const rs = requests ?? [];
    const ps = projects ?? [];
    const counts = STATUS_ORDER.reduce<Record<Status, number>>(
      (acc, s) => ((acc[s] = 0), acc),
      {} as any,
    );
    rs.forEach((r) => {
      if (counts[r.status as Status] != null) counts[r.status as Status]++;
    });
    const total = rs.length;
    const converted = counts.converted;
    const declined = counts.declined;
    const decided = converted + declined;
    const conversionRate = decided > 0 ? converted / decided : 0;

    // Gross billed = sum of total_budget across converted projects.
    const grossBilled = ps.reduce(
      (s, p) => s + (Number(p.total_budget) || 0),
      0,
    );
    const estimatedFees = (grossBilled * FEE_BPS) / 10000;
    const avgProject = ps.length > 0 ? grossBilled / ps.length : 0;

    // Approx time-to-scope: avg(updated_at - created_at) for rows that
    // have already moved past 'new'. Reasonable proxy until we add a
    // dedicated scoped_at column.
    const moved = rs.filter((r) => r.status !== "new" && r.updated_at);
    const avgScopeMs =
      moved.length > 0
        ? moved.reduce(
            (s, r) =>
              s +
              (new Date(r.updated_at).getTime() -
                new Date(r.created_at).getTime()),
            0,
          ) / moved.length
        : 0;

    return {
      counts,
      total,
      conversionRate,
      grossBilled,
      estimatedFees,
      avgProject,
      avgScopeMs,
      convertedCount: ps.length,
    };
  }, [requests, projects]);

  const topCurators = useMemo(() => {
    const ps = projects ?? [];
    const byCurator = new Map<
      string,
      { converted: number; gross: number }
    >();
    ps.forEach((p) => {
      if (!p.curator_id) return;
      const entry = byCurator.get(p.curator_id) ?? { converted: 0, gross: 0 };
      entry.converted += 1;
      entry.gross += Number(p.total_budget) || 0;
      byCurator.set(p.curator_id, entry);
    });
    const arr = Array.from(byCurator.entries()).map(([cid, v]) => {
      const profile = (curatorProfiles ?? []).find(
        (p: any) => p.user_id === cid,
      );
      return {
        curator_id: cid,
        name:
          profile?.display_name ||
          profile?.username ||
          cid.slice(0, 6) + "…",
        ...v,
      };
    });
    arr.sort((a, b) => b.gross - a.gross);
    return arr.slice(0, 5);
  }, [projects, curatorProfiles]);

  if (loadingRequests) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading Concierge program metrics…
        </CardContent>
      </Card>
    );
  }

  if ((requests ?? []).length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-foreground" />
            <h3 className="font-display text-sm font-semibold">
              Concierge program
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            No briefs yet. Once intake starts flowing through the SupportSheet
            "Work together" tab or the public /concierge page, funnel
            economics will land here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const fmtUsd = (n: number) =>
    (n / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  // total_budget is already USD (numeric), not cents — divide differently for
  // grossBilled. Detect by checking magnitude: if value < 100k assume USD.
  const fmtUsdRaw = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-foreground" />
              <h3 className="font-display text-base font-semibold">
                Concierge program
              </h3>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                25% fee · live
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {stats.total} brief{stats.total === 1 ? "" : "s"} all-time
            </span>
          </div>

          {/* Headline KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Gross billed"
              value={fmtUsdRaw(stats.grossBilled)}
              sub={`${stats.convertedCount} project${stats.convertedCount === 1 ? "" : "s"}`}
            />
            <Kpi
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Est. fees (25%)"
              value={fmtUsdRaw(stats.estimatedFees)}
              sub="locked at conversion"
            />
            <Kpi
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label="Conversion"
              value={`${Math.round(stats.conversionRate * 100)}%`}
              sub={`${stats.counts.converted} won · ${stats.counts.declined} lost`}
            />
            <Kpi
              icon={<Timer className="h-3.5 w-3.5" />}
              label="Avg time to scope"
              value={
                stats.avgScopeMs > 0
                  ? formatDistanceStrict(0, stats.avgScopeMs)
                  : "—"
              }
              sub="created → first action"
            />
          </div>

          {/* Funnel */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Pipeline
            </p>
            <div className="grid grid-cols-5 gap-2">
              {STATUS_ORDER.map((s) => {
                const Icon = STATUS_META[s].icon;
                const count = stats.counts[s];
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div
                    key={s}
                    className="rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Icon className="h-3 w-3" />
                      <span className="text-[10px] uppercase tracking-widest">
                        {STATUS_META[s].label}
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-foreground leading-none">
                      {count}
                    </p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-foreground/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Avg project size */}
          {stats.convertedCount > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Average converted project size:{" "}
              <span className="text-foreground font-medium">
                {fmtUsdRaw(stats.avgProject)}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top curators */}
      {topCurators.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-3.5 w-3.5 text-amber-600" />
              <h3 className="font-display text-sm font-semibold">
                Top curators by gross billed
              </h3>
            </div>
            <div className="space-y-1.5">
              {topCurators.map((c, i) => (
                <div
                  key={c.curator_id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground w-4">
                      #{i + 1}
                    </span>
                    <span className="text-foreground truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">
                      {c.converted} project{c.converted === 1 ? "" : "s"}
                    </span>
                    <span className="text-foreground font-medium">
                      {fmtUsdRaw(c.gross)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-lg font-semibold text-foreground leading-tight">
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
      )}
    </div>
  );
}
