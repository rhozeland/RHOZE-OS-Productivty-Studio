import { Progress } from "@/components/ui/progress";
import { BarChart3, CheckCircle2, Clock, Target } from "lucide-react";
import { motion } from "framer-motion";

interface ProgressChartProps {
  goals: Array<{ status: string; progress: number }> | undefined;
  tasks: Array<{ completed: boolean | null }> | undefined;
}

const ProgressChart = ({ goals, tasks }: ProgressChartProps) => {
  const totalGoals = goals?.length ?? 0;
  const completedGoals = goals?.filter((g) => g.status === "completed").length ?? 0;
  const inProgressGoals = goals?.filter((g) => g.status === "in_progress").length ?? 0;
  const avgProgress = totalGoals > 0 ? Math.round((goals?.reduce((a, g) => a + g.progress, 0) ?? 0) / totalGoals) : 0;

  const totalTasks = tasks?.length ?? 0;
  const completedTasks = tasks?.filter((t) => t.completed).length ?? 0;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const stats = [
    { label: "Overall Progress", value: `${avgProgress}%`, progress: avgProgress, icon: BarChart3, color: "text-primary" },
    { label: "Tasks Done", value: `${completedTasks}/${totalTasks}`, progress: taskProgress, icon: CheckCircle2, color: "text-green-500" },
    { label: "Goals Completed", value: `${completedGoals}/${totalGoals}`, progress: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0, icon: Target, color: "text-primary" },
    { label: "In Progress", value: `${inProgressGoals}`, progress: totalGoals > 0 ? (inProgressGoals / totalGoals) * 100 : 0, icon: Clock, color: "text-amber-500" },
  ];

  return (
    <div className="surface-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">Progress Overview</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
            <Progress value={stat.progress} className="mt-2 h-1.5" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ProgressChart;
