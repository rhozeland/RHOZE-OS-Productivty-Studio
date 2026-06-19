/**
 * ProjectRolloutTab — empty-canvas marketing rollout planner with an AI sidekick.
 *
 * Pillar: artists land on an empty Rollout canvas, enter their budget +
 * release type, and the sidekick drafts a week-by-week marketing roadmap
 * (teaser → pre-save → release day → post-launch). The user reviews the
 * generated milestones, edits the brief if needed, then one-clicks
 * "Add to roadmap" to push them into `project_goals`.
 *
 * Reuses the existing `useAiRoadmapDraft` hook + Gemini-backed
 * `draft-project-roadmap` edge fn, but biases the brief toward marketing
 * via a prepended "marketing rollout" framing so milestones come back
 * channel-aware (TikTok / IG / pre-save / press / paid) instead of
 * generic production stages.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Wand2, Megaphone, Plus, CheckCircle2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAiRoadmapDraft,
  composeMilestoneDescription,
  chainMilestoneDates,
  type DraftedMilestone,
} from "@/hooks/useAiRoadmapDraft";
import { fetchCreatorContext } from "@/lib/creator-context";

type ReleaseType = "single" | "visual" | "ep" | "album" | "merch" | "tour" | "other";

const RELEASE_OPTIONS: { id: ReleaseType; label: string; hint: string }[] = [
  { id: "single", label: "Single", hint: "One song, ~6-8 week rollout" },
  { id: "visual", label: "Music video", hint: "Teaser → drop → reactions" },
  { id: "ep", label: "EP", hint: "3-5 tracks, layered campaign" },
  { id: "album", label: "Album", hint: "Long lead, multi-single rollout" },
  { id: "merch", label: "Merch drop", hint: "Limited-run product launch" },
  { id: "other", label: "Other", hint: "Custom campaign" },
];

interface Props {
  projectId: string;
  projectOwnerId: string;
  ownerProfileId: string;
  isOwner: boolean;
  existingGoalCount: number;
}

const ProjectRolloutTab = ({
  projectId,
  ownerProfileId,
  isOwner,
  existingGoalCount,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const draft = useAiRoadmapDraft();

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [releaseType, setReleaseType] = useState<ReleaseType>("single");
  const [budget, setBudget] = useState<string>("1000");
  const [targetDate, setTargetDate] = useState<string>("");
  const [vibe, setVibe] = useState<string>("");
  const [generated, setGenerated] = useState<DraftedMilestone[] | null>(null);

  // Manual milestone form
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualBudget, setManualBudget] = useState<string>("");
  const [manualStart, setManualStart] = useState<string>("");
  const [manualEnd, setManualEnd] = useState<string>("");

  const releaseLabel = useMemo(
    () => RELEASE_OPTIONS.find((r) => r.id === releaseType)?.label ?? "release",
    [releaseType],
  );

  const { data: existingGoals } = useQuery({
    queryKey: ["project-goals", projectId, "count-only"],
    queryFn: async () => {
      const { count } = await supabase
        .from("project_goals" as any)
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      return count ?? existingGoalCount;
    },
    initialData: existingGoalCount,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const budgetNum = Math.max(0, Number(budget) || 0);
      const targetWindow = targetDate
        ? `Release target: ${targetDate}`
        : `Release in ~8 weeks from today`;

      const briefWhat = [
        `Marketing rollout for a ${releaseLabel.toLowerCase()}.`,
        `Total marketing budget: $${budgetNum.toLocaleString()}.`,
        `Focus the milestones on promotion only — teaser content, pre-save / pre-add, release-day push, paid social, PR / playlist pitching, and post-release momentum.`,
        `Skip recording / mixing / mastering stages — production is already covered elsewhere.`,
        vibe.trim() ? `Creative angle: ${vibe.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const ownerCtx = await fetchCreatorContext(ownerProfileId, "Creator");

      const milestones = await draft.mutateAsync({
        projectName: `${releaseLabel} rollout`,
        totalBudget: budgetNum,
        release_type: releaseType,
        target_window: targetWindow,
        brief: {
          what: briefWhat,
          when: targetWindow,
          vibe: vibe.trim() || undefined,
        },
        specialistProfile: ownerCtx,
        tokenize_intent: !!ownerCtx.token_mint,
      });

      if (!milestones.length) throw new Error("No rollout returned");
      return milestones;
    },
    onSuccess: (milestones) => {
      setGenerated(milestones);
      toast.success("Rollout drafted — review below.");
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Couldn't draft rollout");
    },
  });

  const insertToRoadmap = useMutation({
    mutationFn: async () => {
      if (!generated?.length || !user?.id) throw new Error("Nothing to insert");
      const dates = chainMilestoneDates(generated);
      const rows = generated.map((m, i) => ({
        project_id: projectId,
        user_id: user.id,
        title: m.title,
        description: composeMilestoneDescription(m),
        budget_amount: m.suggested_amount,
        sort_order: (existingGoals ?? 0) + i,
        parent_id: null,
        stage_date_start: dates[i].stage_date_start,
        stage_date_end: dates[i].stage_date_end,
        due_date: dates[i].due_date,
      })) as any;
      const { error } = await supabase.from("project_goals" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-goals", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Added to Roadmap");
      setGenerated(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't add to roadmap"),
  });

  const insertManual = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      const title = manualTitle.trim();
      if (!title) throw new Error("Add a title");
      const row = {
        project_id: projectId,
        user_id: user.id,
        title,
        description: manualDesc.trim() || null,
        budget_amount: Math.max(0, Number(manualBudget) || 0),
        sort_order: existingGoals ?? 0,
        parent_id: null,
        stage_date_start: manualStart || null,
        stage_date_end: manualEnd || null,
        due_date: manualEnd || null,
      } as any;
      const { error } = await supabase.from("project_goals" as any).insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-goals", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Milestone added");
      setManualTitle("");
      setManualDesc("");
      setManualBudget("");
      setManualStart("");
      setManualEnd("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't add milestone"),
  });

  const isWorking = generate.isPending;

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
        <Megaphone className="mx-auto h-6 w-6 text-muted-foreground/60 mb-2" />
        <p className="text-sm text-muted-foreground">
          Only the project owner can plan the rollout.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,1.4fr]">
      {/* Sidekick brief panel */}
      <aside className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-5">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary/10 p-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold">Rollout sidekick</h3>
            <p className="text-[11px] text-muted-foreground">
              Tell it the budget and what you're dropping.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">What are you releasing?</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {RELEASE_OPTIONS.map((opt) => {
                const active = releaseType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReleaseType(opt.id)}
                    className={`text-left rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/70 hover:border-foreground/40"
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        active ? "text-background/70" : "text-muted-foreground"
                      }`}
                    >
                      {opt.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="rollout-budget" className="text-xs">
              Marketing budget (USD)
            </Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <Input
                id="rollout-budget"
                type="number"
                min={0}
                step={50}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="1000"
                className="pl-6 h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="rollout-date" className="text-xs">
              Target release date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="rollout-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1.5 h-9 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="rollout-vibe" className="text-xs">
              Vibe / angle <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="rollout-vibe"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="e.g. nostalgic summer R&B, lean into the late-night TikTok crowd"
              rows={3}
              className="mt-1.5 text-sm"
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={() => generate.mutate()}
          disabled={isWorking}
          className="w-full gap-2"
        >
          {isWorking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Drafting rollout…
            </>
          ) : generated ? (
            <>
              <Wand2 className="h-4 w-4" /> Re-draft
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" /> Draft rollout
            </>
          )}
        </Button>
      </aside>

      {/* Canvas */}
      <section className="space-y-4">
        {!generated && !isWorking && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center min-h-[320px] flex flex-col items-center justify-center">
            <Megaphone className="h-7 w-7 text-muted-foreground/50 mb-3" />
            <h3 className="font-display text-base font-semibold">Empty canvas</h3>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
              Set your budget and release on the left, then ask the sidekick to
              draft a marketing rollout. Nothing locks in until you say so.
            </p>
          </div>
        )}

        {isWorking && (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center min-h-[320px] flex flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">
              Drafting your {releaseLabel.toLowerCase()} rollout…
            </p>
          </div>
        )}

        {generated && !isWorking && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold">
                  Suggested rollout
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {generated.length} milestones · review before adding to your roadmap
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => insertToRoadmap.mutate()}
                disabled={insertToRoadmap.isPending}
                className="gap-2"
              >
                {insertToRoadmap.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add to Roadmap
              </Button>
            </div>

            <ol className="space-y-3">
              {generated.map((m, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border/70 bg-card/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <h4 className="font-display text-sm font-semibold truncate">
                          {m.title}
                        </h4>
                      </div>
                      {m.timeline_window && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          🗓 {m.timeline_window}
                        </p>
                      )}
                    </div>
                    {m.suggested_amount > 0 && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums">
                        ${m.suggested_amount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-foreground/80 whitespace-pre-wrap">
                    {m.deliverables}
                  </p>

                  {m.marketing_strategy && (
                    <div className="mt-2.5 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                        Strategy
                      </p>
                      <p className="text-[11px] text-foreground/85">
                        {m.marketing_strategy}
                      </p>
                    </div>
                  )}

                  {m.target_metric?.name && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      🎯 <span className="font-medium text-foreground">{m.target_metric.name}:</span>{" "}
                      {m.target_metric.value}
                    </p>
                  )}

                  {m.tasks?.length ? (
                    <ul className="mt-2.5 space-y-1">
                      {m.tasks.slice(0, 5).map((t, ti) => (
                        <li
                          key={ti}
                          className="flex items-start gap-1.5 text-[11px] text-foreground/75"
                        >
                          <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
};

export default ProjectRolloutTab;
