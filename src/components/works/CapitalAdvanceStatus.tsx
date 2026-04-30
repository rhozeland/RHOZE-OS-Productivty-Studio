/**
 * CapitalAdvanceStatus — Phase 5 status & audit trail panel.
 *
 * Lists every advance request the seller has filed, surfaces the current
 * status with a clear visual stage indicator (submitted → under review →
 * approved → funded, with reject/cancel terminal states), exposes the full
 * append-only event timeline, and lets the seller cancel a request that is
 * still pending review.
 *
 * Status changes themselves come from admins (via the status-change trigger);
 * this panel is the seller's read-only window plus a single user action
 * (cancel). Everything is RLS-scoped to the requester.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Banknote,
  Loader2,
  ChevronDown,
  CheckCircle2,
  Clock,
  Eye,
  XCircle,
  CircleSlash,
  CircleDashed,
  Sparkles,
} from "lucide-react";

interface Props {
  userId: string;
}

type Status =
  | "submitted"
  | "under_review"
  | "approved"
  | "funded"
  | "rejected"
  | "cancelled";

interface AdvanceRequest {
  id: string;
  user_id: string;
  requested_amount: number;
  funded_amount: number | null;
  status: Status;
  collateral_score: number | null;
  signal_snapshot: any;
  applicant_note: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
  funded_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdvanceEvent {
  id: string;
  request_id: string;
  actor_id: string | null;
  event_type: string;
  from_status: Status | null;
  to_status: Status | null;
  note: string | null;
  metadata: any;
  created_at: string;
}

const fmt = (v: number) =>
  `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const STAGES: Array<{ key: Status; label: string }> = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Review" },
  { key: "approved", label: "Approved" },
  { key: "funded", label: "Funded" },
];

const STATUS_META: Record<
  Status,
  { label: string; icon: typeof Clock; tone: string }
> = {
  submitted: { label: "Submitted", icon: Clock, tone: "text-muted-foreground" },
  under_review: { label: "Under review", icon: Eye, tone: "text-blue-500" },
  approved: { label: "Approved", icon: CheckCircle2, tone: "text-emerald-500" },
  funded: { label: "Funded", icon: Sparkles, tone: "text-primary" },
  rejected: { label: "Rejected", icon: XCircle, tone: "text-destructive" },
  cancelled: { label: "Cancelled", icon: CircleSlash, tone: "text-muted-foreground" },
};

const stageIndex = (status: Status): number => {
  if (status === "rejected" || status === "cancelled") return -1;
  const idx = STAGES.findIndex((s) => s.key === status);
  return idx;
};

const StageMeter = ({ status }: { status: Status }) => {
  const current = stageIndex(status);
  const terminalBad = status === "rejected" || status === "cancelled";

  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((stage, i) => {
        const reached = !terminalBad && current >= i;
        return (
          <div key={stage.key} className="flex items-center gap-1.5 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  reached
                    ? i === current
                      ? "bg-primary"
                      : "bg-emerald-500/70"
                    : "bg-muted"
                }`}
              />
              <span
                className={`text-[9px] uppercase tracking-wider font-medium ${
                  reached ? "text-foreground" : "text-muted-foreground/60"
                }`}
              >
                {stage.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RequestCard = ({
  request,
  events,
  onCancel,
  cancelling,
}: {
  request: AdvanceRequest;
  events: AdvanceEvent[];
  onCancel: (id: string) => void;
  cancelling: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[request.status];
  const Icon = meta.icon;
  const canCancel =
    request.status === "submitted" || request.status === "under_review";

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xl font-bold tracking-tight tabular-nums">
              {fmt(request.requested_amount)}
            </p>
            <Badge variant="outline" className={`gap-1 text-[10px] ${meta.tone}`}>
              <Icon className="h-3 w-3" />
              {meta.label}
            </Badge>
            {request.collateral_score != null && (
              <Badge variant="outline" className="font-mono text-[10px]">
                score {request.collateral_score}/100
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Filed {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
            {request.funded_amount != null && request.status === "funded" && (
              <span className="text-emerald-500 font-medium">
                {" · funded "}
                {fmt(request.funded_amount)}
              </span>
            )}
          </p>
        </div>
        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-8"
            onClick={() => onCancel(request.id)}
            disabled={cancelling}
          >
            {cancelling ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <CircleSlash className="h-3 w-3 mr-1" />
            )}
            Cancel
          </Button>
        )}
      </div>

      <StageMeter status={request.status} />

      {request.admin_note && (
        <div className="rounded-lg bg-muted/40 border border-border/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
            Note from review team
          </p>
          <p className="text-xs">{request.admin_note}</p>
        </div>
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground"
          >
            <ChevronDown
              className={`h-3 w-3 mr-1 transition-transform ${open ? "rotate-180" : ""}`}
            />
            Audit trail · {events.length} event{events.length === 1 ? "" : "s"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <ol className="space-y-2 border-l border-border/60 pl-4 ml-1">
            {events.length === 0 ? (
              <li className="text-xs text-muted-foreground">No events yet.</li>
            ) : (
              events.map((ev) => {
                const transitionTo = ev.to_status
                  ? STATUS_META[ev.to_status]?.label
                  : null;
                return (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary/70" />
                    <p className="text-xs font-medium text-foreground">
                      {ev.event_type === "submitted" && "Request submitted"}
                      {ev.event_type === "status_change" &&
                        `Status → ${transitionTo ?? ev.to_status}`}
                      {ev.event_type === "cancelled" && "Cancelled by you"}
                      {ev.event_type === "note_added" && "Note added"}
                      {!["submitted", "status_change", "cancelled", "note_added"].includes(
                        ev.event_type,
                      ) && ev.event_type}
                    </p>
                    {ev.note && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{ev.note}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                      {format(new Date(ev.created_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  </li>
                );
              })
            )}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

const CapitalAdvanceStatus = ({ userId }: Props) => {
  const qc = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["capital-advance-requests", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("capital_advance_requests")
        .select(
          "id, user_id, requested_amount, funded_amount, status, collateral_score, signal_snapshot, applicant_note, admin_note, reviewed_at, funded_at, created_at, updated_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AdvanceRequest[];
    },
    enabled: !!userId,
  });

  const requestIds = (requests || []).map((r) => r.id);

  const { data: events } = useQuery({
    queryKey: ["capital-advance-events", requestIds.join(",")],
    queryFn: async () => {
      if (requestIds.length === 0) return [] as AdvanceEvent[];
      const { data, error } = await (supabase as any)
        .from("capital_advance_events")
        .select("*")
        .in("request_id", requestIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as AdvanceEvent[];
    },
    enabled: requestIds.length > 0,
  });

  useEffect(() => {
    const handler = () => {
      qc.invalidateQueries({ queryKey: ["capital-advance-requests", userId] });
    };
    window.addEventListener("capital-advance:created", handler);
    return () => window.removeEventListener("capital-advance:created", handler);
  }, [qc, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`capital-advance-${userId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "capital_advance_requests", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["capital-advance-requests", userId] });
          qc.invalidateQueries({ queryKey: ["capital-advance-events"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, userId]);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("capital_advance_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request cancelled");
      qc.invalidateQueries({ queryKey: ["capital-advance-requests", userId] });
    },
    onError: (e: any) => toast.error(e.message || "Could not cancel"),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading advance requests…
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" />
            Advance Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <CircleDashed className="h-4 w-4" />
            No advance requests yet. Submit one from the panel above when you're ready.
          </div>
        </CardContent>
      </Card>
    );
  }

  const eventsByRequest = new Map<string, AdvanceEvent[]>();
  (events || []).forEach((ev) => {
    if (!eventsByRequest.has(ev.request_id)) eventsByRequest.set(ev.request_id, []);
    eventsByRequest.get(ev.request_id)!.push(ev);
  });

  const active = requests.filter((r) =>
    ["submitted", "under_review", "approved", "funded"].includes(r.status),
  ).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" />
            Advance Requests
          </span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {requests.length} total · {active} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((req) => (
          <RequestCard
            key={req.id}
            request={req}
            events={eventsByRequest.get(req.id) || []}
            onCancel={(id) => cancelMutation.mutate(id)}
            cancelling={cancelMutation.isPending}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default CapitalAdvanceStatus;
