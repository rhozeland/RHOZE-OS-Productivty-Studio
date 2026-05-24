/**
 * CuratorEarningsCard — Phase 4
 *
 * Shows the signed-in curator how many Concierge briefs they've claimed,
 * how many converted, and the gross billed (sum of converted project budgets).
 * Actual cash earnings are governed by each project's `split_configs` row
 * (curator_pct), set inside the project workspace.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, CheckCircle2, DollarSign, Inbox } from "lucide-react";

export default function CuratorEarningsCard() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["curator-earnings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [claimedRes, convertedRes] = await Promise.all([
        supabase
          .from("concierge_requests")
          .select("id, status", { count: "exact", head: false })
          .eq("curator_id", user!.id),
        supabase
          .from("projects")
          .select("id, total_budget")
          .eq("curator_id", user!.id)
          .eq("intake_tier", "concierge"),
      ]);
      const claimed = claimedRes.data ?? [];
      const converted = convertedRes.data ?? [];
      const billed = converted.reduce(
        (sum, p: any) => sum + (Number(p.total_budget) || 0),
        0,
      );
      return {
        claimed: claimed.length,
        active: claimed.filter((r: any) =>
          ["new", "reviewing", "scoped"].includes(r.status),
        ).length,
        converted: converted.length,
        billed,
      };
    },
  });

  if (!data) return null;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            Your curator stats
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Metric icon={<Inbox className="h-3.5 w-3.5" />} label="Active" value={String(data.active)} />
          <Metric icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Converted" value={String(data.converted)} />
          <Metric
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Gross billed"
            value={data.billed.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Your cash share depends on each project's split config
          (<code>curator_pct</code>), set inside the project workspace.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 border border-border p-3">
      <div className="flex items-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
