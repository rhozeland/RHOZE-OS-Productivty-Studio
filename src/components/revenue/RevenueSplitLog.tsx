/**
 * RevenueSplitLog — Splits v2 history.
 *
 * New shape: total + platform fee + per-collaborator JSON breakdown.
 * Falls back to the old creator/curator/buyback fields if a row predates the upgrade.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, BarChart3 } from "lucide-react";

interface RevenueSplitLogProps {
  configId: string;
}

type LogRow = {
  id: string;
  total_amount: number;
  platform_amount: number | null;
  platform_fee_bps: number | null;
  splits: Array<{ user_id: string; amount: number }> | null;
  // Legacy fields (pre-v2) kept for back-compat.
  creator_amount?: number | null;
  curator_amount?: number | null;
  buyback_amount?: number | null;
  solana_signature: string | null;
  created_at: string;
};

const RevenueSplitLog = ({ configId }: RevenueSplitLogProps) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["split-logs", configId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_split_logs")
        .select("*")
        .eq("config_id", configId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as LogRow[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading split history…
      </div>
    );
  }

  if (!logs || logs.length === 0) return null;

  const totalRevenue = logs.reduce((sum, l) => sum + Number(l.total_amount), 0);

  return (
    <div className="surface-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-semibold text-foreground">Split history</h3>
        </div>
        <Badge variant="secondary" className="font-mono">
          {totalRevenue} cr total
        </Badge>
      </div>

      <div className="space-y-2">
        {logs.map((log) => {
          const platform = Number(log.platform_amount ?? 0);
          const splits = log.splits ?? [];
          const isLegacy = !log.platform_amount && (log.creator_amount || log.curator_amount);
          return (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm gap-3"
            >
              <div className="min-w-0">
                <span className="font-medium text-foreground">{log.total_amount} cr</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {isLegacy
                    ? `(legacy) ${log.creator_amount ?? 0} creator / ${log.curator_amount ?? 0} curator`
                    : `· ${splits.length} collaborator${splits.length === 1 ? "" : "s"} · ${platform} cr platform fee`}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleDateString()}
                </span>
                {log.solana_signature && (
                  <a
                    href={`https://solscan.io/tx/${log.solana_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Badge variant="outline" className="gap-1 font-mono text-xs">
                      <ExternalLink className="h-3 w-3" />
                      on-chain
                    </Badge>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RevenueSplitLog;
