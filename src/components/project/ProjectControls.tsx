import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, FastForward, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

interface ProjectControlsProps {
  projectId: string;
  contractId?: string;
  contractStatus?: string;
  isClient?: boolean;
  isSpecialist?: boolean;
}

const ProjectControls = ({ projectId, contractId, contractStatus, isClient, isSpecialist }: ProjectControlsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [earlyDialogOpen, setEarlyDialogOpen] = useState(false);
  const [reason, setReason] = useState("");

  const completeEarly = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("complete_project_early", {
        _contract_id: contractId!,
        _requester_id: user!.id,
        _reason: reason.trim() || "Early completion requested",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-contract", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-milestones"] });
      setEarlyDialogOpen(false);
      setReason("");
      toast.success("Project completed! Remaining escrow returned and platform cut applied.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!contractId || contractStatus !== "active") return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FastForward className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Project Controls</span>
      </div>

      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1.5 text-xs"
          onClick={() => setEarlyDialogOpen(true)}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Complete Project Early
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Ends the project now. Remaining escrow returns to the client. 10% platform cut applies to released credits.
        </p>
      </div>

      <Dialog open={earlyDialogOpen} onOpenChange={setEarlyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-primary" />
              Complete Project Early
            </DialogTitle>
            <DialogDescription>
              This will end the project immediately. Any remaining escrowed credits will be returned to the client.
              A 10% platform fee will be deducted from the specialist's released credits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Reason (optional)
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you completing early?"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEarlyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => completeEarly.mutate()}
              disabled={completeEarly.isPending}
              className="gap-1.5"
            >
              {completeEarly.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm Completion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectControls;
