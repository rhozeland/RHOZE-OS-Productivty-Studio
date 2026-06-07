import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  CircleDot,
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
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
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

type ViewMode = "daily" | "weekly" | "monthly";

const priorityStyles: Record<string, string> = {
  low: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  high: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

const priorityDot: Record<string, string> = {
  low: "bg-sky-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
};

const RoadmapCalendarView = ({ goals, projectId }: RoadmapCalendarViewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<ViewMode>("weekly");

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

  const syncToCalendar = useMutation({
    mutationFn: async () => {
      if (!user || !goals) return;
      const datedGoals = goals.filter((g) => g.due_date || g.stage_date_start);
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

  const getGoalsForDay = (day: Date) => {
    return (goals ?? []).filter((g) => {
      if (g.due_date && isSameDay(new Date(g.due_date), day)) return true;
      if (g.stage_date_start && isSameDay(new Date(g.stage_date_start), day)) return true;
      return false;
    });
  };

  // --- Navigation handlers ---
  const goPrev = () => {
    if (view === "daily") setCursor(subDays(cursor, 1));
    else if (view === "weekly") setCursor(subWeeks(cursor, 1));
    else setCursor(subMonths(cursor, 1));
  };
  const goNext = () => {
    if (view === "daily") setCursor(addDays(cursor, 1));
    else if (view === "weekly") setCursor(addWeeks(cursor, 1));
    else setCursor(addMonths(cursor, 1));
  };

  const rangeLabel = useMemo(() => {
    if (view === "daily") return format(cursor, "EEEE, MMM d, yyyy");
    if (view === "weekly") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    return format(cursor, "MMMM yyyy");
  }, [cursor, view]);

  // --- Weekly view ---
  const weekDays = useMemo(() => {
    const s = startOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: s, end: addDays(s, 6) });
  }, [cursor]);

  // --- Monthly view ---
  const mStart = startOfMonth(cursor);
  const mEnd = endOfMonth(cursor);
  const monthDays = eachDayOfInterval({ start: mStart, end: mEnd });
  const padding = (mStart.getDay() + 6) % 7;
  const paddedDays: (Date | null)[] = Array(padding).fill(null).concat(monthDays);

  return (
    <div className="surface-card p-4 sm:p-6 space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground leading-tight">
              Timeline
            </h2>
            <p className="text-xs text-muted-foreground">
              Plan stages, deadlines, and team work
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex items-center rounded-full bg-muted/60 p-1 text-xs font-medium">
            {(["daily", "weekly", "monthly"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded-full transition-colors capitalize",
                  view === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncToCalendar.mutate()}
            disabled={syncToCalendar.isPending}
            className="gap-1.5 rounded-full"
          >
            <Plus className="h-3.5 w-3.5" />
            {syncToCalendar.isPending ? "Syncing..." : "Sync"}
          </Button>
        </div>
      </div>

      {/* Range nav */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h3 className="ml-2 font-display text-base font-semibold text-foreground">
            {rangeLabel}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs rounded-full"
          onClick={() => setCursor(new Date())}
        >
          Today
        </Button>
      </div>

      {/* === DAILY === */}
      {view === "daily" && (
        <DailyView
          day={cursor}
          goals={getGoalsForDay(cursor)}
          getProfile={getProfile}
        />
      )}

      {/* === WEEKLY === */}
      {view === "weekly" && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dayGoals = getGoalsForDay(day);
            const today = isTodayFn(day);
            return (
              <motion.div
                key={day.toISOString()}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-2xl border border-border bg-card p-3 min-h-[140px] flex flex-col gap-2 transition-colors",
                  today && "ring-2 ring-primary/40 border-primary/40",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-display font-semibold",
                      today ? "text-primary" : "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {dayGoals.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-[11px] text-muted-foreground/60">—</span>
                    </div>
                  ) : (
                    dayGoals.map((g) => (
                      <GoalChip key={g.id} goal={g} profile={g.assignee_id ? getProfile(g.assignee_id) : null} />
                    ))
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* === MONTHLY === */}
      {view === "monthly" && (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1.5 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {paddedDays.map((day, i) => {
              if (!day) {
                return <div key={`pad-${i}`} className="min-h-[92px] rounded-xl bg-muted/20" />;
              }
              const dayGoals = getGoalsForDay(day);
              const isCurrentMonth = isSameMonth(day, cursor);
              const today = isTodayFn(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[92px] p-2 rounded-xl border border-border bg-card transition-colors hover:border-primary/30",
                    !isCurrentMonth && "opacity-40",
                    today && "ring-2 ring-primary/40 border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        today
                          ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                          : "text-foreground/80",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayGoals.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{dayGoals.length - 2}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayGoals.slice(0, 2).map((g) => (
                      <div
                        key={g.id}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] leading-tight truncate border",
                          priorityStyles[g.priority] || priorityStyles.medium,
                          g.status === "completed" && "line-through opacity-60",
                        )}
                      >
                        <span className="truncate">{g.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> High priority
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> Low
        </div>
      </div>
    </div>
  );
};

const GoalChip = ({
  goal,
  profile,
}: {
  goal: Goal;
  profile: { display_name: string | null; avatar_url: string | null } | null | undefined;
}) => {
  return (
    <div
      className={cn(
        "group rounded-lg border px-2 py-1.5 text-[11px] leading-tight transition-colors",
        priorityStyles[goal.priority] || priorityStyles.medium,
        goal.status === "completed" && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        <CircleDot className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
        <span
          className={cn(
            "font-medium line-clamp-2 flex-1",
            goal.status === "completed" && "line-through",
          )}
        >
          {goal.title}
        </span>
      </div>
      {profile && (
        <div className="mt-1 flex items-center gap-1">
          <Avatar className="h-4 w-4">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-[8px]">
              {(profile.display_name || "?")[0]}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] opacity-80 truncate">{profile.display_name}</span>
        </div>
      )}
    </div>
  );
};

const DailyView = ({
  day,
  goals,
  getProfile,
}: {
  day: Date;
  goals: Goal[];
  getProfile: (id: string) => { display_name: string | null; avatar_url: string | null } | undefined;
}) => {
  const today = isTodayFn(day);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            {format(day, "EEEE")}
          </p>
          <p
            className={cn(
              "font-display text-3xl font-semibold",
              today ? "text-primary" : "text-foreground",
            )}
          >
            {format(day, "MMMM d")}
          </p>
        </div>
        {today && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
            Today
          </span>
        )}
      </div>
      {goals.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nothing scheduled. Enjoy the breathing room.
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((g) => (
            <GoalChip key={g.id} goal={g} profile={g.assignee_id ? getProfile(g.assignee_id) : null} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RoadmapCalendarView;
