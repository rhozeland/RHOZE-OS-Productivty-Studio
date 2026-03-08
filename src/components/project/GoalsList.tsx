import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Target, Trash2, CheckCircle2, Clock, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  progress: number;
  created_at: string;
}

interface GoalsListProps {
  goals: Goal[] | undefined;
  projectId: string;
}

const priorityColors: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-600",
  medium: "bg-amber-500/10 text-amber-600",
  high: "bg-destructive/10 text-destructive",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Target className="h-4 w-4 text-primary" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

const GoalsList = ({ goals, projectId }: GoalsListProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState<Date>();

  const addGoal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_goals").insert({
        title,
        description: description || null,
        project_id: projectId,
        user_id: user!.id,
        priority,
        due_date: dueDate?.toISOString() ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate(undefined);
      toast.success("Goal added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateGoalProgress = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: string; progress: number }) => {
      const updates: any = { progress };
      if (progress === 100) {
        updates.status = "completed";
        updates.completed_at = new Date().toISOString();
      } else if (progress > 0) {
        updates.status = "in_progress";
        updates.completed_at = null;
      } else {
        updates.status = "pending";
        updates.completed_at = null;
      }
      const { error } = await supabase.from("project_goals").update(updates).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] }),
  });

  const deleteGoal = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.from("project_goals").delete().eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] });
      toast.success("Goal removed");
    },
  });

  return (
    <div className="surface-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Goals & Milestones</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" />Add Goal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Goal</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) addGoal.mutate(); }} className="space-y-4">
              <Input placeholder="Goal title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="flex gap-3">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left", !dueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="submit" className="w-full" disabled={addGoal.isPending}>
                {addGoal.isPending ? "Adding..." : "Add Goal"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(!goals || goals.length === 0) ? (
        <p className="text-sm text-muted-foreground">No goals yet. Set your first milestone!</p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal, i) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {statusIcons[goal.status] || statusIcons.pending}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${goal.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {goal.title}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityColors[goal.priority]}`}>
                        {goal.priority}
                      </span>
                    </div>
                    {goal.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{goal.description}</p>
                    )}
                    {goal.due_date && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Due {format(new Date(goal.due_date), "MMM d, yyyy")}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <Slider
                        value={[goal.progress]}
                        max={100}
                        step={5}
                        className="flex-1"
                        onValueCommit={(val) => updateGoalProgress.mutate({ goalId: goal.id, progress: val[0] })}
                      />
                      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{goal.progress}%</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteGoal.mutate(goal.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoalsList;
