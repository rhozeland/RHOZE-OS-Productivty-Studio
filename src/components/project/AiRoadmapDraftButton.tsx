/**
 * AiRoadmapDraftButton — entry point for drafting a roadmap on a fresh project.
 *
 * v11 Pillar 8 update: voice mic moved out of this surface — by the time
 * a project exists, the brief is locked. Voice intake now lives on the
 * <ProposalSheet /> summary field (where the brief is actually authored).
 * This button is now purely an AI re-draft from existing project context,
 * plus a Concierge handoff banner on success.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAiRoadmapDraft, composeMilestoneDescription, chainMilestoneDates, type DraftedMilestone } from "@/hooks/useAiRoadmapDraft";
import { fetchCreatorContext } from "@/lib/creator-context";
import { ConciergeIntakeSheet } from "@/components/concierge/ConciergeIntakeSheet";
import { trackConciergeCta } from "@/lib/concierge-analytics";
import { todayGradient } from "@/lib/rhoze-gradients";

interface Props {
  projectId: string;
  projectTitle: string;
  totalBudget: number;
  clientId?: string | null;
  specialistId?: string | null;
  existingGoalCount: number;
}

const PROGRESS_STEPS = [
  "Reading your brief…",
  "Pulling your recent work and style…",
  "Drafting milestones…",
  "Budgeting each stage…",
  "Mapping marketing strategy…",
  "Finalising your roadmap…",
];

export const AiRoadmapDraftButton = ({
  projectId,
  projectTitle,
  totalBudget,
  clientId,
  specialistId,
  existingGoalCount,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const draft = useAiRoadmapDraft();
  const grad = todayGradient();

  const [busy, setBusy] = useState(false);
  const [showConcierge, setShowConcierge] = useState(false);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [doneMilestones, setDoneMilestones] = useState<DraftedMilestone[] | null>(null);
  const autoFiredRef = useRef(false);


  const generate = useMutation({
    mutationFn: async () => {
      setBusy(true);
      setProgressOpen(true);
      setProgressPct(8);
      setStepIdx(0);
      setDoneMilestones(null);

      const [clientCtx, specialistCtx] = await Promise.all([
        fetchCreatorContext(clientId, "Client"),
        fetchCreatorContext(specialistId, "Creator"),
      ]);

      const tokenize_intent = !!specialistCtx.token_mint;

      let briefText: string | null = null;
      try { briefText = sessionStorage.getItem("startProjectAiPrompt"); } catch { /* ignore */ }

      const milestones = await draft.mutateAsync({
        projectName: projectTitle,
        totalBudget,
        tokenize_intent,
        release_type: "other",
        brief: briefText ? { what: briefText } : undefined,
        clientProfile: clientCtx,
        specialistProfile: specialistCtx,
      });

      if (!milestones.length) throw new Error("No milestones returned");

      const dates = chainMilestoneDates(milestones);
      const rows = milestones.map((m, i) => ({
        project_id: projectId,
        user_id: user!.id,
        title: m.title,
        description: composeMilestoneDescription(m),
        budget_amount: m.suggested_amount,
        sort_order: existingGoalCount + i,
        parent_id: null,
        stage_date_start: dates[i].stage_date_start,
        stage_date_end: dates[i].stage_date_end,
        due_date: dates[i].due_date,
      })) as any;
      const { error } = await supabase.from("project_goals" as any).insert(rows);
      if (error) throw error;

      // Also seed the Tasks card with the AI's per-milestone tasks so the
      // Overview tab isn't empty after auto-draft.
      const taskRows = milestones.flatMap((m) =>
        (m.tasks ?? []).slice(0, 4).map((t) => ({
          project_id: projectId,
          user_id: user!.id,
          title: t,
          completed: false,
        })),
      );
      if (taskRows.length) {
        await supabase.from("tasks" as any).insert(taskRows);
      }
      return milestones;
    },
    onSuccess: (milestones) => {
      qc.invalidateQueries({ queryKey: ["project-goals", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      setProgressPct(100);
      setStepIdx(PROGRESS_STEPS.length - 1);
      setDoneMilestones(milestones ?? []);
      toast.success("Roadmap ready.");
      setShowConcierge(true);
      trackConciergeCta("impression", { projectId, source: "ai-draft-button" });
      try { sessionStorage.removeItem("startProjectAiPrompt"); } catch { /* ignore */ }
    },
    onError: (e: any) => {
      setProgressOpen(false);
      toast.error(e.message ?? "Couldn't draft roadmap");
      try { sessionStorage.removeItem("startProjectAiPrompt"); } catch { /* ignore */ }
    },
    onSettled: () => setBusy(false),
  });

  const isWorking = busy || generate.isPending;

  // Animate progress + cycle status copy while the AI is working.
  useEffect(() => {
    if (!isWorking) return;
    const stepTimer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, PROGRESS_STEPS.length - 2));
    }, 1800);
    const pctTimer = setInterval(() => {
      setProgressPct((p) => (p >= 92 ? 92 : p + Math.max(1, Math.round((92 - p) * 0.08))));
    }, 350);
    return () => { clearInterval(stepTimer); clearInterval(pctTimer); };
  }, [isWorking]);

  // Auto-fire once when the project was created via "Build with AI" picker.
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (existingGoalCount > 0) return;
    if (!user?.id) return;
    let mode: string | null = null;
    try { mode = sessionStorage.getItem("startProjectMode"); } catch { /* ignore */ }
    if (mode !== "ai") return;
    autoFiredRef.current = true;
    try { sessionStorage.removeItem("startProjectMode"); } catch { /* ignore */ }
    generate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, existingGoalCount]);

  const closeProgress = () => {
    setProgressOpen(false);
    setDoneMilestones(null);
    setProgressPct(0);
    setStepIdx(0);
  };


  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {existingGoalCount > 0 ? "Want more milestones?" : "Empty roadmap?"}
          </p>
          <p className="text-xs text-muted-foreground">
            Draft milestones from the project brief — edit freely after.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isWorking}
            onClick={() => generate.mutate()}
          >
            {isWorking
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Wand2 className="h-3.5 w-3.5" />}
            {existingGoalCount > 0 ? "Suggest more" : "Draft a roadmap"}
          </Button>
        </div>
      </div>

      {showConcierge && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Want our A&amp;R team to run this with you?
              </p>
              <p className="text-xs text-muted-foreground">
                Rhozeland A&amp;R / Artist Development takes the draft, refines the milestones, and project-manages the release end-to-end.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                trackConciergeCta("dismissed", { projectId, source: "ai-draft-button" });
                setShowConcierge(false);
              }}
            >
              Not now
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                trackConciergeCta("intake", { projectId, source: "ai-draft-button" });
                setConciergeOpen(true);
              }}
            >
              Book a call
            </Button>
          </div>
        </div>
      )}

      <ConciergeIntakeSheet open={conciergeOpen} onOpenChange={setConciergeOpen} />

      {/* Generation progress + result preview */}
      <Dialog
        open={progressOpen}
        onOpenChange={(o) => { if (!o && !isWorking) closeProgress(); }}
      >
        <DialogContent className="max-w-lg border-border/70 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
          {/* Halo */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: grad.surface }} />

          <div className="relative p-6 sm:p-8">
            {!doneMilestones ? (
              <>
                <div className="flex flex-col items-center text-center">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center text-white shadow-md"
                    style={{ background: grad.text }}
                  >
                    <Sparkles className="h-5 w-5 animate-pulse" />
                  </div>
                  <DialogTitle className="font-display text-xl sm:text-2xl tracking-tight mt-4">
                    Drafting your roadmap…
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    Rhozeland is tailoring milestones to your brief — usually 15–30 seconds.
                  </DialogDescription>
                </div>

                <div className="mt-6">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progressPct}%`, background: grad.text }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {PROGRESS_STEPS[stepIdx]}
                    </span>
                    <span className="font-mono text-muted-foreground">{progressPct}%</span>
                  </div>
                </div>

                <ul className="mt-6 space-y-1.5">
                  {PROGRESS_STEPS.slice(0, -1).map((s, i) => (
                    <li key={s} className="flex items-center gap-2 text-xs">
                      {i < stepIdx ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : i === stepIdx ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border border-border" />
                      )}
                      <span className={i <= stepIdx ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <DialogTitle className="font-display text-xl sm:text-2xl tracking-tight mt-4">
                    Your roadmap is ready
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    {doneMilestones.length} milestones drafted for <span className="text-foreground font-medium">{projectTitle}</span>.
                  </DialogDescription>
                </div>

                <ol className="mt-6 space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                  {doneMilestones.map((m, i) => (
                    <li key={i} className="rounded-xl border border-border bg-background/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {i + 1}. {m.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {m.deliverables}
                          </p>
                          {(m.timeline_window || m.est_days) && (
                            <p className="text-[10px] text-muted-foreground/80 mt-1">
                              {m.timeline_window || `${m.est_days}d`}
                              {m.target_metric?.value ? ` · 🎯 ${m.target_metric.name}: ${m.target_metric.value}` : ""}
                            </p>
                          )}
                        </div>
                        {m.suggested_amount > 0 && (
                          <span className="text-xs font-mono font-semibold text-foreground shrink-0">
                            ${m.suggested_amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={closeProgress}>
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={closeProgress}
                  >
                    View full roadmap
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

};

export default AiRoadmapDraftButton;
