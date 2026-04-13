import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  MapPin,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  Milestone,
  Pencil,
  Check,
  X,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import StageApproval from "@/components/project/StageApproval";

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
}

interface Collaborator {
  id: string;
  user_id: string;
  project_role: string;
  role: string;
}

interface StageRoadmapProps {
  goals: Goal[] | undefined;
  projectId: string;
  projectTitle?: string;
  contract?: {
    id: string;
    client_id: string;
    specialist_id: string;
    status: string;
  } | null;
  milestones?: Array<{
    id: string;
    credit_amount: number;
    status: string;
    sort_order: number;
    title: string;
  }> | null;
  collaborators?: Collaborator[] | null;
  isCollaborative?: boolean;
  isLocked?: boolean;
}

const STAGE_COLORS = [
  "border-l-violet-500",
  "border-l-blue-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-rose-500",
  "border-l-cyan-500",
  "border-l-orange-500",
  "border-l-pink-500",
];

const StageRoadmap = ({ goals, projectId, projectTitle, contract, milestones, collaborators, isCollaborative, isLocked }: StageRoadmapProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [editingStageId, setEditingStageId] = useState<string | null>(null);

  // Stage form
  const [stageTitle, setStageTitle] = useState("");
  const [stageDesc, setStageDesc] = useState("");
  const [stagePriority, setStagePriority] = useState("medium");
  const [stageStartDate, setStageStartDate] = useState<Date>();
  const [stageEndDate, setStageEndDate] = useState<Date>();
  const [stageLocation, setStageLocation] = useState("");
  const [stageBudget, setStageBudget] = useState("");

  // Edit stage form
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editStartDate, setEditStartDate] = useState<Date>();
  const [editEndDate, setEditEndDate] = useState<Date>();
  const [editLocation, setEditLocation] = useState("");
  const [editBudget, setEditBudget] = useState("");

  // Sub-item form
  const [itemTitle, setItemTitle] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  const stages = (goals ?? [])
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const getSubItems = (stageId: string) =>
    (goals ?? [])
      .filter((g) => g.parent_id === stageId)
      .sort((a, b) => a.sort_order - b.sort_order);

  const getStageProgress = (stageId: string) => {
    const items = getSubItems(stageId);
    if (items.length === 0) {
      const stage = stages.find((s) => s.id === stageId);
      return stage?.status === "completed" ? 100 : 0;
    }
    const completed = items.filter((i) => i.status === "completed").length;
    return Math.round((completed / items.length) * 100);
  };

  const toggleExpand = (id: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Auto-expand all on mount
  useState(() => {
    if (stages.length > 0) {
      setExpandedStages(new Set(stages.map((s) => s.id)));
    }
  });

  const startEditing = (stage: Goal) => {
    setEditingStageId(stage.id);
    setEditTitle(stage.title);
    setEditDesc(stage.description || "");
    setEditPriority(stage.priority);
    setEditStartDate(stage.stage_date_start ? new Date(stage.stage_date_start) : undefined);
    setEditEndDate(stage.stage_date_end ? new Date(stage.stage_date_end) : undefined);
    setEditLocation(stage.location || "");
    setEditBudget(String(stage.budget_amount || ""));
  };

  const cancelEditing = () => setEditingStageId(null);

  const updateStage = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from("project_goals")
        .update({
          title: editTitle,
          description: editDesc || null,
          priority: editPriority,
          stage_date_start: editStartDate?.toISOString() ?? null,
          stage_date_end: editEndDate?.toISOString() ?? null,
          due_date: editEndDate?.toISOString() ?? null,
          location: editLocation || null,
          budget_amount: parseFloat(editBudget) || 0,
        } as any)
        .eq("id", stageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] });
      setEditingStageId(null);
      toast.success("Stage updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addStage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_goals").insert({
        title: stageTitle,
        description: stageDesc || null,
        project_id: projectId,
        user_id: user!.id,
        priority: stagePriority,
        stage_date_start: stageStartDate?.toISOString() ?? null,
        stage_date_end: stageEndDate?.toISOString() ?? null,
        due_date: stageEndDate?.toISOString() ?? null,
        location: stageLocation || null,
        budget_amount: parseFloat(stageBudget) || 0,
        sort_order: stages.length,
        parent_id: null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] });
      setStageDialogOpen(false);
      setStageTitle("");
      setStageDesc("");
      setStagePriority("medium");
      setStageStartDate(undefined);
      setStageEndDate(undefined);
      setStageLocation("");
      setStageBudget("");
      toast.success("Stage added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addSubItem = useMutation({
    mutationFn: async (parentId: string) => {
      const existingItems = getSubItems(parentId);
      const { error } = await supabase.from("project_goals").insert({
        title: itemTitle,
        description: itemDesc || null,
        project_id: projectId,
        user_id: user!.id,
        priority: "medium",
        parent_id: parentId,
        sort_order: existingItems.length,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] });
      setItemDialogOpen(null);
      setItemTitle("");
      setItemDesc("");
      toast.success("Item added!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleItemComplete = useMutation({
    mutationFn: async ({ goalId, completed }: { goalId: string; completed: boolean }) => {
      const updates: any = completed
        ? { status: "completed", completed_at: new Date().toISOString(), progress: 100 }
        : { status: "pending", completed_at: null, progress: 0 };
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
      toast.success("Removed");
    },
  });

  const priorityColors: Record<string, string> = {
    low: "border-blue-500/30",
    medium: "border-amber-500/30",
    high: "border-destructive/30",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Milestone className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Project Roadmap</h2>
        </div>
        <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add Stage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Stage</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (stageTitle.trim()) addStage.mutate();
              }}
              className="space-y-4"
            >
              <Input
                placeholder="Stage title (e.g. Production)"
                value={stageTitle}
                onChange={(e) => setStageTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="Description / details"
                value={stageDesc}
                onChange={(e) => setStageDesc(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left",
                        !stageStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {stageStartDate ? format(stageStartDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={stageStartDate}
                      onSelect={setStageStartDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left",
                        !stageEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {stageEndDate ? format(stageEndDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={stageEndDate}
                      onSelect={setStageEndDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Location (optional)"
                  value={stageLocation}
                  onChange={(e) => setStageLocation(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Budget amount"
                  value={stageBudget}
                  onChange={(e) => setStageBudget(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <Select value={stagePriority} onValueChange={setStagePriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={addStage.isPending}>
                {addStage.isPending ? "Adding..." : "Add Stage"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty state */}
      {stages.length === 0 && (
        <div className="surface-card flex flex-col items-center justify-center py-12">
          <Milestone className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No stages yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create stages to build your project roadmap
          </p>
        </div>
      )}

      {/* Stages */}
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const subItems = getSubItems(stage.id);
          const progress = getStageProgress(stage.id);
          const isExpanded = expandedStages.has(stage.id);
          const isComplete = progress === 100;
          const isEditing = editingStageId === stage.id;

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "surface-card overflow-hidden border-l-4",
                isComplete
                  ? "border-l-green-500"
                  : STAGE_COLORS[i % STAGE_COLORS.length]
              )}
            >
              {/* Stage Header */}
              <div className="p-4">
                {isEditing ? (
                  /* ---- EDIT MODE ---- */
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editTitle.trim()) updateStage.mutate(stage.id);
                    }}
                    className="space-y-3"
                  >
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Stage title"
                      required
                      autoFocus
                    />
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description / details"
                      rows={2}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "justify-start text-left text-sm",
                              !editStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {editStartDate ? format(editStartDate, "MMM d, yyyy") : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={editStartDate}
                            onSelect={setEditStartDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "justify-start text-left text-sm",
                              !editEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {editEndDate ? format(editEndDate, "MMM d, yyyy") : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={editEndDate}
                            onSelect={setEditEndDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        placeholder="Location"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Budget"
                        value={editBudget}
                        onChange={(e) => setEditBudget(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={cancelEditing}>
                        <X className="mr-1 h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={updateStage.isPending}>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        {updateStage.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* ---- VIEW MODE ---- */
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => toggleExpand(stage.id)}
                      >
                        <div className="mt-0.5">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold text-white",
                              isComplete ? "bg-green-500" : STAGE_COLORS[i % STAGE_COLORS.length].replace("border-l-", "bg-")
                            )}>
                              {i + 1}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Stage {i + 1}
                            </span>
                            {isComplete && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            {isLocked && (
                              <Lock className="h-3 w-3 text-muted-foreground/50" />
                            )}
                          </div>
                          <h3 className="font-display text-base font-semibold text-foreground mt-0.5">
                            {stage.title}
                          </h3>
                          {stage.description && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {stage.description}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {(stage.stage_date_start || stage.stage_date_end) && (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {stage.stage_date_start &&
                                  format(new Date(stage.stage_date_start), "MMM d, yyyy")}
                                {stage.stage_date_start && stage.stage_date_end && " — "}
                                {stage.stage_date_end &&
                                  format(new Date(stage.stage_date_end), "MMM d, yyyy")}
                              </span>
                            )}
                            {stage.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {stage.location}
                              </span>
                            )}
                            {stage.budget_amount > 0 && (
                              <span className="font-medium text-foreground">
                                ${stage.budget_amount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditing(stage)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteGoal.mutate(stage.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={progress} className="flex-1 h-2" />
                      <span className="text-xs font-medium text-muted-foreground w-10 text-right">
                        {progress}%
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Sub Items */}
              <AnimatePresence>
                {isExpanded && !isEditing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
                      {subItems.map((item, j) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: j * 0.03 }}
                          className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/40 transition-colors group"
                        >
                          <Checkbox
                            checked={item.status === "completed"}
                            onCheckedChange={(checked) =>
                              toggleItemComplete.mutate({
                                goalId: item.id,
                                completed: !!checked,
                              })
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm",
                                item.status === "completed"
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground"
                              )}
                            >
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => deleteGoal.mutate(item.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </motion.div>
                      ))}

                      {/* Add item inline */}
                      <Dialog
                        open={itemDialogOpen === stage.id}
                        onOpenChange={(o) => setItemDialogOpen(o ? stage.id : null)}
                      >
                        <DialogTrigger asChild>
                          <button className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors w-full">
                            <Plus className="h-3.5 w-3.5" />
                            Add deliverable or task
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Item to {stage.title}</DialogTitle>
                          </DialogHeader>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (itemTitle.trim()) addSubItem.mutate(stage.id);
                            }}
                            className="space-y-4"
                          >
                            <Input
                              placeholder="Item title"
                              value={itemTitle}
                              onChange={(e) => setItemTitle(e.target.value)}
                              required
                            />
                            <Textarea
                              placeholder="Details (optional)"
                              value={itemDesc}
                              onChange={(e) => setItemDesc(e.target.value)}
                            />
                            <Button
                              type="submit"
                              className="w-full"
                              disabled={addSubItem.isPending}
                            >
                              {addSubItem.isPending ? "Adding..." : "Add Item"}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stage Approval */}
              {(isComplete || (goals ?? []).filter(g => g.parent_id === stage.id).length > 0) && (
                <StageApproval
                  goalId={stage.id}
                  projectId={projectId}
                  projectTitle={projectTitle || ""}
                  stageTitle={stage.title}
                  stageComplete={isComplete}
                  contract={!isCollaborative ? contract : null}
                  milestone={!isCollaborative && milestones ? milestones.find((m, idx) => idx === i) : null}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default StageRoadmap;
