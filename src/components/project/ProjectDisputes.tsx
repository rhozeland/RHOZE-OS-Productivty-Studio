import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Shield, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ProjectDisputesProps {
  projectId: string;
  contractId?: string;
  milestones?: Array<{ id: string; title: string; status: string; sort_order: number }> | null;
}

const statusColors: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  under_review: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  resolved: "bg-green-500/10 text-green-600 border-green-500/20",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const ProjectDisputes = ({ projectId, contractId, milestones }: ProjectDisputesProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disputeType, setDisputeType] = useState<"stage" | "project">("stage");
  const [selectedMilestone, setSelectedMilestone] = useState<string>("");
  const [reason, setReason] = useState("");

  const { data: disputes } = useQuery({
    queryKey: ["project-disputes", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_disputes")
        .select("*")
        .eq("contract_id", contractId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contractId,
  });

  const fileDispute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_disputes").insert({
        project_id: projectId,
        contract_id: contractId!,
        milestone_id: disputeType === "stage" && selectedMilestone ? selectedMilestone : null,
        filed_by: user!.id,
        dispute_type: disputeType,
        reason: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-disputes", contractId] });
      setDialogOpen(false);
      setReason("");
      setSelectedMilestone("");
      toast.success("Dispute filed. An admin will review it.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!contractId) return null;

  const activeMilestones = milestones?.filter((m) => m.status !== "cancelled") ?? [];
  const openDisputes = disputes?.filter((d) => d.status === "open" || d.status === "under_review") ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">Disputes</span>
          {openDisputes.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
              {openDisputes.length} open
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setDialogOpen(true)}>
          <AlertTriangle className="h-3 w-3" />
          File Dispute
        </Button>
      </div>

      {disputes && disputes.length > 0 ? (
        <div className="space-y-2">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("text-[10px] capitalize", statusColors[d.status])}>
                  {d.status === "under_review" ? "Under Review" : d.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{d.dispute_type}</Badge>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {format(new Date(d.created_at), "MMM d, yyyy")}
                </span>
              </div>
              <p className="text-sm text-foreground">{d.reason}</p>
              {d.resolution_note && (
                <div className="rounded-md bg-muted/40 p-2 mt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resolution</p>
                  <p className="text-xs text-foreground">{d.resolution_note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No disputes filed.</p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              File a Dispute
            </DialogTitle>
            <DialogDescription>
              Disputes are reviewed by the platform admin. Both parties will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
              <Select value={disputeType} onValueChange={(v) => setDisputeType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stage">Stage Dispute</SelectItem>
                  <SelectItem value="project">Full Project Dispute</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {disputeType === "stage" && activeMilestones.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stage</label>
                <Select value={selectedMilestone} onValueChange={setSelectedMilestone}>
                  <SelectTrigger><SelectValue placeholder="Select a stage..." /></SelectTrigger>
                  <SelectContent>
                    {activeMilestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>Stage {m.sort_order + 1}: {m.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the issue in detail..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => fileDispute.mutate()}
              disabled={!reason.trim() || fileDispute.isPending}
              className="gap-1.5"
            >
              {fileDispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDisputes;
