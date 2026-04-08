import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, BarChart3 } from "lucide-react";

interface RevenueSplitLogProps {
  configId: string;
}

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
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading split history...
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return null;
  }

  const totalRevenue = logs.reduce((sum, l) => sum + l.total_amount, 0);

  return (
    <div className="surface-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            Split History
          </h3>
        </div>
        <Badge variant="secondary" className="font-mono">
          {totalRevenue} cr total
        </Badge>
      </div>

      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm"
          >
            <div>
              <span className="font-medium text-foreground">{log.total_amount} cr</span>
              <span className="text-muted-foreground ml-2">
                → {log.creator_amount} creator / {log.curator_amount} curator / {log.buyback_amount} buyback
              </span>
            </div>
            <div className="flex items-center gap-2">
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
        ))}
      </div>
    </div>
  );
};

export default RevenueSplitLog;
