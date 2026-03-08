import { format, isPast, isToday } from "date-fns";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

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
  const sorted = goals
    ?.filter((g) => g.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()) ?? [];

  if (sorted.length === 0) {
    return (
      <div className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold text-foreground mb-2">Timeline</h2>
        <p className="text-sm text-muted-foreground">Add goals with due dates to see your timeline.</p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <h2 className="font-display text-lg font-semibold text-foreground mb-4">Timeline</h2>
      <div className="relative ml-3">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-6">
          {sorted.map((goal, i) => {
            const date = new Date(goal.due_date!);
            const overdue = goal.status !== "completed" && isPast(date) && !isToday(date);
            const isComplete = goal.status === "completed";

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="relative pl-6"
              >
                <div className="absolute left-0 top-1 -translate-x-1/2">
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : overdue ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${isComplete ? "line-through text-muted-foreground" : overdue ? "text-destructive" : "text-foreground"}`}>
                    {goal.title}
                  </p>
                  <p className={`text-xs ${overdue ? "text-destructive/70" : "text-muted-foreground"}`}>
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
    </div>
  );
};

export default Timeline;
