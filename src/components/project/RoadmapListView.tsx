import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  CalendarIcon,
  ListTodo,
  User,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

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
  parent_id: string | null;
  budget_amount: number;
  sort_order: number;
  stage_date_start: string | null;
  stage_date_end: string | null;
  location: string | null;
  assignee_id?: string | null;
}

interface RoadmapListViewProps {
  goals: Goal[] | undefined;
  projectId: string;
}

const priorityConfig: Record<string, { label: string; class: string; icon?: React.ReactNode }> = {
  low: { label: "Low", class: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  medium: { label: "Med", class: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  high: { label: "High", class: "bg-destructive/10 text-destructive border-destructive/20", icon: <AlertTriangle className="h-3 w-3" /> },
};

const RoadmapListView = ({ goals, projectId }: RoadmapListViewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState<Date>();
  const [assignee, setAssignee] = useState("");
  const [parentId, setParentId] = useState("");

  // Fetch collaborators for assignee picker
  const { data: collaborators } = useQuery({
    queryKey: ["project-collaborators", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch project owner
  const { data: project } = useQuery({
    queryKey: ["project-owner", projectId],
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

  const teamUserIds = [
    ...(project ? [project.user_id] : []),
    ...(collaborators?.map((c) => c.user_id) ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const { data: profiles } = useQuery({
    queryKey: ["team-profiles", teamUserIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", teamUserIds);
      if (error) throw error;
      return data;
    },
    enabled: teamUserIds.length > 0,
  });

  const getProfile = (userId: string) =>
    profiles?.find((p) => p.user_id === userId);

  // All goals flattened, sorted by parent then sort_order
  const allGoals = (goals ?? []).sort((a, b) => {
    if (a.parent_id === b.parent_id) return a.sort_order - b.sort_order;
    if (!a.parent_id && b.parent_id) return -1;
    if (a.parent_id && !b.parent_id) return 1;
    return 0;
  });

  const stages = allGoals.filter((g) => !g.parent_id);

  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_goals").insert({
        title,
        description: desc || null,
        project_id: projectId,
        user_id: user!.id,
        priority,
        due_date: dueDate?.toISOString() ?? null,
        parent_id: parentId || null,
        assignee_id: assignee || null,
        sort_order: allGoals.length,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] });
      setDialogOpen(false);
      setTitle("");
      setDesc("");
      setPriority("medium");
      setDueDate(undefined);
      setAssignee("");
      setParentId("");
      toast.success("Task added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ goalId, completed }: { goalId: string; completed: boolean }) => {
      const updates: any = completed
        ? { status: "completed", completed_at: new Date().toISOString(), progress: 100 }
        : { status: "pending", completed_at: null, progress: 0 };
      const { error } = await supabase.from("project_goals").update(updates).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] }),
  });

  const updateAssignee = useMutation({
    mutationFn: async ({ goalId, assigneeId }: { goalId: string; assigneeId: string | null }) => {
      const { error } = await supabase
        .from("project_goals")
        .update({ assignee_id: assigneeId } as any)
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.from("project_goals").delete().eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] });
      toast.success("Removed");
    },
  });

  const renderTask = (goal: Goal, indent = false) => {
    const isComplete = goal.status === "completed";
    const overdue = goal.due_date && !isComplete && isPast(new Date(goal.due_date)) && !isToday(new Date(goal.due_date));
    const assigneeProfile = goal.assignee_id ? getProfile(goal.assignee_id) : null;
    const pConfig = priorityConfig[goal.priority] || priorityConfig.medium;

    return (
      <motion.div
        key={goal.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-colors",
          indent && "ml-8",
          overdue && "bg-destructive/5"
        )}
      >
        <Checkbox
          checked={isComplete}
          onCheckedChange={(checked) =>
            toggleComplete.mutate({ goalId: goal.id, completed: !!checked })
          }
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-sm font-medium",
                isComplete ? "line-through text-muted-foreground" : "text-foreground"
              )}
            >
              {goal.title}
            </span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", pConfig.class)}>
              {pConfig.icon}
              {pConfig.label}
            </Badge>
          </div>
          {goal.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{goal.description}</p>
          )}
        </div>

        {/* Due date */}
        {goal.due_date && (
          <span
            className={cn(
              "text-xs shrink-0",
              overdue ? "text-destructive font-medium" : "text-muted-foreground"
            )}
          >
            {format(new Date(goal.due_date), "MMM d")}
          </span>
        )}

        {/* Assignee */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="shrink-0">
              {assigneeProfile ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={assigneeProfile.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(assigneeProfile.display_name || "?")[0]}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <User className="h-3 w-3 text-muted-foreground/50" />
                </div>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            <button
              onClick={() => updateAssignee.mutate({ goalId: goal.id, assigneeId: null })}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors text-muted-foreground"
            >
              Unassigned
            </button>
            {profiles?.map((p) => (
              <button
                key={p.user_id}
                onClick={() => updateAssignee.mutate({ goalId: goal.id, assigneeId: p.user_id })}
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors",
                  goal.assignee_id === p.user_id && "bg-primary/10 text-primary"
                )}
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={p.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px]">
                    {(p.display_name || "?")[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{p.display_name || "User"}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={() => deleteTask.mutate(goal.id)}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Task List</h2>
          <span className="text-xs text-muted-foreground">
            {allGoals.filter((g) => g.status === "completed").length}/{allGoals.length} done
          </span>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) addTask.mutate();
              }}
              className="space-y-4"
            >
              <Input
                placeholder="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
              <Textarea
                placeholder="Description (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("justify-start text-left", !dueDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "MMM d") : "Due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {stages.length > 0 && (
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Stage (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No stage</SelectItem>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {profiles && profiles.length > 0 && (
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.display_name || "User"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={addTask.isPending}>
                {addTask.isPending ? "Adding..." : "Add Task"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {allGoals.length === 0 ? (
        <div className="surface-card flex flex-col items-center justify-center py-12">
          <ListTodo className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No tasks yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add tasks to track your project work</p>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border rounded-xl overflow-hidden">
          {stages.map((stage) => {
            const children = allGoals.filter((g) => g.parent_id === stage.id);
            return (
              <div key={stage.id}>
                {renderTask(stage)}
                {children.map((child) => renderTask(child, true))}
              </div>
            );
          })}
          {/* Orphan tasks (no parent) that are not stages with children */}
          {allGoals
            .filter((g) => !g.parent_id && !allGoals.some((c) => c.parent_id === g.id))
            .map((g) => renderTask(g))}
        </div>
      )}
    </div>
  );
};

export default RoadmapListView;
