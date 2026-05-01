/**
 * AdminUnderwritingRules — admin-only editor for the Capital scoring engine.
 *
 * Edits the singleton row in `capital_underwriting_rules`. All sellers see
 * updated thresholds/weights immediately because the seller-facing
 * CapitalAdvancePanel reads from the same table on render.
 *
 * Grouped into three sections to match the formula sections in the panel:
 *   1. Advance formula (base ratio, multipliers, cap)
 *   2. Eligibility thresholds (min events / works / amount)
 *   3. Score weights + normalization
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Banknote,
  Wand2,
} from "lucide-react";
import {
  useUnderwritingRules,
  DEFAULT_RULES,
  type UnderwritingRules,
} from "@/hooks/useUnderwritingRules";

/**
 * Validation schema — enforces sensible per-field ranges.
 * These bounds protect both the seller-facing estimator (no nonsensical
 * advances) and the underwriting math itself (no division-by-zero, no
 * negative weights, no caps that would let admins approve unbounded $$).
 */
const rulesSchema = z.object({
  base_advance_ratio: z.number().min(0, "Must be ≥ 0").max(2, "Cap at 2.0 (200%)"),
  provenance_bonus_max: z.number().min(0, "Must be ≥ 0").max(1, "Cap at 1.0 (+100%)"),
  tenure_floor_mult: z.number().min(0, "Must be ≥ 0").max(1, "Cap at 1.0"),
  tenure_full_months: z.number().int("Must be a whole number").min(1, "At least 1 month").max(60, "Cap at 60 months"),
  diversification_floor_per_work: z.number().min(0, "Must be ≥ 0").max(1000, "Cap at $1,000"),
  advance_cap: z.number().min(100, "At least $100").max(1_000_000, "Cap at $1M"),
  min_settled_events: z.number().int("Whole number").min(0, "Must be ≥ 0").max(100, "Cap at 100"),
  min_anchored_works: z.number().int("Whole number").min(0, "Must be ≥ 0").max(100, "Cap at 100"),
  min_advance_amount: z.number().min(0, "Must be ≥ 0").max(100_000, "Cap at $100k"),
  score_weight_revenue: z.number().min(0, "Must be ≥ 0").max(100, "Cap at 100"),
  score_weight_provenance: z.number().min(0, "Must be ≥ 0").max(100, "Cap at 100"),
  score_weight_tenure: z.number().min(0, "Must be ≥ 0").max(100, "Cap at 100"),
  score_weight_anchored: z.number().min(0, "Must be ≥ 0").max(100, "Cap at 100"),
  revenue_score_target: z.number().min(1, "Must be ≥ $1").max(10_000_000, "Cap at $10M"),
  anchored_score_per_work: z.number().min(0, "Must be ≥ 0").max(100, "Cap at 100"),
}).refine(
  (v) => v.min_advance_amount <= v.advance_cap,
  { message: "Min advance amount cannot exceed the advance cap", path: ["min_advance_amount"] },
);

const WEIGHT_KEYS = [
  "score_weight_revenue",
  "score_weight_provenance",
  "score_weight_tenure",
  "score_weight_anchored",
] as const satisfies ReadonlyArray<keyof UnderwritingRules>;

type Field = {
  key: keyof UnderwritingRules;
  label: string;
  hint?: string;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
};

const FORMULA_FIELDS: Field[] = [
  {
    key: "base_advance_ratio",
    label: "Base advance ratio",
    hint: "Fraction of trailing-90d gross used as the advance base. 0.60 = 60%.",
    step: 0.05,
    min: 0,
    max: 2,
  },
  {
    key: "provenance_bonus_max",
    label: "Provenance bonus (max)",
    hint: "Extra multiplier when 100% of settlements are on-chain. 0.25 = +25%.",
    step: 0.05,
    min: 0,
    max: 1,
  },
  {
    key: "tenure_floor_mult",
    label: "Tenure floor multiplier",
    hint: "Multiplier for brand-new sellers (months active = 0).",
    step: 0.05,
    min: 0,
    max: 1,
  },
  {
    key: "tenure_full_months",
    label: "Tenure full at (months)",
    hint: "Months active to reach full 1.0 tenure multiplier.",
    step: 1,
    min: 1,
    max: 60,
    suffix: "mo",
  },
  {
    key: "diversification_floor_per_work",
    label: "Floor per anchored work",
    hint: "Tiny floor each anchored Work contributes (USD).",
    step: 5,
    min: 0,
    max: 1000,
    suffix: "$",
  },
  {
    key: "advance_cap",
    label: "Advance cap",
    hint: "Hard maximum per request (USD).",
    step: 500,
    min: 100,
    max: 1_000_000,
    suffix: "$",
  },
];

const ELIGIBILITY_FIELDS: Field[] = [
  {
    key: "min_settled_events",
    label: "Min settled events",
    step: 1,
    min: 0,
    max: 100,
  },
  {
    key: "min_anchored_works",
    label: "Min anchored Works",
    step: 1,
    min: 0,
    max: 100,
  },
  {
    key: "min_advance_amount",
    label: "Min advance amount",
    step: 25,
    min: 0,
    max: 100_000,
    suffix: "$",
  },
];

const SCORE_FIELDS: Field[] = [
  {
    key: "score_weight_revenue",
    label: "Revenue weight",
    hint: "Max points from 90d gross.",
    step: 1,
    min: 0,
    max: 100,
  },
  {
    key: "score_weight_provenance",
    label: "Provenance weight",
    hint: "Max points from on-chain ratio.",
    step: 1,
    min: 0,
    max: 100,
  },
  {
    key: "score_weight_tenure",
    label: "Tenure weight",
    hint: "Max points from months active.",
    step: 1,
    min: 0,
    max: 100,
  },
  {
    key: "score_weight_anchored",
    label: "Anchored breadth weight",
    hint: "Max points from number of anchored Works.",
    step: 1,
    min: 0,
    max: 100,
  },
  {
    key: "revenue_score_target",
    label: "Revenue score target",
    hint: "Trailing-90d gross that earns full revenue points.",
    step: 250,
    min: 1,
    max: 10_000_000,
    suffix: "$",
  },
  {
    key: "anchored_score_per_work",
    label: "Score per anchored work",
    hint: "Points contributed per anchored Work, up to the weight cap.",
    step: 1,
    min: 0,
    max: 100,
  },
];

const Section = ({
  title,
  icon: Icon,
  fields,
  values,
  errors,
  onChange,
  rightSlot,
}: {
  title: string;
  icon: typeof Sliders;
  fields: Field[];
  values: UnderwritingRules;
  errors: Partial<Record<keyof UnderwritingRules, string>>;
  onChange: (k: keyof UnderwritingRules, v: number) => void;
  rightSlot?: React.ReactNode;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {rightSlot}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((f) => {
        const err = errors[f.key];
        return (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={f.key} className="text-xs flex items-center gap-1">
              {f.label}
              {f.suffix && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({f.suffix})
                </span>
              )}
              {(f.min !== undefined || f.max !== undefined) && (
                <span className="text-[10px] text-muted-foreground/60 font-mono ml-auto">
                  {f.min ?? "−∞"}–{f.max ?? "∞"}
                </span>
              )}
            </Label>
            <Input
              id={f.key}
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              value={values[f.key]}
              onChange={(e) => onChange(f.key, Number(e.target.value))}
              aria-invalid={!!err}
              className={`font-mono text-sm h-9 ${
                err ? "border-destructive focus-visible:ring-destructive/30" : ""
              }`}
            />
            {err ? (
              <p className="text-[10px] text-destructive leading-snug">{err}</p>
            ) : f.hint ? (
              <p className="text-[10px] text-muted-foreground leading-snug">{f.hint}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  </div>
);

const AdminUnderwritingRules = () => {
  const qc = useQueryClient();
  const { data: rules, isLoading } = useUnderwritingRules();
  const [draft, setDraft] = useState<UnderwritingRules>(DEFAULT_RULES);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (rules) {
      setDraft(rules);
      setDirty(false);
    }
  }, [rules]);

  const setField = (k: keyof UnderwritingRules, v: number) => {
    setDraft((d) => ({ ...d, [k]: isFinite(v) ? v : 0 }));
    setDirty(true);
  };

  // Validate the entire draft on every change. Building a per-field
  // error map keeps the UI cheap (no re-validation per input event)
  // and lets us disable Save when anything is out of range.
  const { errors, isValid } = useMemo(() => {
    const result = rulesSchema.safeParse(draft);
    if (result.success) return { errors: {} as Partial<Record<keyof UnderwritingRules, string>>, isValid: true };
    const map: Partial<Record<keyof UnderwritingRules, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof UnderwritingRules | undefined;
      if (key && !map[key]) map[key] = issue.message;
    }
    return { errors: map, isValid: false };
  }, [draft]);

  const totalWeight =
    draft.score_weight_revenue +
    draft.score_weight_provenance +
    draft.score_weight_tenure +
    draft.score_weight_anchored;

  /**
   * Proportionally rescale the four scoring weights so they sum to 100.
   * Falls back to an even 25/25/25/25 split if all weights are currently 0
   * (no proportional information to preserve). Rounds to integers and
   * absorbs the rounding remainder into the largest weight so the total
   * is exactly 100.
   */
  const normalizeWeights = () => {
    const current = WEIGHT_KEYS.map((k) => Math.max(0, Number(draft[k]) || 0));
    const sum = current.reduce((a, b) => a + b, 0);
    let scaled: number[];
    if (sum <= 0) {
      scaled = [25, 25, 25, 25];
    } else {
      const raw = current.map((v) => (v / sum) * 100);
      scaled = raw.map((v) => Math.round(v));
      const diff = 100 - scaled.reduce((a, b) => a + b, 0);
      if (diff !== 0) {
        const maxIdx = scaled.indexOf(Math.max(...scaled));
        scaled[maxIdx] = scaled[maxIdx] + diff;
      }
    }
    setDraft((d) => ({
      ...d,
      score_weight_revenue: scaled[0],
      score_weight_provenance: scaled[1],
      score_weight_tenure: scaled[2],
      score_weight_anchored: scaled[3],
    }));
    setDirty(true);
    toast.success("Scoring weights normalized to 100");
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: UnderwritingRules) => {
      // Re-validate server-side-bound payload before send. Client-side
      // bounds and the schema are a UX hint; we still want to refuse
      // submission of obviously broken inputs even if the form was
      // bypassed via devtools.
      const parsed = rulesSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid rules");
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("capital_underwriting_rules")
        .update({
          ...parsed.data,
          updated_by: auth.user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Underwriting rules updated");
      qc.invalidateQueries({ queryKey: ["capital-underwriting-rules"] });
      qc.invalidateQueries({ queryKey: ["capital-underwriting-rules-audit"] });
      setDirty(false);
    },
    onError: (e: any) => toast.error(e.message || "Could not save rules"),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading rules…
        </CardContent>
      </Card>
    );
  }

  const weightsBalanced = totalWeight === 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Capital — Underwriting Rules
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              score weights = {totalWeight}
              {!weightsBalanced && (
                <span className="ml-1 text-amber-500">(≠ 100)</span>
              )}
            </Badge>
            {!isValid && (
              <Badge variant="destructive" className="text-[10px]">
                Invalid
              </Badge>
            )}
            {dirty && (
              <Badge variant="secondary" className="text-[10px]">
                Unsaved
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">
          These values drive the seller-facing Capital advance estimator and
          collateral score. Changes take effect immediately — no redeploy needed.
        </p>

        <Section
          title="Advance formula"
          icon={Banknote}
          fields={FORMULA_FIELDS}
          values={draft}
          errors={errors}
          onChange={setField}
        />

        <Section
          title="Eligibility thresholds"
          icon={ShieldCheck}
          fields={ELIGIBILITY_FIELDS}
          values={draft}
          errors={errors}
          onChange={setField}
        />

        <Section
          title="Score weights & normalization"
          icon={Sliders}
          fields={SCORE_FIELDS}
          values={draft}
          errors={errors}
          onChange={setField}
          rightSlot={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={normalizeWeights}
              disabled={weightsBalanced}
              title={
                weightsBalanced
                  ? "Weights already sum to 100"
                  : "Proportionally rescale the four weights to sum to 100"
              }
            >
              <Wand2 className="h-3 w-3 mr-1" />
              Normalize to 100
            </Button>
          }
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => {
              if (rules) {
                setDraft(rules);
                setDirty(false);
              }
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => {
              setDraft(DEFAULT_RULES);
              setDirty(true);
            }}
          >
            Restore defaults
          </Button>
          <Button
            size="sm"
            disabled={!dirty || !isValid || saveMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
            title={!isValid ? "Fix the highlighted fields before saving" : undefined}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminUnderwritingRules;
