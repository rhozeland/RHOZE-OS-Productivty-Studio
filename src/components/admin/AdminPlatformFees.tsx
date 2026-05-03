/**
 * AdminPlatformFees — admin editor for tier-based platform fees.
 * Writes through the admin-only `update_platform_fee_tiers` RPC so the
 * change goes live immediately (no redeploy) and is audited.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import {
  usePlatformFeeTiers,
  DEFAULT_FEE_TIERS,
  type PlatformFeeTier,
} from "@/hooks/usePlatformFeeTiers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, Percent } from "lucide-react";

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : n.toLocaleString();

const AdminPlatformFees = () => {
  const qc = useQueryClient();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { data: tiers, isLoading } = usePlatformFeeTiers();
  const [draft, setDraft] = useState<PlatformFeeTier[]>(DEFAULT_FEE_TIERS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (tiers) {
      setDraft(tiers);
      setDirty(false);
    }
  }, [tiers]);

  const setRow = (idx: number, patch: Partial<PlatformFeeTier>) => {
    setDraft((d) => d.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const errors = useMemo(() => {
    const e: string[] = [];
    draft.forEach((r) => {
      if (r.fee_bps < 0 || r.fee_bps > 5000) e.push(`${r.label}: fee must be 0–50%`);
      if (r.min_balance < 0) e.push(`${r.label}: min balance must be ≥ 0`);
    });
    // Ensure ascending by min_balance for safety
    const sorted = [...draft].sort((a, b) => a.sort_order - b.sort_order);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min_balance < sorted[i - 1].min_balance) {
        e.push(`${sorted[i].label}: min balance must be ≥ ${sorted[i - 1].label}`);
      }
    }
    return e;
  }, [draft]);

  const isValid = errors.length === 0;

  const save = useMutation({
    mutationFn: async () => {
      const payload = draft.map((r) => ({
        tier_id: r.tier_id,
        label: r.label,
        min_balance: r.min_balance,
        fee_bps: Math.round(r.fee_bps),
        sort_order: r.sort_order,
      }));
      const { error } = await (supabase as any).rpc("update_platform_fee_tiers", {
        _payload: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee tiers published — live immediately");
      qc.invalidateQueries({ queryKey: ["platform-fee-tiers"] });
      setDirty(false);
    },
    onError: (e: any) => toast.error(e.message || "Could not save fee tiers"),
  });

  if (adminLoading || isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading fee tiers…
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Admin only.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Platform Fee Tiers
          </span>
          <div className="flex items-center gap-2">
            {!isValid && <Badge variant="destructive" className="text-[10px]">Invalid</Badge>}
            {dirty && <Badge variant="secondary" className="text-[10px]">Unsaved</Badge>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Sets the platform fee taken on event tickets, Spaces bookings, marketplace sales, and paid project milestones.
          Tier is decided by the seller's $RHOZE balance. Changes go live immediately — no redeploy.
        </p>

        <div className="space-y-3">
          {draft.map((row, idx) => (
            <div
              key={row.tier_id}
              className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto] gap-3 items-end p-3 rounded-lg border border-border/50 bg-muted/20"
            >
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Tier
                </Label>
                <div className="text-sm font-semibold">{row.label}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{row.tier_id}</div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Min $RHOZE balance</Label>
                <Input
                  type="number"
                  step={1000}
                  min={0}
                  value={row.min_balance}
                  onChange={(e) => setRow(idx, { min_balance: Number(e.target.value) })}
                  className="font-mono text-sm h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  ≥ {fmt(row.min_balance)} $RHOZE qualifies
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Platform fee</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step={0.5}
                    min={0}
                    max={50}
                    value={(row.fee_bps / 100).toFixed(2)}
                    onChange={(e) =>
                      setRow(idx, { fee_bps: Math.round(Number(e.target.value) * 100) })
                    }
                    className="font-mono text-sm h-9"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {row.fee_bps} bps
                </p>
              </div>

              <Badge variant="outline" className="font-mono text-[10px] self-center sm:self-end">
                {(row.fee_bps / 100).toFixed(1)}%
              </Badge>
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div className="text-xs text-destructive space-y-1">
            {errors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => {
              if (tiers) { setDraft(tiers); setDirty(false); }
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Discard
          </Button>
          <Button
            size="sm"
            disabled={!dirty || !isValid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Publish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminPlatformFees;
