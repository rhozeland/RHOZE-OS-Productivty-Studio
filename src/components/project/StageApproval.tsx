import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  PenLine,
  CheckCircle2,
  Clock,
  User,
  X,
  Coins,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StageApprovalProps {
  goalId: string;
  projectId: string;
  projectTitle: string;
  stageTitle: string;
  stageComplete: boolean;
  /** For paid projects: contract + milestone info */
  contract?: {
    id: string;
    client_id: string;
    specialist_id: string;
    status: string;
  } | null;
  milestone?: {
    id: string;
    credit_amount: number;
    status: string;
  } | null;
}

interface Approval {
  id: string;
  project_id: string;
  goal_id: string;
  user_id: string;
  role: string;
  printed_name: string;
  signed_at: string;
}

const StageApproval = ({
  goalId,
  projectId,
  projectTitle,
  stageTitle,
  stageComplete,
  contract,
  milestone,
}: StageApprovalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [printedName, setPrintedName] = useState("");
  const [agreed, setAgreed] = useState(false);

  const isPaid = !!contract;
  const milestoneApproved = milestone?.status === "approved";

  // Fetch stage-level approvals
  const { data: approvals } = useQuery({
    queryKey: ["stage-approvals", goalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_approvals" as any)
        .select("*")
        .eq("goal_id", goalId)
        .order("signed_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Approval[];
    },
  });

  // Determine user role
  const { data: project } = useQuery({
    queryKey: ["project-owner-check", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("user_id")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const isOwner = project?.user_id === user?.id;
  const isClient = contract ? user?.id === contract.client_id : !isOwner;
  const isSpecialist = contract ? user?.id === contract.specialist_id : isOwner;
  const userRole = isSpecialist ? "specialist" : "client";

  const userApproval = approvals?.find((a) => a.user_id === user?.id);
  const hasUserSigned = !!userApproval;

  const clientApprovals = approvals?.filter((a) => a.role === "client") ?? [];
  const specialistApprovals = approvals?.filter((a) => a.role === "specialist") ?? [];
  const bothSigned = clientApprovals.length > 0 && specialistApprovals.length > 0;

  const signApproval = useMutation({
    mutationFn: async () => {
      // Insert approval
      const { error } = await supabase.from("project_approvals" as any).insert({
        project_id: projectId,
        goal_id: goalId,
        user_id: user!.id,
        role: userRole,
        printed_name: printedName.trim(),
      } as any);
      if (error) throw error;

      // Check if this completes both-party approval for paid projects
      // After inserting, check if both sides are now signed
      if (isPaid && milestone && milestone.status === "submitted") {
        const otherRole = userRole === "client" ? "specialist" : "client";
        const { data: otherApprovals } = await supabase
          .from("project_approvals" as any)
          .select("id")
          .eq("goal_id", goalId)
          .eq("role", otherRole);

        if (otherApprovals && otherApprovals.length > 0 && userRole === "client") {
          // Client is the final approver — release milestone credits
          const { error: releaseError } = await supabase.rpc("release_milestone_credits", {
            _milestone_id: milestone.id,
            _approver_id: user!.id,
          });
          if (releaseError) throw releaseError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-approvals", goalId] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["project-contract"] });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      setSignDialogOpen(false);
      setPrintedName("");
      setAgreed(false);
      toast.success("Stage approved!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeApproval = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_approvals" as any)
        .delete()
        .eq("goal_id", goalId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-approvals", goalId] });
      toast.success("Approval revoked");
    },
  });

  // Don't show approval UI if stage has no tasks completed
  if (!stageComplete && !bothSigned && (approvals?.length ?? 0) === 0) {
    return null;
  }

  const roleColors: Record<string, string> = {
    client: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    specialist: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  };

  return (
    <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Stage Approval
          </span>
        </div>
        {bothSigned && (
          <Badge
            variant="outline"
            className="gap-1 text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
          >
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        )}
        {isPaid && milestone && !milestoneApproved && (
          <Badge variant="secondary" className="gap-1 text-[10px] font-mono">
            <Coins className="h-3 w-3" />
            {milestone.credit_amount} cr
          </Badge>
        )}
        {isPaid && milestoneApproved && (
          <Badge
            variant="outline"
            className="gap-1 text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
          >
            <Coins className="h-3 w-3" />
            {milestone!.credit_amount} cr released
          </Badge>
        )}
      </div>

      {/* Approval status */}
      <div className="grid grid-cols-2 gap-3">
        {/* Specialist */}
        <MiniSignature
          label="Specialist"
          approvals={specialistApprovals}
          isCurrentRole={userRole === "specialist"}
          hasUserSigned={hasUserSigned}
          stageComplete={stageComplete}
          onSign={() => setSignDialogOpen(true)}
          onRevoke={() => revokeApproval.mutate()}
          currentUserId={user?.id}
          isPaid={isPaid}
          milestoneStatus={milestone?.status}
        />
        {/* Client */}
        <MiniSignature
          label="Client"
          approvals={clientApprovals}
          isCurrentRole={userRole === "client"}
          hasUserSigned={hasUserSigned}
          stageComplete={stageComplete}
          onSign={() => setSignDialogOpen(true)}
          onRevoke={() => revokeApproval.mutate()}
          currentUserId={user?.id}
          isPaid={isPaid}
          milestoneStatus={milestone?.status}
        />
      </div>

      {/* Sign Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Approve Stage</DialogTitle>
            <DialogDescription>
              You are approving <strong>{stageTitle}</strong> for the project{" "}
              <strong>{projectTitle}</strong>.
              {isPaid && milestone && (
                <>
                  {" "}
                  This stage has <strong>{milestone.credit_amount} credits</strong> attached.
                  {userRole === "client" && specialistApprovals.length > 0 && (
                    <> Credits will be released to the specialist upon your approval.</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (printedName.trim() && agreed) signApproval.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Print Name
              </label>
              <Input
                value={printedName}
                onChange={(e) => setPrintedName(e.target.value)}
                placeholder="Your full name"
                required
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Signing as</span>
              <Badge variant="outline" className={cn("capitalize text-xs", roleColors[userRole])}>
                {userRole}
              </Badge>
            </div>

            {printedName.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-muted/20 p-4 text-center"
              >
                <p
                  className="text-xl text-foreground"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: "italic" }}
                >
                  {printedName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(), "MMMM d, yyyy")}
                </p>
              </motion.div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <Checkbox
                id={`agree-${goalId}`}
                checked={agreed}
                onCheckedChange={(c) => setAgreed(!!c)}
                className="mt-0.5"
              />
              <label
                htmlFor={`agree-${goalId}`}
                className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
              >
                I confirm I have reviewed the deliverables for this stage and approve it to proceed.
              </label>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!printedName.trim() || !agreed || signApproval.isPending}
            >
              {signApproval.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenLine className="h-4 w-4" />
              )}
              {signApproval.isPending ? "Signing..." : "Sign & Approve"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Mini Signature Display ───────────────────────────
interface MiniSignatureProps {
  label: string;
  approvals: Approval[];
  isCurrentRole: boolean;
  hasUserSigned: boolean;
  stageComplete: boolean;
  onSign: () => void;
  onRevoke: () => void;
  currentUserId?: string;
  isPaid: boolean;
  milestoneStatus?: string;
}

const MiniSignature = ({
  label,
  approvals,
  isCurrentRole,
  hasUserSigned,
  stageComplete,
  onSign,
  onRevoke,
  currentUserId,
  isPaid,
  milestoneStatus,
}: MiniSignatureProps) => {
  const hasSigned = approvals.length > 0;

  // For paid projects, specialist must submit milestone first
  const canSign =
    isCurrentRole &&
    !hasUserSigned &&
    stageComplete &&
    (!isPaid || milestoneStatus === "submitted" || milestoneStatus === "pending" || !milestoneStatus);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all",
        hasSigned
          ? "border-green-500/30 bg-green-500/5"
          : "border-dashed border-border bg-muted/5"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {hasSigned ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </div>

      {hasSigned ? (
        approvals.map((a) => {
          const isOwn = a.user_id === currentUserId;
          return (
            <div key={a.id} className="space-y-0.5">
              <p
                className="text-sm text-foreground"
                style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}
              >
                {a.printed_name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(a.signed_at), "MMM d, yyyy")}
              </p>
              {isOwn && (
                <button
                  onClick={onRevoke}
                  className="text-[10px] text-destructive hover:underline flex items-center gap-0.5 mt-1"
                >
                  <X className="h-2.5 w-2.5" /> Revoke
                </button>
              )}
            </div>
          );
        })
      ) : (
        <div className="text-center py-1">
          <p className="text-[10px] text-muted-foreground">Awaiting</p>
          {canSign && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-7 text-xs gap-1"
              onClick={onSign}
            >
              <PenLine className="h-3 w-3" />
              Sign
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default StageApproval;
