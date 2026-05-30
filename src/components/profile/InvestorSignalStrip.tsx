/**
 * InvestorSignalStrip — compact, header-anchored version of the old
 * `CreatorReadinessCard`. Renders a single horizontal row with the
 * readiness score on the left and four inline stat chips on the right,
 * plus a tiny "Verify" CTA when the viewer is the owner.
 *
 * Same data shape as `CreatorReadinessCard`; just visually condensed
 * to ~64 px so it can sit right under the profile hero.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Sparkles, Activity, Clock, Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  creatorId: string;          // profiles.user_id
  memberSince?: string | null;
  isOwnProfile?: boolean;
}

interface Signals {
  verifiedWorks: number;
  totalWorks: number;
  eventsHosted: number;
  contributions: number;
  flowPosts30d: number;
}

const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

const InvestorSignalStrip = ({ creatorId, memberSince, isOwnProfile }: Props) => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<Signals>({
    queryKey: ["investor-signal-strip", creatorId],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [worksRes, verifiedRes, eventsRes, contribRes, flowRes] = await Promise.all([
        supabase.from("works").select("id", { count: "exact", head: true }).eq("user_id", creatorId),
        supabase.from("works").select("id", { count: "exact", head: true }).eq("user_id", creatorId).not("solana_signature", "is", null),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("host_id", creatorId),
        supabase.from("contribution_proofs").select("id", { count: "exact", head: true }).eq("user_id", creatorId),
        supabase.from("flow_items").select("id", { count: "exact", head: true }).eq("user_id", creatorId).gte("created_at", since),
      ]);
      return {
        verifiedWorks: verifiedRes.count ?? 0,
        totalWorks: worksRes.count ?? 0,
        eventsHosted: eventsRes.count ?? 0,
        contributions: contribRes.count ?? 0,
        flowPosts30d: flowRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="h-16 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tenureMonths = memberSince ? monthsBetween(new Date(memberSince), new Date()) : 0;
  const score = Math.min(
    100,
    data.verifiedWorks * 12 +
      data.eventsHosted * 8 +
      Math.min(data.contributions, 20) * 2 +
      Math.min(data.flowPosts30d, 10) * 2 +
      Math.min(tenureMonths, 12) * 1,
  );
  const tier =
    score >= 70
      ? { label: "Strong signal", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" }
      : score >= 35
        ? { label: "Building signal", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" }
        : { label: "Early signal", bar: "bg-muted-foreground/60", text: "text-muted-foreground" };

  const chips = [
    { Icon: ShieldCheck, label: "Verified IP", value: `${data.verifiedWorks}/${Math.max(data.totalWorks, 1)}` },
    { Icon: Sparkles,    label: "Contributions", value: String(data.contributions) },
    { Icon: Activity,    label: "Active 30d", value: String(data.flowPosts30d) },
    { Icon: Clock,       label: "Tenure", value: tenureMonths >= 12 ? `${Math.floor(tenureMonths / 12)}y` : `${Math.max(tenureMonths, 0)}mo` },
  ];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        {/* Score block */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="font-mono text-xl font-bold leading-none tabular-nums">{score}</p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">readiness</p>
          </div>
          <div className="hidden sm:block w-px h-9 bg-border/60" />
        </div>

        {/* Tier label + bar */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-[11px] font-semibold leading-none", tier.text)}>
            <span className="font-display">{tier.label}</span>
            <span className="text-muted-foreground font-normal ml-1.5">· Investor signal</span>
          </p>
          <div className="mt-1.5 h-1 rounded-full bg-muted/50 overflow-hidden">
            <div className={cn("h-full transition-all", tier.bar)} style={{ width: `${score}%` }} />
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
          {chips.map((c) => (
            <div
              key={c.label}
              className="inline-flex items-center gap-1 rounded-full bg-muted/40 border border-border/40 px-2 py-1"
              title={c.label}
            >
              <c.Icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">{c.value}</span>
            </div>
          ))}
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => navigate("/settings/verification")}
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/20 px-2 py-1 text-[10px] font-semibold text-foreground transition-colors"
            >
              <Shield className="h-3 w-3" /> Verify
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvestorSignalStrip;
