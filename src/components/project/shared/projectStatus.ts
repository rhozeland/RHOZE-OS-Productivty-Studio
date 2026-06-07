/**
 * Shared status helper for ProjectDetailPage + ReleasePage hero pill.
 * Live = roadmap not yet locked or no progress. In Progress = at least one
 * milestone moving. Completed = every milestone approved/released and >0.
 */
export type ProjectStatus = "live" | "in_progress" | "completed";

export function computeProjectStatus(milestones: Array<{ status?: string | null }> | null | undefined): ProjectStatus {
  const ms = milestones ?? [];
  if (!ms.length) return "live";
  const done = ms.filter((m) => m.status === "approved" || m.status === "released").length;
  if (done === ms.length) return "completed";
  const moving = ms.some((m) => m.status === "in_progress" || m.status === "submitted");
  if (moving) return "in_progress";
  return "live";
}

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; dot: string; pill: string }
> = {
  live: {
    label: "Live",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  completed: {
    label: "Completed",
    dot: "bg-sky-500",
    pill: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
};
