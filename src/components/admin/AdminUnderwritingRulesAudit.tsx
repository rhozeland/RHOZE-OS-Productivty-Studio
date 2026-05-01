/**
 * AdminUnderwritingRulesAudit — admin-only history viewer for changes
 * to the Capital scoring rules. Reads from `capital_underwriting_rules_audit`
 * (populated by a SECURITY DEFINER trigger so users can't forge entries).
 *
 * Each row shows who saved the change, when, and a per-field before → after
 * diff so reviewers can audit underwriting decisions retroactively.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AuditRow {
  id: string;
  changed_by: string | null;
  changed_at: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  changed_fields: string[];
  actor?: { display_name: string | null; username: string | null } | null;
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/\.?0+$/, "");
  return String(v);
};

const AdminUnderwritingRulesAudit = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["capital-underwriting-rules-audit"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data: rows, error } = await (supabase as any)
        .from("capital_underwriting_rules_audit")
        .select("id, changed_by, changed_at, old_values, new_values, changed_fields")
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const actorIds = Array.from(
        new Set((rows as AuditRow[]).map((r) => r.changed_by).filter(Boolean) as string[]),
      );
      let profilesById = new Map<string, { display_name: string | null; username: string | null }>();
      if (actorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", actorIds);
        profilesById = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      }
      return (rows as AuditRow[]).map((r) => ({
        ...r,
        actor: r.changed_by ? profilesById.get(r.changed_by) ?? null : null,
      }));
    },
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Underwriting Rules — Change History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes recorded yet. The next save will be the first audit entry.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.map((row) => {
              const actorLabel =
                row.actor?.display_name ||
                row.actor?.username ||
                (row.changed_by ? `${row.changed_by.slice(0, 8)}…` : "Unknown");
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{actorLabel}</span>
                      <span className="text-muted-foreground">
                        {" "}changed{" "}
                        <span className="font-mono">{row.changed_fields.length}</span>{" "}
                        field{row.changed_fields.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {formatDistanceToNow(new Date(row.changed_at), { addSuffix: true })}
                    </Badge>
                  </div>
                  <div className="grid gap-1">
                    {row.changed_fields.map((field) => (
                      <div
                        key={field}
                        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-mono"
                      >
                        <div className="truncate">
                          <span className="text-muted-foreground">{field}:</span>{" "}
                          <span className="text-muted-foreground line-through">
                            {formatValue(row.old_values?.[field])}
                          </span>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-foreground">
                          {formatValue(row.new_values?.[field])}
                        </span>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminUnderwritingRulesAudit;
