import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Lock, Unlock, CheckCircle2, PenLine, Coins, Loader2, Shield, CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RoadmapLockFlowProps {
  projectId: string;
  project: {
    id: string;
    title: string;
    total_budget: number;
    currency: string;
    is_estimate: boolean;
    user_id: string;
  };
  goals: Array<{
    id: string;
    title: string;
    parent_id: string | null;
    budget_amount: number;
    sort_order: number;
  }> | undefined;
  contract?: {
    id: string;
    client_id: string;
    specialist_id: string;
    status: string;
    total_credits: number;
  } | null;
  collaborators?: Array<{
    id: string;
    user_id: string;
    project_role: string;
    role: string;
  }> | null;
}

const RoadmapLockFlow = ({ projectId, project, goals, contract, collaborators }: RoadmapLockFlowProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [printedName, setPrintedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"upfront" | "per_stage">("upfront");

  const stages = (goals ?? []).filter((g) => !g.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const totalBudget = stages.reduce((sum, s) => sum + (s.budget_amount || 0), 0) || project.total_budget;

  // Check who the client / specialist are
  const specialist = collaborators?.find((c) => (c as any).project_role === "specialist");
  const client = collaborators?.find((c) => (c as any).project_role === "client");
  const isOwner = project.user_id === user?.id;
  const isClient = contract ? user?.id === contract.client_id : (client?.user_id === user?.id || (!specialist && !isOwner));
  const isSpecialist = contract ? user?.id === contract.specialist_id : (specialist?.user_id === user?.id || isOwner);

  // Fetch roadmap-level approvals (goal_id IS NULL = project-level)
  const { data: roadmapApprovals } = useQuery({
    queryKey: ["roadmap-approvals", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_approvals" as any)
        .select("*")
        .eq("project_id", projectId)
        .is("goal_id", null);
      if (error) throw error;
      return data as any[];
    },
  });

  const userApproval = roadmapApprovals?.find((a: any) => a.user_id === user?.id);
  const clientApproval = roadmapApprovals?.find((a: any) => a.role === "client");
  const specialistApproval = roadmapApprovals?.find((a: any) => a.role === "specialist");
  const bothSigned = !!clientApproval && !!specialistApproval;
  const isLocked = contract?.status === "active" || contract?.status === "completed";

  const userRole = isSpecialist ? "specialist" : "client";

  const lockRoadmap = useMutation({
    mutationFn: async () => {
      // 1. Insert project-level approval
      const { error: approvalError } = await supabase.from("project_approvals" as any).insert({
        project_id: projectId,
        user_id: user!.id,
        role: userRole,
        printed_name: printedName.trim(),
        goal_id: null,
      } as any);
      if (approvalError) throw approvalError;

      // 2. Check if both parties have now signed
      const otherRole = userRole === "client" ? "specialist" : "client";
      const { data: otherApprovals } = await supabase
        .from("project_approvals" as any)
        .select("id")
        .eq("project_id", projectId)
        .is("goal_id", null)
        .eq("role", otherRole);

      if (otherApprovals && otherApprovals.length > 0) {
        // Both signed - create contract + milestones
        const specialistId = specialist?.user_id || project.user_id;
        const clientId = client?.user_id || (specialist?.user_id === project.user_id ? user!.id : project.user_id);

        // Create contract
        const { data: newContract, error: contractError } = await supabase
          .from("project_contracts")
          .insert({
            project_id: projectId,
            specialist_id: specialistId,
            client_id: clientId,
            total_credits: totalBudget,
            escrowed_credits: paymentMethod === "upfront" ? totalBudget : 0,
            status: "active",
            notes: `Payment: ${paymentMethod === "upfront" ? "Full upfront" : "Stage-by-stage"}`,
          })
          .select("id")
          .single();
        if (contractError) throw contractError;

        // Create milestones from stages
        const milestonesData = stages.map((stage, i) => ({
          contract_id: newContract.id,
          title: stage.title,
          credit_amount: stage.budget_amount || 0,
          sort_order: i,
          proposed_by: user!.id,
          status: "pending",
        }));

        if (milestonesData.length > 0) {
          const { error: milestoneError } = await supabase
            .from("project_milestones")
            .insert(milestonesData);
          if (milestoneError) throw milestoneError;
        }

        // Update project status
        await supabase
          .from("projects")
          .update({ status: "active", is_estimate: false } as any)
          .eq("id", projectId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap-approvals", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-contract", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setLockDialogOpen(false);
      setPrintedName("");
      setAgreed(false);
      toast.success(
        bothSigned || roadmapApprovals?.some((a: any) => a.role !== userRole)
          ? "Roadmap locked! Contract activated."
          : "Your approval recorded. Waiting for the other party."
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLocked) {
    return (
      <div className="surface-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Roadmap Locked</span>
        </div>
        <p className="text-xs text-muted-foreground">
          This roadmap has been approved by both parties and is now active.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {specialistApproval && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Specialist</p>
              <p className="text-sm italic font-serif text-foreground">{(specialistApproval as any).printed_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date((specialistApproval as any).signed_at), "MMM d, yyyy")}
              </p>
            </div>
          )}
          {clientApproval && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
              <p className="text-sm italic font-serif text-foreground">{(clientApproval as any).printed_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date((clientApproval as any).signed_at), "MMM d, yyyy")}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (stages.length === 0) return null;

  const canSign = !userApproval;

  return (
    <div className="surface-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Lock Roadmap</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Both parties must approve the roadmap to activate the project contract and begin work.
      </p>

      {/* Approval status */}
      <div className="grid grid-cols-2 gap-2">
        <div className={cn(
          "rounded-lg border p-2 text-center",
          specialistApproval ? "border-green-500/30 bg-green-500/5" : "border-dashed border-border"
        )}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Specialist</p>
          {specialistApproval ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mt-1" />
              <p className="text-[10px] text-muted-foreground mt-0.5">{(specialistApproval as any).printed_name}</p>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">Awaiting</p>
          )}
        </div>
        <div className={cn(
          "rounded-lg border p-2 text-center",
          clientApproval ? "border-green-500/30 bg-green-500/5" : "border-dashed border-border"
        )}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
          {clientApproval ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mt-1" />
              <p className="text-[10px] text-muted-foreground mt-0.5">{(clientApproval as any).printed_name}</p>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">Awaiting</p>
          )}
        </div>
      </div>

      {canSign && (
        <Button
          size="sm"
          className="w-full gap-1.5"
          onClick={() => setLockDialogOpen(true)}
        >
          <PenLine className="h-3.5 w-3.5" />
          Approve & Lock Roadmap
        </Button>
      )}

      {userApproval && !bothSigned && (
        <p className="text-xs text-center text-muted-foreground">
          ✓ You've approved. Waiting for the other party.
        </p>
      )}

      {/* Lock Dialog */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Lock Roadmap
            </DialogTitle>
            <DialogDescription>
              You are approving the full roadmap for <strong>{project.title}</strong>.
              Once both parties sign, the contract activates and work can begin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stages</span>
                <span className="font-medium text-foreground">{stages.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Budget</span>
                <span className="font-semibold text-foreground">
                  ${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payment method - only shown to client */}
            {isClient && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Payment Method
                </label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upfront">
                      <div className="flex items-center gap-2">
                        <Coins className="h-3.5 w-3.5" />
                        Full Upfront Escrow
                      </div>
                    </SelectItem>
                    <SelectItem value="per_stage">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5" />
                        Pay Per Stage
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {paymentMethod === "upfront"
                    ? "All credits are locked in escrow upfront and released per milestone approval."
                    : "You'll pay for each stage as it begins. More flexible, but requires action at each stage."}
                </p>
              </div>
            )}

            {/* Print name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Print Name
              </label>
              <Input
                value={printedName}
                onChange={(e) => setPrintedName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            {printedName.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-muted/20 p-4 text-center"
              >
                <p className="text-xl text-foreground" style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}>
                  {printedName}
                </p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize text-[10px]">{userRole}</Badge>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(), "MMMM d, yyyy")}</span>
                </div>
              </motion.div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <Checkbox
                id="agree-lock"
                checked={agreed}
                onCheckedChange={(c) => setAgreed(!!c)}
                className="mt-0.5"
              />
              <label htmlFor="agree-lock" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I confirm I have reviewed all stages, deliverables, and budget allocations. I approve this roadmap to proceed.
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => lockRoadmap.mutate()}
              disabled={!printedName.trim() || !agreed || lockRoadmap.isPending}
              className="gap-1.5"
            >
              {lockRoadmap.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {lockRoadmap.isPending ? "Locking..." : "Lock & Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoadmapLockFlow;
