/**
 * AdminConciergeRequests — admin inbox for Phase 1 Concierge SKU.
 *
 * Lists incoming `concierge_requests`, lets the operator move them through the
 * status workflow and attach scoped budget + proposal notes. Phase 2 will
 * wire "Convert to project" → creates a project with intake_tier='concierge'
 * and platform_fee_bps_override=2500.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Sparkles, Mail, Calendar, DollarSign, Tag } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Status = "new" | "reviewing" | "scoped" | "converted" | "declined" | "closed";

const STATUS_META: Record<Status, { label: string; tone: string }> = {
  new: { label: "New", tone: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  reviewing: { label: "Reviewing", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  scoped: { label: "Scoped", tone: "bg-violet-500/10 text-violet-600 border-violet-500/30" },
  converted: { label: "Converted", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  declined: { label: "Declined", tone: "bg-muted text-muted-foreground border-border" },
  closed: { label: "Closed", tone: "bg-muted text-muted-foreground border-border" },
};

export default function AdminConciergeRequests() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-concierge-requests", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("concierge_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = rows?.find((r: any) => r.id === activeId);

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase
      .from("concierge_requests")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${STATUS_META[status].label}`);
    qc.invalidateQueries({ queryKey: ["admin-concierge-requests"] });
  };

  const saveProposal = async (
    id: string,
    payload: { proposal_notes?: string; scoped_budget_cents?: number | null },
  ) => {
    const { error } = await supabase
      .from("concierge_requests")
      .update(payload)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Proposal saved");
    qc.invalidateQueries({ queryKey: ["admin-concierge-requests"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-foreground" />
          <h2 className="font-display text-lg font-semibold">Concierge inbox</h2>
        </div>
        <div className="flex gap-1.5">
          {(["all", "new", "reviewing", "scoped", "converted", "declined"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as any)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : STATUS_META[s as Status].label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading requests…</div>
      )}

      {!isLoading && (rows?.length ?? 0) === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No requests yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Concierge briefs land here. Promote the SupportSheet "Work together"
            tab to drive intake.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {rows?.map((r: any) => {
          const meta = STATUS_META[r.status as Status];
          return (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <Badge variant="outline" className={`${meta.tone} text-[10px]`}>
                  {meta.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-foreground line-clamp-2 mb-2">
                {r.summary}
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {r.category && (
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3 w-3" /> {r.category}
                  </span>
                )}
                {r.budget_range && (
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> {r.budget_range}
                  </span>
                )}
                {r.deadline && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {r.deadline}
                  </span>
                )}
                {r.contact_email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {r.contact_email}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Sheet
        open={!!activeId}
        onOpenChange={(o) => !o && setActiveId(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {active && (
            <RequestDetail
              key={active.id}
              row={active}
              onSetStatus={(s) => setStatus(active.id, s)}
              onSaveProposal={(p) => saveProposal(active.id, p)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RequestDetail({
  row,
  onSetStatus,
  onSaveProposal,
}: {
  row: any;
  onSetStatus: (s: Status) => void;
  onSaveProposal: (p: { proposal_notes?: string; scoped_budget_cents?: number | null }) => void;
}) {
  const [notes, setNotes] = useState<string>(row.proposal_notes ?? "");
  const [budgetUsd, setBudgetUsd] = useState<string>(
    row.scoped_budget_cents != null ? String(row.scoped_budget_cents / 100) : "",
  );
  const meta = STATUS_META[row.status as Status];

  return (
    <>
      <SheetHeader className="text-left">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className={`${meta.tone} text-[10px]`}>
            {meta.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </span>
        </div>
        <SheetTitle className="font-display text-lg">Concierge request</SheetTitle>
      </SheetHeader>

      <div className="mt-5 space-y-5 text-sm">
        <section>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Outcome wanted
          </p>
          <p className="text-foreground whitespace-pre-wrap">{row.summary}</p>
        </section>

        {row.outcome && (
          <section>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Success metric
            </p>
            <p className="text-foreground">{row.outcome}</p>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Category" value={row.category ?? "—"} />
          <Field label="Budget range" value={row.budget_range ?? "—"} />
          <Field label="Deadline" value={row.deadline ?? "—"} />
          <Field label="Contact" value={row.contact_email ?? "—"} />
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Scoped proposal
          </p>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Scoped budget (USD)
            </label>
            <Input
              type="number"
              min={0}
              step={50}
              placeholder="e.g. 4500"
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Proposal notes (internal)
            </label>
            <Textarea
              placeholder="Suggested creators, timeline, scope, risks…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() =>
              onSaveProposal({
                proposal_notes: notes || null,
                scoped_budget_cents: budgetUsd
                  ? Math.round(Number(budgetUsd) * 100)
                  : null,
              } as any)
            }
          >
            Save proposal
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {(["reviewing", "scoped", "converted", "declined", "closed"] as Status[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={row.status === s ? "default" : "outline"}
              className="rounded-full text-xs"
              onClick={() => onSetStatus(s)}
            >
              Mark {STATUS_META[s].label}
            </Button>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Phase 2 will add a one-click "Convert to project" that creates a
          project with intake_tier='concierge' and a 25% fee override.
        </p>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
