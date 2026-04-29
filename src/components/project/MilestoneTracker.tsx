import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  Send,
  ThumbsUp,
  XCircle,
  Coins,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MilestoneTrackerProps {
  contractId: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground", icon: Circle },
  submitted: { label: "Submitted", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", icon: Send },
  approved: { label: "Approved", color: "bg-green-500/15 text-green-600 dark:text-green-400", icon: CheckCircle2 },
  rejected: { label: "Revision Needed", color: "bg-destructive/15 text-destructive", icon: XCircle },
};

const MilestoneTracker = ({ contractId }: MilestoneTrackerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitNote, setSubmitNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [activeDialog, setActiveDialog] = useState<{ type: "submit" | "approve" | "reject"; milestoneId: string } | null>(null);

  const { data: contract } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contracts")
        .select("*")
        .eq("id", contractId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: milestones, isLoading } = useQuery({
    queryKey: ["milestones", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_milestones")
        .select("*")
        .eq("contract_id", contractId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const isClient = user?.id === contract?.client_id;
  const isSpecialist = user?.id === contract?.specialist_id;

  const submitMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const { error } = await supabase
        .from("project_milestones")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          description: submitNote || undefined,
        })
        .eq("id", milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones", contractId] });
      toast.success("Milestone submitted for review!");
      setActiveDialog(null);
      setSubmitNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const milestone = milestones.find((m) => m.id === milestoneId);
      const { error } = await supabase.rpc("release_milestone_credits", {
        _milestone_id: milestoneId,
        _approver_id: user!.id,
      });
      if (error) throw error;

      // After successful release, fire revenue split if a config exists for this contract.
      let splitResult: { creator: number; curator: number; buyback: number; solana_signature: string | null } | null = null;
      try {
        const { data: splitConfig } = await supabase
          .from("revenue_split_configs")
          .select("id")
          .eq("contract_id", contractId)
          .eq("is_active", true)
          .maybeSingle();

        if (splitConfig?.id && milestone?.credit_amount) {
          const { data } = await supabase.functions.invoke("split-revenue", {
            body: {
              config_id: splitConfig.id,
              total_amount: Number(milestone.credit_amount),
              purchase_id: milestoneId,
            },
          });
          if (data?.splits) {
            splitResult = { ...data.splits, solana_signature: data.solana_signature ?? null };
          }
        }
      } catch (splitErr) {
        console.warn("Split distribution failed (non-fatal):", splitErr);
      }
      return { splitResult, amount: Number(milestone?.credit_amount ?? 0) };
    },
    onSuccess: ({ splitResult, amount }) => {
      queryClient.invalidateQueries({ queryKey: ["milestones", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      setActiveDialog(null);

      if (splitResult) {
        const lines: string[] = [];
        if (splitResult.creator > 0) lines.push(`Creator +${splitResult.creator}`);
        if (splitResult.curator > 0) lines.push(`Curator +${splitResult.curator}`);
        if (splitResult.buyback > 0) lines.push(`Buyback +${splitResult.buyback}`);
        toast.success(`💸 ${amount} credits released & split`, {
          description: lines.join(" · ") + (splitResult.solana_signature ? "  ·  on-chain ✓" : ""),
          duration: 6000,
        });
      } else {
        toast.success(`💸 ${amount} credits released to specialist`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const { error } = await supabase
        .from("project_milestones")
        .update({
          status: "rejected",
          description: rejectNote
            ? `Revision requested: ${rejectNote}`
            : "Revision requested by client",
        })
        .eq("id", milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones", contractId] });
      toast.info("Revision requested. Specialist will be notified.");
      setActiveDialog(null);
      setRejectNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading milestones...
      </div>
    );
  }

  if (!milestones || milestones.length === 0) {
    return (
      <div className="surface-card p-6">
        <h3 className="font-display text-lg font-semibold text-foreground mb-2">Milestones</h3>
        <p className="text-sm text-muted-foreground">No milestones have been created for this contract yet.</p>
      </div>
    );
  }

  const totalCredits = milestones.reduce((sum, m) => sum + m.credit_amount, 0);
  const releasedCredits = milestones
    .filter((m) => m.status === "approved")
    .reduce((sum, m) => sum + m.credit_amount, 0);

  return (
    <div className="surface-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-foreground">Milestones</h3>
        <div className="flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4 text-accent" />
          <span className="text-muted-foreground">
            {releasedCredits}/{totalCredits} credits released
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          initial={{ width: 0 }}
          animate={{ width: totalCredits > 0 ? `${(releasedCredits / totalCredits) * 100}%` : "0%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {/* Milestone list */}
      <div className="space-y-3">
        {milestones.map((milestone, i) => {
          const config = statusConfig[milestone.status] || statusConfig.pending;
          const Icon = config.icon;

          return (
            <motion.div
              key={milestone.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{milestone.title}</p>
                    {milestone.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{milestone.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={config.color}>
                    {config.label}
                  </Badge>
                  <Badge variant="secondary" className="font-mono">
                    {milestone.credit_amount} cr
                  </Badge>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pl-8">
                {/* Specialist: Submit work */}
                {isSpecialist && (milestone.status === "pending" || milestone.status === "rejected") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveDialog({ type: "submit", milestoneId: milestone.id })}
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Submit Work
                  </Button>
                )}

                {/* Client: Approve */}
                {isClient && milestone.status === "submitted" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setActiveDialog({ type: "approve", milestoneId: milestone.id })}
                      className="gap-1.5"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Approve & Release
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveDialog({ type: "reject", milestoneId: milestone.id })}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Request Revision
                    </Button>
                  </>
                )}

                {/* Approved indicator */}
                {milestone.status === "approved" && milestone.approved_at && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Approved {new Date(milestone.approved_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Submit Dialog */}
      <Dialog open={activeDialog?.type === "submit"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Milestone</DialogTitle>
            <DialogDescription>
              Submit this milestone for client review. Add an optional note about the work completed.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe what was completed..."
            value={submitNote}
            onChange={(e) => setSubmitNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button
              onClick={() => activeDialog && submitMilestone.mutate(activeDialog.milestoneId)}
              disabled={submitMilestone.isPending}
            >
              {submitMilestone.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={activeDialog?.type === "approve"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Milestone</DialogTitle>
            <DialogDescription>
              This will release the escrowed credits to the specialist. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-700 dark:text-green-400">
            <p className="font-medium flex items-center gap-2">
              <Coins className="h-4 w-4" />
              {milestones.find((m) => m.id === activeDialog?.milestoneId)?.credit_amount} credits will be released
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button
              onClick={() => activeDialog && approveMilestone.mutate(activeDialog.milestoneId)}
              disabled={approveMilestone.isPending}
            >
              {approveMilestone.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
              Approve & Release Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={activeDialog?.type === "reject"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              Let the specialist know what needs to be changed before you can approve.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe what needs revision..."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => activeDialog && rejectMilestone.mutate(activeDialog.milestoneId)}
              disabled={rejectMilestone.isPending}
            >
              {rejectMilestone.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              Request Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MilestoneTracker;
