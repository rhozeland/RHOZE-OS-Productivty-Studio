import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Edit2, Check, X, Receipt } from "lucide-react";
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

interface ProjectBudgetProps {
  project: Project;
  goals: Goal[] | undefined;
}

const CURRENCIES = [
  { value: "CAD", label: "CAD $" },
  { value: "USD", label: "USD $" },
  { value: "EUR", label: "EUR €" },
  { value: "GBP", label: "GBP £" },
];

const ProjectBudget = ({ project, goals }: ProjectBudgetProps) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState(String(project.total_budget || ""));
  const [isEstimate, setIsEstimate] = useState(project.is_estimate);
  const [currency, setCurrency] = useState(project.currency || "CAD");

  const stages = (goals ?? [])
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const stageTotal = stages.reduce((sum, s) => sum + (s.budget_amount || 0), 0);
  const paidStages = stages.filter((s) => s.status === "completed");
  const paidAmount = paidStages.reduce((sum, s) => sum + (s.budget_amount || 0), 0);
  const totalBudget = project.total_budget || stageTotal;
  const progressPct = totalBudget > 0 ? Math.round((paidAmount / totalBudget) * 100) : 0;

  const currencySymbol = CURRENCIES.find((c) => c.value === currency)?.label.slice(-1) || "$";

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

  return (
    <div className="surface-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Budget</h2>
        </div>
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

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Grand Total</Label>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
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
          <div className="flex items-center gap-3">
            <Switch checked={isEstimate} onCheckedChange={setIsEstimate} id="estimate-toggle" />
            <Label htmlFor="estimate-toggle" className="text-sm text-muted-foreground">
              This is an estimate
            </Label>
          </div>
        </div>
      ) : (
        <>
          {/* Grand total display */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Grand Total {isEstimate && "(Estimate)"}
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
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-semibold text-green-600">
                  {currencySymbol}
                  {paidAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
            <Progress value={progressPct} className="mt-3 h-2" />
            <p className="mt-1 text-xs text-muted-foreground text-right">{progressPct}% delivered</p>
          </div>

          {/* Per-stage breakdown */}
          {stages.some((s) => s.budget_amount > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Breakdown by Stage
              </p>
              {stages
                .filter((s) => s.budget_amount > 0)
                .map((stage, i) => (
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">{stage.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium text-foreground">
                        {currencySymbol}
                        {stage.budget_amount.toLocaleString()}
                      </span>
                      {stage.status === "completed" && (
                        <span className="text-[10px] rounded-full bg-green-500/10 text-green-600 px-2 py-0.5 font-medium">
                          Paid
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}

              {/* Remaining unallocated */}
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
    </div>
  );
};

export default ProjectBudget;
