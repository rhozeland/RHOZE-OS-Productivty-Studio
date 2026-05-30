/**
 * ProjectScopeReview — Square-invoice-style scope screen.
 *
 * Rendered above the roadmap inside `ProjectDetailPage` whenever the
 * contract is still in `draft` state. Lists every top-level milestone
 * as a line item, shows subtotal · Rhozeland fee · total, and gives
 * each party a single "Accept scope" button. Acceptance is stamped on
 * `project_approvals.scope_accepted_at` and gates the existing
 * RoadmapLockFlow (which still handles actual signing + escrow).
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  projectId: string;
  projectTitle: string;
  goals: Array<{
    id: string; title: string; description?: string | null; parent_id: string | null;
    budget_amount: number; sort_order: number;
  }> | undefined;
  contract: {
    id: string; client_id: string; specialist_id: string; status: string;
  } | null | undefined;
  collaborators?: Array<{
    user_id: string; project_role?: string; role?: string;
  }> | null;
  ownerId: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export const ProjectScopeReview = ({
  projectId, projectTitle, goals, contract, collaborators, ownerId,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const stages = useMemo(
    () => (goals ?? [])
      .filter((g) => !g.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order),
    [goals],
  );

  const subtotal = stages.reduce((s, g) => s + Number(g.budget_amount ?? 0), 0);
  const feePct = 0.10;
  const fee = Math.round(subtotal * feePct * 100) / 100;
  const total = subtotal; // client pays subtotal; fee is taken from creator side at payout
  const creatorTake = Math.max(0, subtotal - fee);

  const specialist = collaborators?.find((c) => c.project_role === "specialist");
  const client = collaborators?.find((c) => c.project_role === "client");

  const isClient = contract ? user?.id === contract.client_id : (client?.user_id === user?.id);
  const isSpecialist = contract ? user?.id === contract.specialist_id
    : (specialist?.user_id === user?.id || ownerId === user?.id);
  const userRole: "client" | "specialist" | null =
    isSpecialist ? "specialist" : isClient ? "client" : null;

  const { data: approvals } = useQuery({
    queryKey: ["scope-approvals", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_approvals" as any)
        .select("*")
        .eq("project_id", projectId)
        .is("goal_id", null);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const myAccepted = approvals?.find((a: any) =>
    a.user_id === user?.id && a.scope_accepted_at,
  );
  const clientAccepted = approvals?.find((a: any) =>
    a.role === "client" && a.scope_accepted_at,
  );
  const specialistAccepted = approvals?.find((a: any) =>
    a.role === "specialist" && a.scope_accepted_at,
  );
  const bothAccepted = !!clientAccepted && !!specialistAccepted;
  const isLocked = contract?.status === "active" || contract?.status === "completed";

  const accept = useMutation({
    mutationFn: async () => {
      if (!userRole) throw new Error("You're not part of this project");
      // Upsert: find existing row for this user/role/null-goal, else insert.
      const { data: existing } = await supabase
        .from("project_approvals" as any)
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user!.id)
        .is("goal_id", null)
        .maybeSingle();

      const existingId = (existing as any)?.id as string | undefined;
      if (existingId) {
        const { error } = await supabase
          .from("project_approvals" as any)
          .update({ scope_accepted_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_approvals" as any)
          .insert({
            project_id: projectId,
            user_id: user!.id,
            role: userRole,
            goal_id: null,
            // Placeholder printed_name so the existing column accepts the row;
            // RoadmapLockFlow still requires real signature ceremony.
            printed_name: "(scope acknowledged)",
            scope_accepted_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scope-approvals", projectId] });
      toast.success("Scope accepted — you can now sign the roadmap.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLocked) return null;
  if (stages.length === 0) return null;
  if (!userRole) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-foreground">{projectTitle}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Created {format(new Date(), "MMMM d, yyyy")} · Review and accept before signing
            </p>
          </div>
          <Badge variant={bothAccepted ? "default" : "outline"} className="gap-1 text-[10px]">
            {bothAccepted ? <CheckCircle2 className="h-3 w-3" /> : <FileSignature className="h-3 w-3" />}
            {bothAccepted ? "Scope accepted" : "Awaiting acceptance"}
          </Badge>
        </div>
      </div>

      {/* Line items */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</div>
          {stages.map((g, i) => (
            <div key={g.id} className="contents">
              <div className="border-t border-border/60 pt-3">
                <p className="font-semibold text-foreground">
                  <span className="text-muted-foreground mr-1.5">{i + 1}.</span>{g.title}
                </p>
                {g.description && (
                  <p className="text-xs text-muted-foreground italic mt-1 whitespace-pre-line">{g.description}</p>
                )}
              </div>
              <div className="border-t border-border/60 pt-3 text-right tabular-nums font-medium text-foreground">
                {fmt(Number(g.budget_amount ?? 0))}
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums text-foreground">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Rhozeland fee (10%, deducted from creator payout)</span>
            <span className="tabular-nums text-muted-foreground">−{fmt(fee)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span className="text-foreground">Total (client pays)</span>
            <span className="font-display text-xl tabular-nums text-foreground">{fmt(total)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Creator receives</span>
            <span className="tabular-nums text-foreground font-medium">{fmt(creatorTake)}</span>
          </div>
        </div>
      </div>

      {/* Acceptance row */}
      <div className="border-t border-border/60 bg-muted/20 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            {specialistAccepted ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <span className="h-3 w-3 rounded-full border border-muted-foreground/40" />}
            <span className={specialistAccepted ? "text-foreground" : "text-muted-foreground"}>Creator</span>
          </div>
          <div className="flex items-center gap-1.5">
            {clientAccepted ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <span className="h-3 w-3 rounded-full border border-muted-foreground/40" />}
            <span className={clientAccepted ? "text-foreground" : "text-muted-foreground"}>Client</span>
          </div>
        </div>

        {myAccepted ? (
          <Badge variant="outline" className="gap-1 text-[11px] self-start sm:self-auto">
            <CheckCircle2 className="h-3 w-3 text-green-600" /> You accepted
          </Badge>
        ) : (
          <Button size="sm" className="gap-1.5" disabled={accept.isPending} onClick={() => accept.mutate()}>
            {accept.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSignature className="h-3.5 w-3.5" />}
            Accept scope
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProjectScopeReview;
