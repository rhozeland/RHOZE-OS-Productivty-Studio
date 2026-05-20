/**
 * CreatorEarningsTab — MRR, active subs, churn, and earnings summary
 * for the signed-in creator. Reads creator_subscriptions filtered by
 * creator_id = current user (RLS already enforces this).
 *
 * Notes
 *  • MRR = sum(monthly_price_usd) where status='active'
 *  • Creator share = 85% (Rhozeland keeps 15%)
 *  • Churn (30d) = canceled_at within the last 30d
 *  • We don't have an invoice ledger yet, so "earnings to date" is an
 *    estimate based on each active sub's months-since-start * price * 0.85.
 *    Surfaced as "Estimated" so creators don't mistake it for booked revenue.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, TrendingDown, DollarSign, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

const CREATOR_SHARE = 0.85;

type Sub = {
  id: string;
  subscriber_id: string;
  tier: "basic" | "standard" | "premium";
  status: string;
  monthly_price_usd: number;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 });

const CreatorEarningsTab = ({ userId }: { userId: string }) => {
  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["creator-earnings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_subscriptions")
        .select("id, subscriber_id, tier, status, monthly_price_usd, current_period_start, current_period_end, canceled_at, created_at")
        .eq("creator_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sub[];
    },
  });

  const active = subs.filter((s) => s.status === "active");
  const canceled = subs.filter((s) => s.status === "canceled");
  const now = Date.now();
  const THIRTY = 30 * 24 * 60 * 60 * 1000;
  const canceledLast30 = canceled.filter((s) => s.canceled_at && now - new Date(s.canceled_at).getTime() < THIRTY);
  const activeAt30dAgo = subs.filter((s) => {
    const startedBefore = new Date(s.created_at).getTime() < now - THIRTY;
    const stillActiveOr30d = s.status === "active" || (s.canceled_at && new Date(s.canceled_at).getTime() > now - THIRTY);
    return startedBefore && stillActiveOr30d;
  }).length;

  const mrrGross = active.reduce((s, x) => s + (x.monthly_price_usd ?? 0), 0);
  const mrrNet = mrrGross * CREATOR_SHARE;
  const arrNet = mrrNet * 12;
  const churnPct = activeAt30dAgo > 0 ? (canceledLast30.length / activeAt30dAgo) * 100 : 0;

  // Estimated lifetime earnings (gross → net 85%)
  const estLifetimeNet = subs.reduce((acc, s) => {
    if (s.status === "pending") return acc;
    const start = new Date(s.created_at).getTime();
    const end = s.status === "canceled" && s.canceled_at ? new Date(s.canceled_at).getTime() : now;
    const months = Math.max(1, Math.round((end - start) / (30 * 24 * 60 * 60 * 1000)));
    return acc + months * (s.monthly_price_usd ?? 0) * CREATOR_SHARE;
  }, 0);

  const tierBreakdown = (["basic", "standard", "premium"] as const).map((t) => ({
    tier: t,
    count: active.filter((s) => s.tier === t).length,
    mrr: active.filter((s) => s.tier === t).reduce((s, x) => s + x.monthly_price_usd, 0),
  }));

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="font-display text-xl font-bold text-foreground">Subscription earnings</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          You keep <span className="font-semibold text-foreground">85%</span> of every fan subscription.
          Rhozeland covers payment processing, hosting, and discovery with the remaining 15%.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="MRR (your share)"
          value={fmtUsd(mrrNet)}
          sub={`${fmtUsd(mrrGross)} gross`}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Projected annual"
          value={fmtUsd(arrNet)}
          sub="At today's MRR · your 85%"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Active subscribers"
          value={active.length.toLocaleString()}
          sub={`${subs.length} all-time`}
        />
        <KpiCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Churn (30d)"
          value={`${churnPct.toFixed(1)}%`}
          sub={`${canceledLast30.length} canceled`}
          tone={churnPct > 10 ? "warn" : "ok"}
        />
      </div>

      {/* Tier breakdown */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-foreground">By tier</h3>
          <Badge variant="outline" className="text-[10px]">Active only</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {tierBreakdown.map((row) => (
            <div key={row.tier} className="rounded-xl border border-border/50 bg-card/40 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{row.tier}</p>
              <p className="font-display text-2xl font-bold text-foreground mt-1">{row.count}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {fmtUsd(row.mrr * CREATOR_SHARE)}/mo · {fmtUsd(row.mrr)} gross
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Estimated lifetime */}
      <Card className="p-5 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="font-display text-base font-semibold text-foreground">
            Estimated earnings to date · {fmtUsd(estLifetimeNet)}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Estimate based on each subscription's months-active × price × 85%. Booked revenue from Stripe
            invoices will replace this number once invoice sync is wired up.
          </p>
        </div>
      </Card>

      {/* Recent subscribers */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-foreground">Recent subscribers</h3>
          <span className="text-xs text-muted-foreground">{subs.length} total</span>
        </div>
        {subs.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No subscribers yet. Share your profile to start earning.
            <div className="mt-3">
              <Link to="/profile" className="text-primary hover:underline">View your profile →</Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {subs.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge
                    variant="outline"
                    className="capitalize text-[10px] shrink-0"
                  >{s.tier}</Badge>
                  <span className="text-muted-foreground truncate">
                    {s.subscriber_id.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-foreground font-medium">{fmtUsd(s.monthly_price_usd)}/mo</span>
                  <StatusBadge status={s.status} />
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

const KpiCard = ({
  icon, label, value, sub, tone = "default",
}: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "default" | "ok" | "warn" }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-xs uppercase tracking-wider">{label}</span>
    </div>
    <p className={`font-display text-3xl font-bold mt-2 ${tone === "warn" ? "text-destructive" : "text-foreground"}`}>
      {value}
    </p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    canceled: "bg-muted text-muted-foreground border-border",
    past_due: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    pending: "bg-muted text-muted-foreground border-border",
    expired: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${map[status] ?? ""}`}>
      {status.replace("_", " ")}
    </Badge>
  );
};

export default CreatorEarningsTab;
