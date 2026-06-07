import { useMemo, useState } from "react";
import { format, isPast, isToday, isSameDay } from "date-fns";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface TimelineItem {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  progress: number;
}

interface TimelineProps {
  goals: TimelineItem[] | undefined;
}

const Timeline = ({ goals }: TimelineProps) => {
  const sorted = useMemo(
    () =>
      goals
        ?.filter((g) => g.due_date)
        .sort(
          (a, b) =>
            new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime(),
        ) ?? [],
    [goals],
  );

  const dueDates = useMemo(
    () => sorted.map((g) => new Date(g.due_date!)),
    [sorted],
  );

  const [selected, setSelected] = useState<Date | undefined>(undefined);

  const itemsForSelected = selected
    ? sorted.filter((g) => isSameDay(new Date(g.due_date!), selected))
    : [];

  if (sorted.length === 0) {
    return (
      <div className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold text-foreground mb-2">
          Timeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Add goals with due dates to see your timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">
        Timeline
      </h2>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        {/* Visual timeline */}
        <div className="relative ml-3 order-2 lg:order-1">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-6">
            {sorted.map((goal, i) => {
              const date = new Date(goal.due_date!);
              const overdue =
                goal.status !== "completed" && isPast(date) && !isToday(date);
              const isComplete = goal.status === "completed";
              const isHighlighted = selected && isSameDay(date, selected);

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={cn(
                    "relative pl-6 rounded-md -ml-2 pr-2 py-1 transition-colors",
                    isHighlighted && "bg-primary/10",
                  )}
                >
                  <div className="absolute left-2 top-2 -translate-x-1/2">
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : overdue ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium ${isComplete ? "line-through text-muted-foreground" : overdue ? "text-destructive" : "text-foreground"}`}
                    >
                      {goal.title}
                    </p>
                    <p
                      className={`text-xs ${overdue ? "text-destructive/70" : "text-muted-foreground"}`}
                    >
                      {format(date, "MMM d, yyyy")}
                      {overdue && " · Overdue"}
                    </p>
                    <div className="mt-1 h-1 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : overdue ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Mini calendar */}
        <div className="order-1 lg:order-2 lg:w-[280px]">
          <div className="rounded-lg border border-border bg-card/50">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={setSelected}
              modifiers={{ due: dueDates }}
              modifiersClassNames={{
                due: "relative font-semibold text-primary after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
              }}
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
          {selected && (
            <div className="mt-3 text-xs">
              <p className="font-medium text-foreground">
                {format(selected, "EEE, MMM d")}
              </p>
              {itemsForSelected.length === 0 ? (
                <p className="text-muted-foreground mt-1">
                  Nothing due this day.
                </p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {itemsForSelected.map((g) => (
                    <li key={g.id}>• {g.title}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
