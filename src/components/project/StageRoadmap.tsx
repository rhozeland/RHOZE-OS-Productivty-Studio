import { useEffect, useState } from "react";
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
  assignee_id?: string | null;
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
  /** When false (collaborator view), hide add/delete and show assigned-stage
   *  accent border. Defaults to true for backwards compatibility. */
  isOwner?: boolean;
}


// Notion-style status options. Mapped onto project_goals.status values.
type StatusKey = "planned" | "in_progress" | "in_review" | "shipped" | "archived";

const STATUS_OPTIONS: Record<StatusKey, { label: string; dot: string; chip: string; group: "todo" | "in_progress" | "complete" }> = {
  planned:     { label: "Planned",     dot: "bg-muted-foreground/50", chip: "bg-muted/60 text-muted-foreground border-border", group: "todo" },
  in_progress: { label: "In Progress", dot: "bg-primary",             chip: "bg-primary/15 text-primary border-primary/30", group: "in_progress" },
  in_review:   { label: "In Review",   dot: "bg-amber-500",           chip: "bg-amber-500/15 text-amber-500 border-amber-500/30", group: "in_progress" },
  shipped:     { label: "Shipped",     dot: "bg-emerald-500",         chip: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", group: "complete" },
  archived:    { label: "Archived",    dot: "bg-muted-foreground/40", chip: "bg-muted/60 text-muted-foreground/80 border-border", group: "complete" },
};

// Normalize whatever the DB has into our 5-state model.
const normalizeStatus = (raw: string | null | undefined): StatusKey => {
  switch ((raw || "").toLowerCase()) {
    case "completed":
    case "shipped":
    case "done":
      return "shipped";
    case "archived":
      return "archived";
    case "in_review":
    case "review":
      return "in_review";
    case "in_progress":
    case "active":
    case "doing":
      return "in_progress";
    default:
      return "planned";
  }
};

const PRIORITY_PILL: Record<string, string> = {
  low:    "bg-blue-500/10 text-blue-400 border-blue-500/30",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  high:   "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const StageRoadmap = ({ goals, projectId, projectTitle, contract, milestones, collaborators, isCollaborative, isLocked, isOwner = true }: StageRoadmapProps) => {
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
      return normalizeStatus(stage?.status) === "shipped" ? 100 : 0;
    }
    const completed = items.filter((i) => normalizeStatus(i.status) === "shipped").length;
    return Math.round((completed / items.length) * 100);
  };

  const toggleExpand = (id: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Auto-expand first stage on mount
  useEffect(() => {
    if (stages.length > 0 && expandedStages.size === 0) {
      setExpandedStages(new Set([stages[0].id]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.length]);

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
      toast.success("Stage updated");
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
      toast.success("Stage added");
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
      toast.success("Item added");
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

  const setStageStatus = useMutation({
    mutationFn: async ({ goalId, status }: { goalId: string; status: StatusKey }) => {
      const dbStatus = status === "shipped" ? "completed" : status;
      const updates: any = { status: dbStatus };
      if (status === "shipped") {
        updates.completed_at = new Date().toISOString();
        updates.progress = 100;
      } else {
        updates.completed_at = null;
      }
      const { error } = await supabase.from("project_goals").update(updates).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-goals", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const setStagePriorityMutation = useMutation({
    mutationFn: async ({ goalId, priority }: { goalId: string; priority: string }) => {
      const { error } = await supabase.from("project_goals").update({ priority }).eq("id", goalId);
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

  // ----------- Render helpers -----------

  const StatusPill = ({ status, onChange }: { status: StatusKey; onChange: (s: StatusKey) => void }) => {
    const s = STATUS_OPTIONS[status];
    const grouped: Record<"todo" | "in_progress" | "complete", StatusKey[]> = {
      todo: [], in_progress: [], complete: [],
    };
    (Object.keys(STATUS_OPTIONS) as StatusKey[]).forEach((k) => grouped[STATUS_OPTIONS[k].group].push(k));

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition hover:opacity-90",
              s.chip
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
            {s.label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" onClick={(e) => e.stopPropagation()} align="start">
          {(["todo", "in_progress", "complete"] as const).map((groupKey) => (
            <div key={groupKey} className="mb-2 last:mb-0">
              <div className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {groupKey === "todo" ? "To-do" : groupKey === "in_progress" ? "In progress" : "Complete"}
              </div>
              {grouped[groupKey].map((key) => {
                const opt = STATUS_OPTIONS[key];
                return (
                  <button
                    key={key}
                    onClick={() => onChange(key)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                  >
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
                      opt.chip
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", opt.dot)} />
                      {opt.label}
                    </span>
                    {status === key && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          ))}
        </PopoverContent>
      </Popover>
    );
  };

  const PriorityPill = ({ priority, onChange }: { priority: string; onChange: (p: string) => void }) => {
    const cls = PRIORITY_PILL[priority] || PRIORITY_PILL.medium;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize transition hover:opacity-90",
              cls
            )}
          >
            {priority}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" onClick={(e) => e.stopPropagation()} align="start">
          {["low", "medium", "high"].map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm capitalize hover:bg-muted/60"
            >
              <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs", PRIORITY_PILL[p])}>{p}</span>
              {priority === p && <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  };

  const completedStages = stages.filter((s) => normalizeStatus(s.status) === "shipped").length;
  const overallProgress = stages.length === 0 ? 0 : Math.round((completedStages / stages.length) * 100);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Milestone className="h-5 w-5 text-primary shrink-0" />
          <h2 className="font-display text-lg font-semibold text-foreground truncate">Project Roadmap</h2>
          {stages.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
              {completedStages} / {stages.length} shipped · {overallProgress}%
            </span>
          )}
        </div>
        {isOwner && (
        <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New stage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New stage</DialogTitle>
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
                    <Calendar mode="single" selected={stageStartDate} onSelect={setStageStartDate} initialFocus className="p-3 pointer-events-auto" />
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
                    <Calendar mode="single" selected={stageEndDate} onSelect={setStageEndDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Location (optional)" value={stageLocation} onChange={(e) => setStageLocation(e.target.value)} />
                <Input type="number" placeholder="Budget amount" value={stageBudget} onChange={(e) => setStageBudget(e.target.value)} min="0" step="0.01" />
              </div>
              <Select value={stagePriority} onValueChange={setStagePriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low priority</SelectItem>
                  <SelectItem value="medium">Medium priority</SelectItem>
                  <SelectItem value="high">High priority</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full" disabled={addStage.isPending}>
                {addStage.isPending ? "Adding..." : "Add stage"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}

      </div>

      {/* Overall progress strip */}
      {stages.length > 0 && (
        <div className="surface-card flex items-center gap-3 px-4 py-2.5">
          <Progress value={overallProgress} className="h-1.5 flex-1" />
          <span className="text-xs font-medium tabular-nums text-muted-foreground w-10 text-right">{overallProgress}%</span>
        </div>
      )}

      {/* Empty state */}
      {stages.length === 0 && (
        <div className="surface-card flex flex-col items-center justify-center py-12">
          <Milestone className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No stages yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create stages to build your project roadmap</p>
        </div>
      )}

      {/* Table */}
      {stages.length > 0 && (
        <div className="surface-card overflow-hidden">
          {/* Column header */}
          <div className="hidden md:grid grid-cols-[28px_minmax(0,1fr)_120px_100px_180px_100px_60px] items-center gap-3 border-b border-border/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
            <div />
            <div>Stage</div>
            <div>Status</div>
            <div>Priority</div>
            <div>Timeline</div>
            <div className="text-right">Budget</div>
            <div />
          </div>

          {stages.map((stage, i) => {
            const subItems = getSubItems(stage.id);
            const progress = getStageProgress(stage.id);
            const isExpanded = expandedStages.has(stage.id);
            const status = normalizeStatus(stage.status);
            const isEditing = editingStageId === stage.id;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "border-b border-border/40 last:border-b-0",
                  !isOwner && stage.assignee_id === user?.id && "border-l-2 border-l-primary",
                )}
              >

                {isEditing ? (
                  // ---- EDIT MODE ----
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editTitle.trim()) updateStage.mutate(stage.id);
                    }}
                    className="space-y-3 p-4"
                  >
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Stage title" required autoFocus />
                    <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description / details" rows={2} />
                    <div className="grid grid-cols-2 gap-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className={cn("justify-start text-left text-sm", !editStartDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {editStartDate ? format(editStartDate, "MMM d, yyyy") : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={editStartDate} onSelect={setEditStartDate} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className={cn("justify-start text-left text-sm", !editEndDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {editEndDate ? format(editEndDate, "MMM d, yyyy") : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={editEndDate} onSelect={setEditEndDate} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Input placeholder="Location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
                      <Input type="number" placeholder="Budget" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} min="0" step="0.01" />
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                  // ---- ROW VIEW ----
                  <div
                    className={cn(
                      "group grid grid-cols-[28px_minmax(0,1fr)_auto] md:grid-cols-[28px_minmax(0,1fr)_120px_100px_180px_100px_60px] items-center gap-3 px-3 py-4 cursor-pointer hover:bg-muted/30 transition-colors",
                      status === "shipped" && "bg-emerald-500/[0.03]"
                    )}
                    onClick={() => toggleExpand(stage.id)}
                  >
                    {/* Expand chevron + stage number */}
                    <div className="flex items-center justify-center text-muted-foreground">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>

                    {/* Title + meta */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className={cn(
                          "truncate text-sm font-medium",
                          status === "shipped" ? "text-muted-foreground line-through" : "text-foreground"
                        )}>
                          {stage.title}
                        </span>
                        {isLocked && <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                        {subItems.length > 0 && (
                          <span className="ml-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                            {subItems.filter((it) => normalizeStatus(it.status) === "shipped").length}/{subItems.length}
                          </span>
                        )}
                      </div>
                      {stage.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{stage.description}</p>
                      )}
                      {/* Mobile compact meta row */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
                        <StatusPill status={status} onChange={(s) => setStageStatus.mutate({ goalId: stage.id, status: s })} />
                        <PriorityPill priority={stage.priority || "medium"} onChange={(p) => setStagePriorityMutation.mutate({ goalId: stage.id, priority: p })} />
                        {stage.stage_date_end && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(stage.stage_date_end), "MMM d")}
                          </span>
                        )}
                        {stage.budget_amount > 0 && (
                          <span className="text-[11px] font-medium text-foreground">${stage.budget_amount.toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Status — desktop column */}
                    <div className="hidden md:block">
                      <StatusPill status={status} onChange={(s) => setStageStatus.mutate({ goalId: stage.id, status: s })} />
                    </div>

                    {/* Priority */}
                    <div className="hidden md:block">
                      <PriorityPill priority={stage.priority || "medium"} onChange={(p) => setStagePriorityMutation.mutate({ goalId: stage.id, priority: p })} />
                    </div>

                    {/* Timeline */}
                    <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                      {(stage.stage_date_start || stage.stage_date_end) ? (
                        <>
                          <CalendarIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {stage.stage_date_start && format(new Date(stage.stage_date_start), "MMM d")}
                            {stage.stage_date_start && stage.stage_date_end && " — "}
                            {stage.stage_date_end && format(new Date(stage.stage_date_end), "MMM d, yyyy")}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                      {stage.location && (
                        <span className="ml-1 flex items-center gap-0.5 text-muted-foreground/70">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{stage.location}</span>
                        </span>
                      )}
                    </div>

                    {/* Budget */}
                    <div className="hidden md:block text-right text-sm tabular-nums text-foreground">
                      {stage.budget_amount > 0 ? `$${stage.budget_amount.toLocaleString()}` : <span className="text-muted-foreground/40">—</span>}
                    </div>

                    {/* Row actions */}
                    {(isOwner || stage.assignee_id === user?.id) && (
                    <div className="hidden md:flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); startEditing(stage); }}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      {isOwner && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteGoal.mutate(stage.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                      )}
                    </div>
                    )}

                    {/* Mobile row action menu */}
                    {(isOwner || stage.assignee_id === user?.id) && (
                    <div className="flex md:hidden items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(stage)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                    )}

                  </div>
                )}

                {/* Expanded checklist + approval */}
                <AnimatePresence>
                  {isExpanded && !isEditing && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-muted/10 px-4 py-3 md:pl-12 space-y-3 border-t border-border/40">
                        {/* Progress + checklist */}
                        {subItems.length > 0 && (
                          <div className="flex items-center gap-3 pb-1">
                            <Progress value={progress} className="h-1 flex-1" />
                            <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">{progress}%</span>
                          </div>
                        )}

                        <div className="space-y-0.5">
                          {subItems.map((item, j) => {
                            const itemDone = normalizeStatus(item.status) === "shipped";
                            return (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: j * 0.02 }}
                                className="group/item flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors"
                              >
                                <Checkbox
                                  checked={itemDone}
                                  onCheckedChange={(checked) =>
                                    toggleItemComplete.mutate({ goalId: item.id, completed: !!checked })
                                  }
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm", itemDone ? "line-through text-muted-foreground" : "text-foreground")}>
                                    {item.title}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0"
                                  onClick={() => deleteGoal.mutate(item.id)}
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </motion.div>
                            );
                          })}

                          {/* Add item */}
                          <Dialog
                            open={itemDialogOpen === stage.id}
                            onOpenChange={(o) => setItemDialogOpen(o ? stage.id : null)}
                          >
                            <DialogTrigger asChild>
                              <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors w-full">
                                <Plus className="h-3.5 w-3.5" />
                                Add task
                              </button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add task to {stage.title}</DialogTitle>
                              </DialogHeader>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (itemTitle.trim()) addSubItem.mutate(stage.id);
                                }}
                                className="space-y-4"
                              >
                                <Input placeholder="Task title" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} required />
                                <Textarea placeholder="Details (optional)" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
                                <Button type="submit" className="w-full" disabled={addSubItem.isPending}>
                                  {addSubItem.isPending ? "Adding..." : "Add task"}
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </div>

                        {/* Stage Approval */}
                        {(progress === 100 || subItems.length > 0) && (
                          <div className="pt-2">
                            <StageApproval
                              goalId={stage.id}
                              projectId={projectId}
                              projectTitle={projectTitle || ""}
                              stageTitle={stage.title}
                              stageComplete={progress === 100 || status === "shipped"}
                              contract={!isCollaborative ? contract : null}
                              milestone={!isCollaborative && milestones ? milestones.find((_, idx) => idx === i) : null}
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* New item row at bottom (Notion-style) */}
          {isOwner && (
          <button
            onClick={() => setStageDialogOpen(true)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New stage
          </button>
          )}

        </div>
      )}
    </div>
  );
};

export default StageRoadmap;
