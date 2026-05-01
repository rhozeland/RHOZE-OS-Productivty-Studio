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
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Save, RotateCcw, Sliders, ShieldCheck, Banknote } from "lucide-react";
import {
  useUnderwritingRules,
  DEFAULT_RULES,
  type UnderwritingRules,
} from "@/hooks/useUnderwritingRules";

type Field = {
  key: keyof UnderwritingRules;
  label: string;
  hint?: string;
  step?: number;
  min?: number;
  suffix?: string;
};

const FORMULA_FIELDS: Field[] = [
  {
    key: "base_advance_ratio",
    label: "Base advance ratio",
    hint: "Fraction of trailing-90d gross used as the advance base. 0.60 = 60%.",
    step: 0.05,
    min: 0,
  },
  {
    key: "provenance_bonus_max",
    label: "Provenance bonus (max)",
    hint: "Extra multiplier when 100% of settlements are on-chain. 0.25 = +25%.",
    step: 0.05,
    min: 0,
  },
  {
    key: "tenure_floor_mult",
    label: "Tenure floor multiplier",
    hint: "Multiplier for brand-new sellers (months active = 0).",
    step: 0.05,
    min: 0,
  },
  {
    key: "tenure_full_months",
    label: "Tenure full at (months)",
    hint: "Months active to reach full 1.0 tenure multiplier.",
    step: 1,
    min: 1,
    suffix: "mo",
  },
  {
    key: "diversification_floor_per_work",
    label: "Floor per anchored work",
    hint: "Tiny floor each anchored Work contributes (USD).",
    step: 5,
    min: 0,
    suffix: "$",
  },
  {
    key: "advance_cap",
    label: "Advance cap",
    hint: "Hard maximum per request (USD).",
    step: 500,
    min: 0,
    suffix: "$",
  },
];

const ELIGIBILITY_FIELDS: Field[] = [
  {
    key: "min_settled_events",
    label: "Min settled events",
    step: 1,
    min: 0,
  },
  {
    key: "min_anchored_works",
    label: "Min anchored Works",
    step: 1,
    min: 0,
  },
  {
    key: "min_advance_amount",
    label: "Min advance amount",
    step: 25,
    min: 0,
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
  },
  {
    key: "score_weight_provenance",
    label: "Provenance weight",
    hint: "Max points from on-chain ratio.",
    step: 1,
    min: 0,
  },
  {
    key: "score_weight_tenure",
    label: "Tenure weight",
    hint: "Max points from months active.",
    step: 1,
    min: 0,
  },
  {
    key: "score_weight_anchored",
    label: "Anchored breadth weight",
    hint: "Max points from number of anchored Works.",
    step: 1,
    min: 0,
  },
  {
    key: "revenue_score_target",
    label: "Revenue score target",
    hint: "Trailing-90d gross that earns full revenue points.",
    step: 250,
    min: 1,
    suffix: "$",
  },
  {
    key: "anchored_score_per_work",
    label: "Score per anchored work",
    hint: "Points contributed per anchored Work, up to the weight cap.",
    step: 1,
    min: 0,
  },
];

const Section = ({
  title,
  icon: Icon,
  fields,
  values,
  onChange,
}: {
  title: string;
  icon: typeof Sliders;
  fields: Field[];
  values: UnderwritingRules;
  onChange: (k: keyof UnderwritingRules, v: number) => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label htmlFor={f.key} className="text-xs flex items-center gap-1">
            {f.label}
            {f.suffix && (
              <span className="text-[10px] text-muted-foreground font-mono">
                ({f.suffix})
              </span>
            )}
          </Label>
          <Input
            id={f.key}
            type="number"
            step={f.step}
            min={f.min}
            value={values[f.key]}
            onChange={(e) => onChange(f.key, Number(e.target.value))}
            className="font-mono text-sm h-9"
          />
          {f.hint && (
            <p className="text-[10px] text-muted-foreground leading-snug">{f.hint}</p>
          )}
        </div>
      ))}
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

  const saveMutation = useMutation({
    mutationFn: async (payload: UnderwritingRules) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("capital_underwriting_rules")
        .update({
          ...payload,
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

  const totalWeight =
    draft.score_weight_revenue +
    draft.score_weight_provenance +
    draft.score_weight_tenure +
    draft.score_weight_anchored;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading rules…
        </CardContent>
      </Card>
    );
  }

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
              {totalWeight !== 100 && (
                <span className="ml-1 text-amber-500">(≠ 100)</span>
              )}
            </Badge>
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
          onChange={setField}
        />

        <Section
          title="Eligibility thresholds"
          icon={ShieldCheck}
          fields={ELIGIBILITY_FIELDS}
          values={draft}
          onChange={setField}
        />

        <Section
          title="Score weights & normalization"
          icon={Sliders}
          fields={SCORE_FIELDS}
          values={draft}
          onChange={setField}
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
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
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
