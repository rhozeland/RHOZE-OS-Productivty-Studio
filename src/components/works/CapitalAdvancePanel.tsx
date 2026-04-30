/**
 * CapitalAdvancePanel — Phase 5 (Capital).
 *
 * Surfaces a creator's settlement history as a collateral signal, producing
 * an estimated cash advance the platform could underwrite against future
 * royalties. Pure derivation — no new tables. Scoring inputs:
 *
 *   • 90-day settled gross revenue (the cashflow base)
 *   • Months active (consistency multiplier)
 *   • Share of settlements anchored on-chain (provenance bonus)
 *   • Number of distinct anchored Works (diversification floor)
 *
 * The advance is presented as an *estimate* with a clear "request" CTA that
 * files a notification — actual underwriting happens off-platform until the
 * Anchor capital module ships. Designed to look at home in the seller
 * dashboard editorial style (semantic tokens, no raw colors beyond the
 * existing emerald/violet/blue accents already in WorkSettlements).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Banknote,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInCalendarDays, differenceInCalendarMonths, subDays } from "date-fns";
import { useUnderwritingRules, DEFAULT_RULES, type UnderwritingRules } from "@/hooks/useUnderwritingRules";

interface Props {
  userId: string;
}

const fmt = (v: number) =>
  `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

interface Signal {
  events: number;
  onChainEvents: number;
  gross90d: number;
  grossLifetime: number;
  monthsActive: number;
  anchoredWorks: number;
  totalWorks: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

const computeAdvance = (s: Signal, r: UnderwritingRules) => {
  // Base: configurable % of trailing-90-day gross.
  const base = s.gross90d * r.base_advance_ratio;

  // Provenance multiplier: 1.0 with no anchored cashflows, up to 1+bonus
  // when every settlement is on-chain.
  const onChainRatio = s.events === 0 ? 0 : s.onChainEvents / s.events;
  const provenanceMult = 1 + onChainRatio * r.provenance_bonus_max;

  // Tenure multiplier: floor for brand-new sellers, scales to 1.0 at the
  // configured "full tenure" months.
  const tenureMult = Math.min(
    1,
    r.tenure_floor_mult +
      (s.monthsActive / Math.max(1, r.tenure_full_months)) *
        (1 - r.tenure_floor_mult),
  );

  // Diversification floor: each anchored work adds a tiny floor.
  const diversificationFloor = s.anchoredWorks * r.diversification_floor_per_work;

  const raw = Math.max(base * provenanceMult * tenureMult, diversificationFloor);

  const advance = Math.min(raw, r.advance_cap);

  // Eligibility from configured thresholds.
  const eligible =
    s.events >= r.min_settled_events &&
    s.anchoredWorks >= r.min_anchored_works &&
    advance >= r.min_advance_amount;

  // 0-100 collateral score with configurable weights + targets.
  const scoreParts = [
    Math.min(r.score_weight_revenue, (s.gross90d / Math.max(1, r.revenue_score_target)) * r.score_weight_revenue),
    Math.min(r.score_weight_provenance, onChainRatio * r.score_weight_provenance),
    Math.min(r.score_weight_tenure, (s.monthsActive / Math.max(1, r.tenure_full_months)) * r.score_weight_tenure),
    Math.min(r.score_weight_anchored, s.anchoredWorks * r.anchored_score_per_work),
  ];
  const score = Math.round(scoreParts.reduce((a, b) => a + b, 0));

  return { advance, eligible, score, onChainRatio, tenureMult, provenanceMult };
};

const CapitalAdvancePanel = ({ userId }: Props) => {
  const [requesting, setRequesting] = useState(false);

  const { data: signal, isLoading } = useQuery<Signal>({
    queryKey: ["capital-signal", userId],
    queryFn: async () => {
      // Pull the seller's works for anchored-breadth + tenure floor.
      const { data: works } = await supabase
        .from("works")
        .select("id, anchored_at, created_at, solana_signature")
        .eq("user_id", userId);

      // Pull configs the seller owns (creator_id).
      const { data: configs } = await supabase
        .from("revenue_split_configs")
        .select("id")
        .eq("creator_id", userId);

      const configIds = (configs || []).map((c) => c.id);
      let logs: Array<{ total_amount: number; solana_signature: string | null; created_at: string }> = [];
      if (configIds.length > 0) {
        const { data: logRows } = await supabase
          .from("revenue_split_logs")
          .select("total_amount, solana_signature, created_at")
          .in("config_id", configIds)
          .order("created_at", { ascending: false });
        logs = (logRows as any[]) || [];
      }

      const cutoff = subDays(new Date(), 90);
      const events = logs.length;
      const onChainEvents = logs.filter((l) => !!l.solana_signature).length;
      const grossLifetime = logs.reduce((a, l) => a + Number(l.total_amount || 0), 0);
      const gross90d = logs
        .filter((l) => new Date(l.created_at) >= cutoff)
        .reduce((a, l) => a + Number(l.total_amount || 0), 0);

      const firstEventAt = logs.length > 0 ? logs[logs.length - 1].created_at : null;
      const lastEventAt = logs.length > 0 ? logs[0].created_at : null;

      // Months active = months between first event (or first work) and now,
      // whichever is earlier — rewards creators registering IP even before
      // their first settlement.
      const earliest = [
        firstEventAt,
        ...((works || []).map((w: any) => w.created_at).filter(Boolean) as string[]),
      ]
        .filter(Boolean)
        .map((d) => new Date(d as string))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const monthsActive = earliest
        ? Math.max(0, differenceInCalendarMonths(new Date(), earliest))
        : 0;

      const anchoredWorks = (works || []).filter(
        (w: any) => !!w.solana_signature || !!w.anchored_at,
      ).length;

      return {
        events,
        onChainEvents,
        gross90d,
        grossLifetime,
        monthsActive,
        anchoredWorks,
        totalWorks: works?.length || 0,
        firstEventAt,
        lastEventAt,
      };
    },
    enabled: !!userId,
  });

  const { data: rules } = useUnderwritingRules();
  const activeRules = rules ?? DEFAULT_RULES;

  const result = useMemo(
    () => (signal ? computeAdvance(signal, activeRules) : null),
    [signal, activeRules],
  );

  const handleRequest = async () => {
    if (!signal || !result || !result.eligible) return;
    setRequesting(true);
    try {
      const { error } = await (supabase as any)
        .from("capital_advance_requests")
        .insert({
          user_id: userId,
          requested_amount: Math.round(result.advance),
          collateral_score: result.score,
          status: "submitted",
          signal_snapshot: {
            gross_90d: signal.gross90d,
            gross_lifetime: signal.grossLifetime,
            events: signal.events,
            on_chain_events: signal.onChainEvents,
            months_active: signal.monthsActive,
            anchored_works: signal.anchoredWorks,
            total_works: signal.totalWorks,
            on_chain_ratio: result.onChainRatio,
            tenure_mult: result.tenureMult,
            provenance_mult: result.provenanceMult,
          },
        });
      if (error) throw error;
      toast.success("Advance request submitted", {
        description: "Track its status below — we'll review within 3 business days.",
      });
      // Trigger status panel refetch via global event.
      window.dispatchEvent(new CustomEvent("capital-advance:created"));
    } catch (e: any) {
      toast.error(e.message || "Could not submit request");
    } finally {
      setRequesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculating collateral signal…
        </CardContent>
      </Card>
    );
  }

  if (!signal || !result) return null;

  const trailingDays = signal.firstEventAt
    ? Math.max(1, differenceInCalendarDays(new Date(), new Date(signal.firstEventAt)))
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" />
            Capital — Advance Eligibility
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            Phase 5 · settlement-collateralized
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Your settled, hash-anchored cashflows act as collateral for cash advances against
          future royalties. The estimate updates automatically as new settlements land.
        </p>

        {/* ─── Headline estimate ────────────────────────────────────── */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Estimated advance available
              </p>
              <p className="text-3xl font-bold tracking-tight mt-1">
                {result.eligible ? fmt(result.advance) : "—"}
              </p>
              {!result.eligible && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Need at least 1 settled event and 1 anchored Work to qualify.
                </p>
              )}
            </div>
            <Button
              size="sm"
              disabled={!result.eligible || requesting}
              onClick={handleRequest}
              className="rounded-full"
            >
              {requesting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              {result.eligible ? "Request advance" : "Not yet eligible"}
            </Button>
          </div>

          {/* Score meter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Collateral score
              </span>
              <span className="font-mono font-semibold">{result.score} / 100</span>
            </div>
            <Progress value={result.score} className="h-1.5" />
          </div>
        </div>

        {/* ─── Signal breakdown ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              90-day gross
            </p>
            <p className="text-base font-semibold mt-0.5 tabular-nums">
              {fmt(signal.gross90d)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {signal.events} settled event{signal.events === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              On-chain proof
            </p>
            <p className="text-base font-semibold mt-0.5 tabular-nums">
              {Math.round(result.onChainRatio * 100)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {signal.onChainEvents} of {signal.events} anchored
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Tenure
            </p>
            <p className="text-base font-semibold mt-0.5 tabular-nums">
              {signal.monthsActive} mo
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {trailingDays > 0 ? `${trailingDays}d since first settle` : "no settlements yet"}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Anchored IP
            </p>
            <p className="text-base font-semibold mt-0.5 tabular-nums">
              {signal.anchoredWorks}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              of {signal.totalWorks} registered work{signal.totalWorks === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* ─── How this is computed ────────────────────────────────── */}
        <div className="rounded-xl border border-dashed border-border/60 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> How we compute this
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Up to 60% of your trailing-90-day gross, multiplied by a provenance bonus
            (+25% at 100% on-chain) and a tenure factor (full at 6+ months). Capped at
            $25,000 per request. All inputs are auditable in your{" "}
            <span className="font-medium text-foreground">Per-Work Settlements</span> table
            below. Final terms are confirmed by the platform after review.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CapitalAdvancePanel;
