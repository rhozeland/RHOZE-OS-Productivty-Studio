import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  isToday as isTodayFn,
} from "date-fns";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  stage_date_start: string | null;
  stage_date_end: string | null;
  parent_id: string | null;
  assignee_id?: string | null;
}

interface RoadmapCalendarViewProps {
  goals: Goal[] | undefined;
  projectId: string;
}

const priorityDot: Record<string, string> = {
  low: "bg-blue-500",
  medium: "bg-amber-500",
  high: "bg-destructive",
};

const RoadmapCalendarView = ({ goals, projectId }: RoadmapCalendarViewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch team profiles for assignee display
  const { data: project } = useQuery({
    queryKey: ["project-owner", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("user_id").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: collaborators } = useQuery({
    queryKey: ["project-collaborators", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_collaborators").select("*").eq("project_id", projectId);
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
      const { data, error } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", teamUserIds);
      if (error) throw error;
      return data;
    },
    enabled: teamUserIds.length > 0,
  });

  // Sync goals to main calendar
  const syncToCalendar = useMutation({
    mutationFn: async () => {
      if (!user || !goals) return;

      const datedGoals = goals.filter((g) => g.due_date || g.stage_date_start);

      // Get existing synced events for this project
      const { data: existing } = await supabase
        .from("calendar_events")
        .select("id, title")
        .eq("user_id", user.id)
        .eq("project_id", projectId);

      const existingTitles = new Set(existing?.map((e) => e.title) ?? []);

      const newEvents = datedGoals
        .filter((g) => !existingTitles.has(`📌 ${g.title}`))
        .map((g) => ({
          user_id: user.id,
          project_id: projectId,
          title: `📌 ${g.title}`,
          description: g.parent_id ? "Sub-task" : "Stage",
          start_time: (g.due_date || g.stage_date_start)!,
          end_time: (g.due_date || g.stage_date_end || g.stage_date_start)!,
          color: g.priority === "high" ? "#ef4444" : g.priority === "low" ? "#3b82f6" : "#f59e0b",
        }));

      if (newEvents.length === 0) return 0;

      const { error } = await supabase.from("calendar_events").insert(newEvents);
      if (error) throw error;
      return newEvents.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      if (count === 0) {
        import("sonner").then(({ toast }) => toast.info("Calendar already up to date"));
      } else {
        import("sonner").then(({ toast }) => toast.success(`Synced ${count} items to your calendar`));
      }
    },
    onError: (e: any) => {
      import("sonner").then(({ toast }) => toast.error(e.message));
    },
  });

  const getProfile = (userId: string) =>
    profiles?.find((p) => p.user_id === userId);

  // Calendar grid
  const mStart = startOfMonth(currentMonth);
  const mEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: mStart, end: mEnd });
  const padding = (mStart.getDay() + 6) % 7;
  const paddedDays: (Date | null)[] = Array(padding).fill(null).concat(days);

  const getGoalsForDay = (day: Date) => {
    return (goals ?? []).filter((g) => {
      if (g.due_date && isSameDay(new Date(g.due_date), day)) return true;
      if (g.stage_date_start && isSameDay(new Date(g.stage_date_start), day)) return true;
      return false;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Calendar View</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncToCalendar.mutate()}
            disabled={syncToCalendar.isPending}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {syncToCalendar.isPending ? "Syncing..." : "Sync to Calendar"}
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-display font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-border bg-border">
        {paddedDays.map((day, i) => {
          if (!day) {
            return <div key={`pad-${i}`} className="bg-muted/20 min-h-[80px]" />;
          }
          const dayGoals = getGoalsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const today = isTodayFn(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[80px] p-1.5 bg-card transition-colors",
                !isCurrentMonth && "opacity-40",
                today && "ring-1 ring-inset ring-primary/40"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-medium",
                    today
                      ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center"
                      : "text-muted-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayGoals.slice(0, 3).map((g) => {
                  const assigneeProfile = g.assignee_id ? getProfile(g.assignee_id) : null;
                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight truncate",
                        g.status === "completed"
                          ? "bg-green-500/10 text-green-700 line-through"
                          : "bg-muted/60 text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          priorityDot[g.priority] || priorityDot.medium
                        )}
                      />
                      <span className="truncate flex-1">{g.title}</span>
                      {assigneeProfile && (
                        <Avatar className="h-3.5 w-3.5 shrink-0">
                          <AvatarImage src={assigneeProfile.avatar_url || undefined} />
                          <AvatarFallback className="text-[7px]">
                            {(assigneeProfile.display_name || "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
                {dayGoals.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{dayGoals.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoadmapCalendarView;
