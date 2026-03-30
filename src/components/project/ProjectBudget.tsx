import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Edit2,
  Check,
  X,
  Receipt,
  AlertTriangle,
  Rocket,
  CheckCircle2,
  Clock,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Goal {
  id: string;
  title: string;
  parent_id: string | null;
  budget_amount: number;
  status: string;
  sort_order: number;
}

interface Project {
  id: string;
  total_budget: number;
  is_estimate: boolean;
  currency: string;
}

interface Milestone {
  id: string;
  credit_amount: number;
  status: string;
  sort_order: number;
  title: string;
}

interface ProjectBudgetProps {
  project: Project;
  goals: Goal[] | undefined;
  milestones?: Milestone[] | null;
}

const CURRENCIES = [
  { value: "CAD", label: "CAD $" },
  { value: "USD", label: "USD $" },
  { value: "EUR", label: "EUR €" },
  { value: "GBP", label: "GBP £" },
];

const ProjectBudget = ({ project, goals, milestones }: ProjectBudgetProps) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState(String(project.total_budget || ""));
  const [isEstimate, setIsEstimate] = useState(project.is_estimate);
  const [currency, setCurrency] = useState(project.currency || "CAD");
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);

  const stages = (goals ?? [])
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const stageTotal = stages.reduce((sum, s) => sum + (s.budget_amount || 0), 0);
  const totalBudget = project.total_budget || stageTotal;
  const currencySymbol = CURRENCIES.find((c) => c.value === currency)?.label.slice(-1) || "$";

  // Fetch stage-level approvals to determine delivered stages
  const stageIds = stages.map((s) => s.id);
  const { data: stageApprovals } = useQuery({
    queryKey: ["stage-approvals-budget", stageIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_approvals" as any)
        .select("goal_id, role")
        .in("goal_id", stageIds);
      if (error) throw error;
      return data as unknown as Array<{ goal_id: string; role: string }>;
    },
    enabled: stageIds.length > 0,
  });

  // A stage is "delivered" when both client and specialist have approved it
  const getStageDelivered = (stageId: string) => {
    if (!stageApprovals) return false;
    const approvals = stageApprovals.filter((a) => a.goal_id === stageId);
    const hasClient = approvals.some((a) => a.role === "client");
    const hasSpecialist = approvals.some((a) => a.role === "specialist");
    return hasClient && hasSpecialist;
  };

  const deliveredStages = stages.filter((s) => getStageDelivered(s.id));
  const deliveredAmount = deliveredStages.reduce((sum, s) => sum + (s.budget_amount || 0), 0);
  const progressPct = totalBudget > 0 ? Math.round((deliveredAmount / totalBudget) * 100) : 0;

  // Milestone-based delivery for credit tracking
  const approvedMilestones = milestones?.filter((m) => m.status === "approved") ?? [];
  const totalCredits = milestones?.reduce((sum, m) => sum + m.credit_amount, 0) ?? 0;
  const releasedCredits = approvedMilestones.reduce((sum, m) => sum + m.credit_amount, 0);

  const updateBudget = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({
          total_budget: parseFloat(budget) || 0,
          is_estimate: isEstimate,
          currency,
        } as any)
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      setEditing(false);
      toast.success("Budget updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const finalizeBudget = useMutation({
    mutationFn: async () => {
      const finalTotal = stageTotal > 0 ? stageTotal : parseFloat(budget) || 0;
      const { error } = await supabase
        .from("projects")
        .update({
          is_estimate: false,
          total_budget: finalTotal,
          status: "active",
        } as any)
        .eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      setFinalizeDialogOpen(false);
      setIsEstimate(false);
      toast.success("Budget finalized — project is now in motion!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleEstimateToggle = (checked: boolean) => {
    if (!checked && project.is_estimate) {
      // Converting from estimate → official: show confirmation
      setFinalizeDialogOpen(true);
    } else {
      setIsEstimate(checked);
    }
  };

  return (
    <div className="surface-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Budget</h2>
        </div>
        <div className="flex items-center gap-2">
          {project.is_estimate ? (
            <Badge variant="outline" className="gap-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              <Clock className="h-3 w-3" />
              Estimate
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              <CheckCircle2 className="h-3 w-3" />
              Finalized
            </Badge>
          )}
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setEditing(false);
                  setBudget(String(project.total_budget || ""));
                  setIsEstimate(project.is_estimate);
                  setCurrency(project.currency || "CAD");
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary"
                onClick={() => updateBudget.mutate()}
                disabled={updateBudget.isPending}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Grand Total Override</Label>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder={stageTotal > 0 ? `Auto: ${stageTotal}` : "0.00"}
                min="0"
                step="0.01"
              />
              {stageTotal > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Leave empty to auto-sum from stages ({currencySymbol}{stageTotal.toLocaleString()})
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={isEstimate}
                onCheckedChange={handleEstimateToggle}
                id="estimate-toggle"
              />
              <Label htmlFor="estimate-toggle" className="text-sm text-muted-foreground">
                This is an estimate
              </Label>
            </div>
            {project.is_estimate && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setFinalizeDialogOpen(true)}
              >
                <Rocket className="h-3.5 w-3.5" />
                Finalize Budget
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Grand total display */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Grand Total
                </p>
                <p className="text-3xl font-display font-bold text-foreground mt-1">
                  {currencySymbol}
                  {totalBudget.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Delivered</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {currencySymbol}
                  {deliveredAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-3">
                <Progress value={progressPct} className="flex-1 h-2.5" />
                <span className="text-xs font-semibold text-muted-foreground w-12 text-right">
                  {progressPct}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {deliveredStages.length} of {stages.filter((s) => s.budget_amount > 0).length} stages delivered
              </p>
            </div>
          </div>

          {/* Credit tracking (for paid projects with milestones) */}
          {milestones && milestones.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-accent" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Credit Escrow
                  </p>
                </div>
                <span className="text-sm font-mono text-foreground">
                  {releasedCredits}/{totalCredits} cr
                </span>
              </div>
              <Progress
                value={totalCredits > 0 ? (releasedCredits / totalCredits) * 100 : 0}
                className="h-2"
              />
            </div>
          )}

          {/* Per-stage breakdown */}
          {stages.some((s) => s.budget_amount > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Breakdown by Stage
              </p>
              {stages
                .filter((s) => s.budget_amount > 0)
                .map((stage, i) => {
                  const delivered = getStageDelivered(stage.id);
                  return (
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {delivered ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm text-foreground truncate">{stage.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-foreground">
                          {currencySymbol}
                          {stage.budget_amount.toLocaleString()}
                        </span>
                        {delivered ? (
                          <span className="text-[10px] rounded-full bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 font-medium">
                            Delivered
                          </span>
                        ) : stage.status === "completed" ? (
                          <span className="text-[10px] rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 font-medium">
                            Awaiting Approval
                          </span>
                        ) : (
                          <span className="text-[10px] rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-medium">
                            Pending
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

              {/* Unallocated */}
              {totalBudget > stageTotal && stageTotal > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 border border-dashed border-border">
                  <span className="text-sm text-muted-foreground">Unallocated</span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {currencySymbol}
                    {(totalBudget - stageTotal).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Finalize Confirmation Dialog */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Finalize Budget
            </DialogTitle>
            <DialogDescription>
              Converting this estimate to an official budget will put the project in motion. This signals to all parties that the scope and pricing are agreed upon.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">What happens when you finalize:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    <li>Budget amounts become the official figures</li>
                    <li>Stage budgets lock in as delivery milestones</li>
                    <li>The project status moves to <strong>Active</strong></li>
                    <li>Payment delivery will track against approved stages</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">Official Budget</p>
              <p className="text-2xl font-display font-bold text-foreground mt-1">
                {currencySymbol}
                {(stageTotal > 0 ? stageTotal : parseFloat(budget) || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Across {stages.filter((s) => s.budget_amount > 0).length} stages
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)}>
              Keep as Estimate
            </Button>
            <Button
              onClick={() => finalizeBudget.mutate()}
              disabled={finalizeBudget.isPending}
              className="gap-1.5"
            >
              <Rocket className="h-4 w-4" />
              {finalizeBudget.isPending ? "Finalizing..." : "Finalize & Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectBudget;
