/**
 * Horizontal scrolling milestone track for the Overview tab. Completed cards
 * are full color, upcoming are muted, the active one gets a soft glow ring.
 * Used in both ProjectDetailPage and ReleasePage (public). Toggle is wired
 * up only when canManage is true.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Circle } from "lucide-react";
import { toast } from "sonner";

interface Milestone {
  id: string;
  title: string;
  status?: string | null;
  sort_order?: number | null;
  due_date?: string | null;
}

interface Props {
  milestones: Milestone[] | null | undefined;
  contractId?: string | null;
  canManage?: boolean;
}

const isDone = (s?: string | null) => s === "approved" || s === "released";
const isActive = (s?: string | null) => s === "in_progress" || s === "submitted";

const MilestoneTrack = ({ milestones, contractId, canManage }: Props) => {
  const queryClient = useQueryClient();
  const list = milestones ?? [];

  const toggle = useMutation({
    mutationFn: async (m: Milestone) => {
      const next = isDone(m.status) ? "pending" : "approved";
      const { error } = await supabase
        .from("project_milestones")
        .update({ status: next })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-milestones", contractId] });
      queryClient.invalidateQueries({ queryKey: ["release-milestones", contractId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!list.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
        {canManage && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            Head to the Roadmap tab to plan the first one.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="-mx-4 md:mx-0">
      <div className="flex gap-3 overflow-x-auto px-4 md:px-0 pb-2 snap-x snap-mandatory scrollbar-thin">
        {list.map((m, i) => {
          const done = isDone(m.status);
          const active = isActive(m.status);
          return (
            <div
              key={m.id}
              className={[
                "snap-start shrink-0 w-[200px] md:w-[240px] rounded-xl border p-4 transition",
                done
                  ? "bg-card border-border"
                  : active
                    ? "bg-card border-primary/40 ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                    : "bg-card/40 border-border opacity-70 hover:opacity-100",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  M{(m.sort_order ?? i) + 1}
                </span>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => canManage && toggle.mutate(m)}
                  className={[
                    "h-5 w-5 rounded-full grid place-items-center border transition",
                    done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : active
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground",
                    canManage ? "cursor-pointer hover:scale-110" : "cursor-default",
                  ].join(" ")}
                  aria-label={done ? "Mark incomplete" : "Mark complete"}
                >
                  {done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
                </button>
              </div>
              <h3 className="font-medium text-sm leading-snug line-clamp-2">{m.title}</h3>
              {m.due_date && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {new Date(m.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              )}
              {active && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[9px] px-2 py-0.5 font-medium uppercase tracking-wider">
                  Now
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MilestoneTrack;
