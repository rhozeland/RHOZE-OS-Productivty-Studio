/**
 * CreatorReadinessCard — investor-readable signal card.
 *
 * Surfaces the signals an investor would actually use to decide whether
 * to back a creator's coin: Verified IP count, events hosted/attended,
 * anchored contributions, tenure, and recent activity. Renders inline
 * above the bonding curve so the Coin tab makes "what's investable"
 * obvious at a glance.
 *
 * All counts are read-only aggregations — no business logic changes.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Calendar, Sparkles, Clock, Activity, Loader2 } from "lucide-react";

interface Props {
  creatorId: string;
  memberSince?: string | null;
}

interface Signals {
  verifiedWorks: number;
  totalWorks: number;
  eventsHosted: number;
  contributions: number;
  flowPosts30d: number;
  lastActivityAt: string | null;
}

const monthsBetween = (from: Date, to: Date) => {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
};

const formatRelative = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

const CreatorReadinessCard = ({ creatorId, memberSince }: Props) => {
  const { data, isLoading } = useQuery<Signals>({
    queryKey: ["creator-readiness", creatorId],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();

      const [worksRes, verifiedRes, eventsRes, contribRes, flowRes, latestFlowRes] = await Promise.all([
        supabase.from("works").select("id", { count: "exact", head: true }).eq("user_id", creatorId),
        supabase
          .from("works")
          .select("id", { count: "exact", head: true })
          .eq("user_id", creatorId)
          .not("solana_signature", "is", null),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("host_id", creatorId),
        supabase
          .from("contribution_proofs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", creatorId),
        supabase
          .from("flow_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", creatorId)
          .gte("created_at", since),
        supabase
          .from("flow_items")
          .select("created_at")
          .eq("user_id", creatorId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        verifiedWorks: verifiedRes.count ?? 0,
        totalWorks: worksRes.count ?? 0,
        eventsHosted: eventsRes.count ?? 0,
        contributions: contribRes.count ?? 0,
        flowPosts30d: flowRes.count ?? 0,
        lastActivityAt: latestFlowRes.data?.created_at ?? null,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-6 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tenureMonths = memberSince ? monthsBetween(new Date(memberSince), new Date()) : 0;

  // Lightweight readiness score (0–100). Investors see signal weight, not a black box.
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
      ? { label: "Strong signal", tone: "text-emerald-400", bar: "bg-emerald-500" }
      : score >= 35
      ? { label: "Building signal", tone: "text-amber-400", bar: "bg-amber-500" }
      : { label: "Early signal", tone: "text-muted-foreground", bar: "bg-muted-foreground/60" };

  const stats = [
    {
      icon: ShieldCheck,
      label: "Verified IP",
      value: `${data.verifiedWorks}/${data.totalWorks}`,
      hint: "Works anchored on Solana",
    },
    {
      icon: Calendar,
      label: "Events hosted",
      value: String(data.eventsHosted),
      hint: "Real-world proof of work",
    },
    {
      icon: Sparkles,
      label: "Contributions",
      value: String(data.contributions),
      hint: "Anchored on-chain memos",
    },
    {
      icon: Activity,
      label: "Active 30d",
      value: String(data.flowPosts30d),
      hint: "Posts to Flow this month",
    },
    {
      icon: Clock,
      label: "Tenure",
      value: tenureMonths >= 12 ? `${Math.floor(tenureMonths / 12)}y` : `${tenureMonths}mo`,
      hint: "On Rhozeland",
    },
  ];

  return (
    <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Investor signal</p>
          <h3 className="font-display text-lg font-semibold mt-1">
            <span className={tier.tone}>{tier.label}</span>
            <span className="text-muted-foreground font-normal ml-2 text-sm">
              · last active {formatRelative(data.lastActivityAt)}
            </span>
          </h3>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold leading-none">{score}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">readiness</p>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div className={`h-full ${tier.bar} transition-all`} style={{ width: `${score}%` }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-background/40 border border-border/40 p-3 space-y-1"
            title={s.hint}
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <s.icon className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="font-mono text-base font-semibold leading-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Signals are derived from on-platform activity. They reflect proof of building — not a financial
        recommendation. Trade simulations are speculative until the coin graduates.
      </p>
    </div>
  );
};

export default CreatorReadinessCard;
