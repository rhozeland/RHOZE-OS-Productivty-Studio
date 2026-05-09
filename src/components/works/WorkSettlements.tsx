import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Fingerprint, FileCheck2, Loader2, Layers } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface WorkSettlementsProps {
  userId: string;
}

const fmt = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface SettlementRow {
  workId: string;
  title: string;
  contentHash: string;
  workSignature: string | null;
  anchoredAt: string | null;
  fileUrl: string | null;
  events: number;
  gross: number;
  payout: number;   // total paid out to all collaborators
  platform: number; // platform fee
  lastEvent: string | null;
  configIds: Set<string>;
  onChainEvents: number;
}

const WorkSettlements = ({ userId }: WorkSettlementsProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["work-settlements", userId],
    queryFn: async () => {
      // 1. Pull all works owned by this seller
      const { data: works } = await supabase
        .from("works")
        .select("id, title, content_hash, solana_signature, anchored_at, file_url")
        .eq("user_id", userId);

      if (!works || works.length === 0) return [];

      const workIds = works.map((w) => w.id);

      // 2. Pull configs directly bound via work_id
      const { data: directConfigs } = await supabase
        .from("revenue_split_configs")
        .select("id, work_id, listing_id, contract_id")
        .in("work_id", workIds);

      // 3. Pull attachments (work -> listing/contract) so we can also tie indirect splits
      const { data: attachments } = await supabase
        .from("work_attachments")
        .select("work_id, target_type, target_id")
        .in("work_id", workIds);

      const listingTargets = (attachments || []).filter((a) => a.target_type === "listing");
      const contractTargets = (attachments || []).filter((a) => a.target_type === "contract");

      let attachedConfigs: Array<{ id: string; work_id: string | null; listing_id: string | null; contract_id: string | null }> = [];

      if (listingTargets.length > 0) {
        const { data: lc } = await supabase
          .from("revenue_split_configs")
          .select("id, work_id, listing_id, contract_id")
          .in("listing_id", listingTargets.map((l) => l.target_id));
        if (lc) attachedConfigs = attachedConfigs.concat(lc);
      }
      if (contractTargets.length > 0) {
        const { data: cc } = await supabase
          .from("revenue_split_configs")
          .select("id, work_id, listing_id, contract_id")
          .in("contract_id", contractTargets.map((c) => c.target_id));
        if (cc) attachedConfigs = attachedConfigs.concat(cc);
      }

      // Build configId -> workIds[] map
      const configToWorks = new Map<string, Set<string>>();
      const addLink = (configId: string, workId: string) => {
        if (!configToWorks.has(configId)) configToWorks.set(configId, new Set());
        configToWorks.get(configId)!.add(workId);
      };
      (directConfigs || []).forEach((c) => {
        if (c.work_id) addLink(c.id, c.work_id);
      });
      attachedConfigs.forEach((c) => {
        // Map back via listing/contract attachments
        if (c.listing_id) {
          listingTargets
            .filter((l) => l.target_id === c.listing_id)
            .forEach((l) => addLink(c.id, l.work_id));
        }
        if (c.contract_id) {
          contractTargets
            .filter((ct) => ct.target_id === c.contract_id)
            .forEach((ct) => addLink(c.id, ct.work_id));
        }
      });

      const allConfigIds = Array.from(configToWorks.keys());
      let logs: any[] = [];
      if (allConfigIds.length > 0) {
        const { data: logRows } = await supabase
          .from("revenue_split_logs")
          .select("id, config_id, total_amount, platform_amount, creator_amount, curator_amount, buyback_amount, solana_signature, created_at")
          .in("config_id", allConfigIds)
          .order("created_at", { ascending: false });
        logs = logRows || [];
      }

      // Aggregate per work
      const rows = new Map<string, SettlementRow>();
      works.forEach((w) => {
        rows.set(w.id, {
          workId: w.id,
          title: w.title,
          contentHash: w.content_hash,
          workSignature: w.solana_signature,
          anchoredAt: w.anchored_at,
          fileUrl: w.file_url,
          events: 0,
          gross: 0,
          payout: 0,
          platform: 0,
          lastEvent: null,
          configIds: new Set(),
          onChainEvents: 0,
        });
      });

      logs.forEach((log) => {
        const linkedWorks = configToWorks.get(log.config_id);
        if (!linkedWorks) return;
        const share = 1 / linkedWorks.size;
        // v2 shape: platform_amount + (total - platform_amount) collaborator payout
        // Legacy fallback: creator + curator + buyback
        const total = Number(log.total_amount);
        const platform = log.platform_amount != null
          ? Number(log.platform_amount)
          : 0;
        const payout = log.platform_amount != null
          ? total - platform
          : Number(log.creator_amount ?? 0) + Number(log.curator_amount ?? 0) + Number(log.buyback_amount ?? 0);
        linkedWorks.forEach((wid) => {
          const row = rows.get(wid);
          if (!row) return;
          row.events += 1;
          row.gross += total * share;
          row.payout += payout * share;
          row.platform += platform * share;
          row.configIds.add(log.config_id);
          if (log.solana_signature) row.onChainEvents += 1;
          if (!row.lastEvent || log.created_at > row.lastEvent) {
            row.lastEvent = log.created_at;
          }
        });
      });

      // Only surface works that have configs OR settlements
      return Array.from(rows.values())
        .filter((r) => r.events > 0 || r.configIds.size > 0)
        .sort((a, b) => b.gross - a.gross);
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading per-work settlements…
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            Per-Work Settlements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4">
            No work-linked cashflows yet. Register a Work in <Link to="/works" className="text-primary underline">Works</Link>, attach it to a listing or contract, and bind it to a revenue split — settled payouts will surface here as auditable, hash-anchored cashflows.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totals = data.reduce(
    (acc, r) => {
      acc.gross += r.gross;
      acc.payout += r.payout;
      acc.platform += r.platform;
      acc.events += r.events;
      acc.onChain += r.onChainEvents;
      return acc;
    },
    { gross: 0, payout: 0, platform: 0, events: 0, onChain: 0 }
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            Per-Work Settlements
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {totals.events} events · {totals.onChain} on-chain
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              {fmt(totals.gross)} gross
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Cashflows derived from revenue splits, indexed by registered IP-asset content hash. Each row is auditable against the on-chain anchor for the underlying work.
        </p>
        <div className="space-y-3">
          {data.map((row) => (
            <div
              key={row.workId}
              className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{row.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="font-mono text-[10px] gap-1">
                      <Fingerprint className="h-3 w-3" />
                      {row.contentHash.slice(0, 10)}…{row.contentHash.slice(-6)}
                    </Badge>
                    {row.workSignature ? (
                      <a
                        href={`https://solscan.io/tx/${row.workSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                          <ExternalLink className="h-3 w-3" />
                          anchored
                          {row.anchoredAt && ` · ${format(new Date(row.anchoredAt), "MMM d")}`}
                        </Badge>
                      </a>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        not anchored
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Layers className="h-3 w-3" />
                      {row.configIds.size} split{row.configIds.size === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tracking-tight">{fmt(row.gross)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {row.events} settlement{row.events === 1 ? "" : "s"}
                    {row.lastEvent && ` · last ${format(new Date(row.lastEvent), "MMM d")}`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Collaborators</p>
                  <p className="text-sm font-semibold text-emerald-500">{fmt(row.payout)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Platform fee</p>
                  <p className="text-sm font-semibold text-violet-500">{fmt(row.platform)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Link
                  to="/works"
                  className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Open in Works →
                </Link>
                {row.onChainEvents > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {row.onChainEvents} of {row.events} events anchored on-chain
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkSettlements;
