/**
 * AdminUnderwritingRulesAudit — admin-only history viewer for changes
 * to the Capital scoring rules. Reads from `capital_underwriting_rules_audit`
 * (populated by a SECURITY DEFINER trigger so users can't forge entries).
 *
 * Each row shows who saved the change, when, and a per-field before → after
 * diff so reviewers can audit underwriting decisions retroactively.
 *
 * Includes client-side search + filters: by admin, date range, and changed field.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, History, ArrowRight, Search, X } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["capital-underwriting-rules-audit"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data: rows, error } = await (supabase as any)
        .from("capital_underwriting_rules_audit")
        .select("id, changed_by, changed_at, old_values, new_values, changed_fields")
        .order("changed_at", { ascending: false })
        .limit(200);
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

  // Derive filter option lists from loaded data
  const actorOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((r) => {
      if (!r.changed_by) return;
      const label =
        r.actor?.display_name ||
        r.actor?.username ||
        `${r.changed_by.slice(0, 8)}…`;
      map.set(r.changed_by, label);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const fieldOptions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => r.changed_fields.forEach((f) => set.add(f)));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null; // include end day
    return data.filter((r) => {
      if (actorFilter !== "all" && r.changed_by !== actorFilter) return false;
      if (fieldFilter !== "all" && !r.changed_fields.includes(fieldFilter)) return false;
      const ts = new Date(r.changed_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts >= toTs) return false;
      if (q) {
        const actorLabel = (
          r.actor?.display_name ||
          r.actor?.username ||
          r.changed_by ||
          ""
        ).toLowerCase();
        const fieldsBlob = r.changed_fields.join(" ").toLowerCase();
        if (!actorLabel.includes(q) && !fieldsBlob.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, actorFilter, fieldFilter, dateFrom, dateTo]);

  const hasActiveFilters =
    search !== "" ||
    actorFilter !== "all" ||
    fieldFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearFilters = () => {
    setSearch("");
    setActorFilter("all");
    setFieldFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Underwriting Rules — Change History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter controls */}
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by admin name or field…"
              className="pl-8 h-9"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Admin</Label>
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All admins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All admins</SelectItem>
                  {actorOptions.map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Changed field</Label>
              <Select value={fieldFilter} onValueChange={setFieldFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All fields" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All fields</SelectItem>
                  {fieldOptions.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                Showing {filtered.length} of {data?.length ?? 0} entries
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" /> Clear filters
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes recorded yet. The next save will be the first audit entry.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entries match the current filters.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((row) => {
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
