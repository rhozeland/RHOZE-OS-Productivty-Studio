/**
 * Studio — Musician workspace.
 *
 * Header counts + two primary CTAs (Start a Project / Start a Coin),
 * a status card for an active public project, three tabs
 * (Active · Drafts · Completed) and the project card grid.
 *
 * "Start a Project" → existing AI-roadmap flow (description → auto-draft).
 * "Start a Coin"    → eligibility check sheet that links into the
 *                     existing token submission flow (`/settings#token`).
 */
import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles,
  Coins,
  ArrowRight,
  ArrowUpRight,
  Check,
  X,
  Loader2,
  CalendarDays,
  Users,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchCreatorContext } from "@/lib/creator-context";
import { composeMilestoneDescription, type DraftedMilestone, type AssetRef, type MilestonePhase, PHASE_ORDER, PHASE_LABELS } from "@/hooks/useAiRoadmapDraft";

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  cover_color: string | null;
  created_at: string;
  updated_at: string;
  is_public: boolean | null;
  public_slug: string | null;
  cheer_count: number | null;
  tokenize_ready: boolean | null;
}

interface GoalRow {
  id: string;
  project_id: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
}

const startOfWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
};
const endOfWeek = () => {
  const d = startOfWeek();
  d.setDate(d.getDate() + 7);
  return d;
};

const StudioPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const [startProjectOpen, setStartProjectOpen] = useState(
    searchParams.get("start") === "1",
  );

  // Open the Start-a-Project dialog when navigated with ?start=1
  useEffect(() => {
    if (searchParams.get("start") === "1") {
      setStartProjectOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("start");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [coinSheetOpen, setCoinSheetOpen] = useState(
    searchParams.get("coin") === "1",
  );

  useEffect(() => {
    if (searchParams.get("coin") === "1") {
      setCoinSheetOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("coin");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [projectBrief, setProjectBrief] = useState("");
  const [creating, setCreating] = useState(false);
  type Phase = "brief" | "generating" | "preview";
  const [phase, setPhase] = useState<Phase>("brief");
  const [draftedMilestones, setDraftedMilestones] = useState<DraftedMilestone[]>([]);
  const [draftedTitle, setDraftedTitle] = useState("");
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState("Reading your brief");

  // Simulated progress ticker while AI drafts (asymptotic to 92%).
  useEffect(() => {
    if (phase !== "generating") return;
    setGenProgress(4);
    setGenStatus("Reading your brief");
    const stages = [
      { at: 0, label: "Reading your brief" },
      { at: 18, label: "Studying your style & recent work" },
      { at: 38, label: "Shaping milestones" },
      { at: 60, label: "Writing marketing strategy" },
      { at: 78, label: "Setting target metrics" },
      { at: 88, label: "Polishing your roadmap" },
    ];
    const interval = setInterval(() => {
      setGenProgress((p) => {
        // ease toward 92, slower as it climbs
        const next = p + Math.max(0.4, (92 - p) * 0.06);
        const capped = Math.min(92, next);
        const stage = [...stages].reverse().find((s) => capped >= s.at);
        if (stage) setGenStatus(stage.label);
        return capped;
      });
    }, 320);
    return () => clearInterval(interval);
  }, [phase]);

  const resetDialog = () => {
    setPhase("brief");
    setDraftedMilestones([]);
    setDraftedTitle("");
    setProjectBrief("");
    setCreating(false);
    setGenProgress(0);
  };

  // ── data ───────────────────────────────────────────────────────────
  const { data: projects, isLoading } = useQuery<ProjectRow[]>({
    queryKey: ["studio-projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,title,description,status,cover_color,created_at,updated_at,is_public,public_slug,cheer_count,tokenize_ready",
        )
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectRow[];
    },
  });

  const projectIds = useMemo(() => (projects ?? []).map((p) => p.id), [projects]);

  const { data: goals } = useQuery<GoalRow[]>({
    queryKey: ["studio-goals", projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_goals")
        .select("id,project_id,status,due_date,completed_at")
        .in("project_id", projectIds);
      if (error) throw error;
      return (data ?? []) as GoalRow[];
    },
  });

  // Supporter counts (one query)
  const { data: supporterCounts } = useQuery<Record<string, number>>({
    queryKey: ["studio-supporters", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("creator_subscriptions")
        .select("creator_user_id")
        .eq("creator_user_id", user!.id);
      const total = (data ?? []).length;
      // Whole-creator count, applied to every public project.
      const map: Record<string, number> = {};
      (projects ?? [])
        .filter((p) => p.is_public)
        .forEach((p) => (map[p.id] = total));
      return map;
    },
  });

  // ── derived ────────────────────────────────────────────────────────
  const goalsByProject = useMemo(() => {
    const m = new Map<string, GoalRow[]>();
    (goals ?? []).forEach((g) => {
      const arr = m.get(g.project_id) ?? [];
      arr.push(g);
      m.set(g.project_id, arr);
    });
    return m;
  }, [goals]);

  const projectStats = (p: ProjectRow) => {
    const list = goalsByProject.get(p.id) ?? [];
    const total = list.length;
    const done = list.filter((g) => g.status === "completed" || g.completed_at).length;
    const wkStart = startOfWeek();
    const wkEnd = endOfWeek();
    const dueThisWeek = list.filter((g) => {
      if (g.status === "completed" || g.completed_at) return false;
      if (!g.due_date) return false;
      const d = new Date(g.due_date);
      return d >= wkStart && d < wkEnd;
    }).length;
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000),
    );
    return { total, done, dueThisWeek, days };
  };

  const activeProjects = (projects ?? []).filter(
    (p) => p.status !== "completed" && (p.is_public || (goalsByProject.get(p.id)?.length ?? 0) > 0),
  );
  const draftProjects = (projects ?? []).filter(
    (p) => p.status !== "completed" && !p.is_public && (goalsByProject.get(p.id)?.length ?? 0) === 0,
  );
  const completedProjects = (projects ?? []).filter((p) => p.status === "completed");

  const totalActive = activeProjects.length;
  const milestonesDueThisWeek = (projects ?? []).reduce(
    (sum, p) => sum + projectStats(p).dueThisWeek,
    0,
  );

  const featuredPublic = useMemo(
    () =>
      (projects ?? []).find(
        (p) => p.is_public && p.public_slug && p.status !== "completed",
      ),
    [projects],
  );

  // ── draft roadmap (phase 1: AI only, no project saved yet) ─────────
  const draftRoadmap = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      const brief = projectBrief.trim();
      if (brief.length < 8) throw new Error("Describe what you want to make.");

      setPhase("generating");
      const firstLine = brief.split(/\n|\.|—|·/)[0].trim();
      const title = firstLine.slice(0, 60) || "Untitled release";

      const ctx = await fetchCreatorContext(user.id, "Creator");
      const { data: drafted, error } = await supabase.functions.invoke(
        "draft-project-roadmap",
        {
          body: {
            projectName: title,
            totalBudget: 0,
            tokenize_intent: !!ctx.token_mint,
            release_type: "other",
            brief: { what: brief },
            specialistProfile: ctx,
          },
        },
      );
      if (error) throw error;
      const milestones = ((drafted as any)?.milestones ?? []) as DraftedMilestone[];
      if (!milestones.length) throw new Error("AI couldn't draft a roadmap — try a more detailed brief.");
      return { title, milestones };
    },
    onSuccess: ({ title, milestones }) => {
      setDraftedTitle(title);
      setDraftedMilestones(milestones);
      setGenProgress(100);
      setGenStatus("Ready");
      setTimeout(() => setPhase("preview"), 350);
    },
    onError: (e: any) => {
      setPhase("brief");
      toast.error(e?.message || "Could not draft roadmap.");
    },
  });

  // ── save project (phase 2: persist after user approves the draft) ──
  const saveProject = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      setCreating(true);
      const brief = projectBrief.trim();
      const createdAfter = new Date().toISOString();
      const { error: insErr } = await supabase
        .from("projects")
        .insert({
          title: draftedTitle,
          description: brief,
          user_id: user.id,
          status: "active",
          project_type: "collaborative",
          cover_color: "#7c3aed",
        })
      if (insErr) throw insErr;

      const { data: created, error: fetchErr } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", draftedTitle)
        .gte("created_at", createdAfter)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!created?.id) throw new Error("Project was created, but could not be opened.");

      if (draftedMilestones.length) {
        const { error: goalsErr } = await (supabase as any)
          .from("project_goals")
          .insert(
            draftedMilestones.map((m, i) => ({
              project_id: created.id,
              user_id: user.id,
              title: m.title,
              description: composeMilestoneDescription(m),
              budget_amount: m.suggested_amount,
              sort_order: i,
              parent_id: null,
            })),
          );
        if (goalsErr) throw goalsErr;
      }
      return created.id as string;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["studio-projects", user?.id] });
      toast.success("Project created — opening your roadmap…");
      // Navigate first so the roadmap page mounts immediately; tear down
      // the dialog on the next tick so it doesn't steal focus or block the
      // route change.
      navigate(`/projects/${projectId}`);
      setTimeout(() => {
        setCreating(false);
        setStartProjectOpen(false);
        resetDialog();
      }, 50);
    },
    onError: (e: any) => {
      setCreating(false);
      toast.error(e?.message || "Could not create project.");
    },
  });

  // ── eligibility data ───────────────────────────────────────────────
  const { data: eligibility } = useQuery({
    queryKey: ["studio-eligibility", user?.id],
    enabled: !!user && coinSheetOpen,
    queryFn: async () => {
      const [profileRes, worksRes, subsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("avatar_url,bio,region_code,solana_wallet,verification_status")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("works")
          .select("id,is_verified,content_hash", { count: "exact", head: false })
          .eq("user_id", user!.id),
        (supabase as any)
          .from("creator_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("creator_user_id", user!.id),
      ]);
      const profile = profileRes.data as any;
      const worksList = (worksRes.data ?? []) as any[];
      const verified = worksList.filter(
        (w) => w.is_verified || !!w.content_hash,
      ).length;
      return {
        profileComplete:
          !!profile?.avatar_url && !!profile?.bio && (profile?.bio?.length ?? 0) >= 40,
        hasWork: worksList.length > 0,
        walletConnected: !!profile?.solana_wallet,
        verifiedIp: verified > 0,
        backers: (subsRes as any).count ?? 0,
      };
    },
  });

  // ── render ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="pt-2"
      >
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
          Workspace
        </p>
        <h1 className="font-display text-3xl sm:text-4xl leading-[1.05] text-foreground tracking-tight">
          Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {totalActive} active {totalActive === 1 ? "project" : "projects"} ·{" "}
          {milestonesDueThisWeek} milestone{milestonesDueThisWeek === 1 ? "" : "s"} due this week
        </p>
      </motion.header>

      {/* Primary actions */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setStartProjectOpen(true)}
          className="group w-full rounded-2xl bg-foreground text-background px-6 py-5 text-left shadow-md hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Start a Project
              </p>
              <p className="text-xs opacity-80 mt-1">
                Build in public. Fans follow your roadmap. Earn your coin.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>

        {featuredPublic && (
          <Link
            to={`/release/${featuredPublic.public_slug}`}
            className="block rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-3.5 hover:bg-emerald-500/10 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                  Live release
                </p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {featuredPublic.title} is live
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {supporterCounts?.[featuredPublic.id] ?? 0} supporter
                  {(supporterCounts?.[featuredPublic.id] ?? 0) === 1 ? "" : "s"} ·{" "}
                  {projectStats(featuredPublic).done} of {projectStats(featuredPublic).total} milestones
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground shrink-0">
                View release <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        )}

        <button
          type="button"
          onClick={() => setCoinSheetOpen(true)}
          className="group w-full rounded-2xl border border-border bg-background px-6 py-4 text-left hover:border-foreground/40 transition-colors"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <Coins className="h-4 w-4" /> Start a Coin
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Already have proven work? Launch directly.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </button>
      </section>

      {/* Tabs + project cards */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            Active
            {milestonesDueThisWeek > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {milestonesDueThisWeek} due
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="active">
              <ProjectList
                projects={activeProjects}
                statsFor={projectStats}
                supporterCounts={supporterCounts ?? {}}
                emptyLabel="No active projects. Start one above."
              />
            </TabsContent>
            <TabsContent value="drafts">
              <ProjectList
                projects={draftProjects}
                statsFor={projectStats}
                supporterCounts={supporterCounts ?? {}}
                emptyLabel="No drafts yet."
              />
            </TabsContent>
            <TabsContent value="completed">
              <ProjectList
                projects={completedProjects}
                statsFor={projectStats}
                supporterCounts={supporterCounts ?? {}}
                emptyLabel="Nothing finished yet."
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Start a Project dialog */}
      <Dialog
        open={startProjectOpen}
        onOpenChange={(o) => {
          setStartProjectOpen(o);
          if (!o) resetDialog();
        }}
      >
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {phase === "brief" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  Start a project — describe what you want to make
                </DialogTitle>
                <DialogDescription>
                  We'll draft a roadmap you can review before going live.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={projectBrief}
                onChange={(e) => setProjectBrief(e.target.value)}
                placeholder="e.g. I want to record a 5-track EP, shoot a music video for the lead single, and run a campaign to hit 1,000 streams in the first week."
                rows={6}
                className="resize-none"
              />
              {draftProjects.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5 max-h-44 overflow-auto">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Or make an existing draft public
                  </p>
                  {draftProjects.slice(0, 5).map((p) => (
                    <Link
                      key={p.id}
                      to={`/projects/${p.id}`}
                      onClick={() => setStartProjectOpen(false)}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-background text-xs"
                    >
                      <span className="truncate text-foreground">{p.title}</span>
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        Open <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setStartProjectOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => draftRoadmap.mutate()}
                  disabled={projectBrief.trim().length < 8}
                  className="gap-2"
                >
                  Generate My Roadmap <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogFooter>
            </>
          )}

          {phase === "generating" && (
            <div className="py-10 flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
                <div className="relative h-16 w-16 rounded-full bg-foreground text-background flex items-center justify-center">
                  <Sparkles className="h-7 w-7 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display text-xl text-foreground">
                  Our AI is drafting your roadmap…
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Shaping a custom release plan with milestones, marketing strategy, and target metrics. This takes about 10–20 seconds.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <Progress value={genProgress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {genStatus}
                  </span>
                  <span className="tabular-nums">{Math.round(genProgress)}%</span>
                </div>
              </div>
            </div>
          )}


          {phase === "preview" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl flex items-center gap-2">
                  <Sparkles className="h-5 w-5" /> Your roadmap is ready
                </DialogTitle>
                <DialogDescription>
                  Edit anything below — title, tasks, budget, references. Every field is yours to refine.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  Project title
                </label>
                <Input
                  value={draftedTitle}
                  onChange={(e) => setDraftedTitle(e.target.value)}
                  className="font-display text-base"
                />
              </div>

              <ol className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {(() => {
                  // Sort by phase order, then preserve original index for stable React keys + state ops.
                  const indexed = draftedMilestones.map((m, originalIndex) => ({ m, originalIndex }));
                  indexed.sort((a, b) => {
                    const pa = PHASE_ORDER.indexOf((a.m.phase ?? "pre_production") as MilestonePhase);
                    const pb = PHASE_ORDER.indexOf((b.m.phase ?? "pre_production") as MilestonePhase);
                    return pa - pb;
                  });
                  let lastPhase: MilestonePhase | null = null;
                  return indexed.map(({ m, originalIndex }, displayIdx) => {
                    const i = originalIndex;
                    const phase = (m.phase ?? "pre_production") as MilestonePhase;
                    const showPhaseHeader = phase !== lastPhase;
                    lastPhase = phase;
                    const update = (patch: Partial<DraftedMilestone>) =>
                      setDraftedMilestones((arr) =>
                        arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
                      );
                    const updateTask = (ti: number, val: string) =>
                      update({ tasks: (m.tasks ?? []).map((t, idx) => (idx === ti ? val : t)) });
                    const removeTask = (ti: number) =>
                      update({ tasks: (m.tasks ?? []).filter((_, idx) => idx !== ti) });
                    const addTask = () =>
                      update({ tasks: [...(m.tasks ?? []), ""] });
                    const updateRef = (ri: number, patch: Partial<AssetRef>) =>
                      update({
                        asset_refs: (m.asset_refs ?? []).map((r, idx) =>
                          idx === ri ? { ...r, ...patch } : r,
                        ),
                      });
                    const removeRef = (ri: number) =>
                      update({ asset_refs: (m.asset_refs ?? []).filter((_, idx) => idx !== ri) });
                    const addRef = () =>
                      update({
                        asset_refs: [
                          ...(m.asset_refs ?? []),
                          { label: "Reference", kind: "other" as const, url: "" },
                        ],
                      });

                    return (
                      <div key={i}>
                        {showPhaseHeader && (
                          <div className="flex items-center gap-2 mt-2 mb-2">
                            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-foreground/70">
                              {PHASE_LABELS[phase]}
                            </span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                        )}
                        <li className="rounded-xl border border-border bg-card p-4 space-y-3 list-none">
                          <div className="flex items-start gap-3">
                            <span className="mt-1.5 h-6 w-6 shrink-0 rounded-full bg-foreground text-background text-xs font-semibold flex items-center justify-center">
                              {displayIdx + 1}
                            </span>
                            <Input
                              value={m.title}
                              onChange={(e) => update({ title: e.target.value })}
                              className="font-semibold text-sm flex-1"
                            />
                            <select
                              value={phase}
                              onChange={(e) => update({ phase: e.target.value as MilestonePhase })}
                              className="h-8 rounded-md border border-input bg-background px-2 text-[11px]"
                            >
                              {PHASE_ORDER.map((p) => (
                                <option key={p} value={p}>{PHASE_LABELS[p]}</option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() =>
                                setDraftedMilestones((arr) => arr.filter((_, idx) => idx !== i))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>


                      <div className="grid grid-cols-3 gap-2 pl-9">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                            When
                          </label>
                          <Input
                            value={m.timeline_window ?? ""}
                            onChange={(e) => update({ timeline_window: e.target.value })}
                            placeholder="Week 1"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                            Days
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={m.est_days}
                            onChange={(e) => update({ est_days: Number(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                            Budget USD
                          </label>
                          <Input
                            type="number"
                            min={0}
                            value={m.suggested_amount}
                            onChange={(e) =>
                              update({ suggested_amount: Number(e.target.value) || 0 })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="pl-9 space-y-1">
                        <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                          Deliverables
                        </label>
                        <Textarea
                          value={m.deliverables}
                          onChange={(e) => update({ deliverables: e.target.value })}
                          rows={3}
                          className="text-xs resize-none"
                        />
                      </div>

                      <div className="pl-9 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                            Tasks
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1"
                            onClick={addTask}
                          >
                            <Plus className="h-3 w-3" /> Add task
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {(m.tasks ?? []).map((t, ti) => (
                            <div key={ti} className="flex items-center gap-1.5">
                              <span className="text-muted-foreground text-xs">•</span>
                              <Input
                                value={t}
                                onChange={(e) => updateTask(ti, e.target.value)}
                                className="h-7 text-xs flex-1"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => removeTask(ti)}
                              >
                                <X className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pl-9 space-y-1">
                        <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                          Marketing strategy
                        </label>
                        <Textarea
                          value={m.marketing_strategy ?? ""}
                          onChange={(e) => update({ marketing_strategy: e.target.value })}
                          rows={2}
                          className="text-xs resize-none"
                        />
                      </div>

                      <div className="pl-9 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                            Target metric
                          </label>
                          <Input
                            value={m.target_metric?.name ?? ""}
                            onChange={(e) =>
                              update({
                                target_metric: {
                                  name: e.target.value,
                                  value: m.target_metric?.value ?? "",
                                },
                              })
                            }
                            placeholder="Holders"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                            Value
                          </label>
                          <Input
                            value={m.target_metric?.value ?? ""}
                            onChange={(e) =>
                              update({
                                target_metric: {
                                  name: m.target_metric?.name ?? "",
                                  value: e.target.value,
                                },
                              })
                            }
                            placeholder="150"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="pl-9 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                            Attachments (links, videos, images, docs)
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] gap-1"
                            onClick={addRef}
                          >
                            <Plus className="h-3 w-3" /> Add link
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {(m.asset_refs ?? []).map((r, ri) => (
                            <div key={ri} className="grid grid-cols-[80px_1fr_1fr_auto] gap-1.5 items-center">
                              <select
                                value={r.kind}
                                onChange={(e) => updateRef(ri, { kind: e.target.value as AssetRef["kind"] })}
                                className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px]"
                              >
                                <option value="moodboard">Moodboard</option>
                                <option value="reference_track">Track</option>
                                <option value="video">Video</option>
                                <option value="image">Image</option>
                                <option value="doc">Doc</option>
                                <option value="contract">Contract</option>
                                <option value="other">Other</option>
                              </select>
                              <Input
                                value={r.label}
                                onChange={(e) => updateRef(ri, { label: e.target.value })}
                                placeholder="Label"
                                className="h-7 text-xs"
                              />
                              <div className="relative">
                                <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <Input
                                  value={r.url ?? ""}
                                  onChange={(e) => updateRef(ri, { url: e.target.value })}
                                  placeholder="https://…"
                                  className="h-7 text-xs pl-6"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => removeRef(ri)}
                              >
                                <X className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ))}
                          {(m.asset_refs ?? []).length === 0 && (
                            <p className="text-[11px] text-muted-foreground/70 italic">
                              No attachments yet. Add reference tracks, moodboards, video drafts, or contracts.
                            </p>
                          )}
                        </div>
                      </div>
                        </li>
                      </div>
                    );
                  });
                })()}
              </ol>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setDraftedMilestones((arr) => [
                      ...arr,
                      {
                        title: "New milestone",
                        deliverables: "",
                        suggested_amount: 0,
                        est_days: 7,
                        tasks: [],
                        timeline_window: `Week ${arr.length + 1}`,
                        marketing_strategy: "",
                        target_metric: { name: "", value: "" },
                        asset_refs: [],
                        risks: "",
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add milestone
                </Button>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Total: $
                  {draftedMilestones
                    .reduce((s, m) => s + (Number(m.suggested_amount) || 0), 0)
                    .toLocaleString()}{" "}
                  · {draftedMilestones.reduce((s, m) => s + (Number(m.est_days) || 0), 0)} days
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setPhase("brief")}
                  disabled={creating}
                >
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={() => draftRoadmap.mutate()}
                  disabled={creating}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" /> Regenerate
                </Button>
                <Button
                  onClick={() => saveProject.mutate()}
                  disabled={creating || draftedMilestones.length === 0 || !draftedTitle.trim()}
                  className="gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating project…
                    </>
                  ) : (
                    <>
                      Create project <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Eligibility sheet */}
      <Sheet open={coinSheetOpen} onOpenChange={setCoinSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">
              Before you can launch a coin
            </SheetTitle>
            <SheetDescription>
              Here's what you need before going live on pump.fun.
            </SheetDescription>
          </SheetHeader>

          {!eligibility ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <EligibilityChecklist
              data={eligibility}
              onAction={(href) => {
                setCoinSheetOpen(false);
                navigate(href);
              }}
            />
          )}

          <div className="mt-6 space-y-2 border-t border-border pt-4">
            <Link
              to="/why-coin"
              onClick={() => setCoinSheetOpen(false)}
              className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Or start a project first — build in public and earn your coin →
            </Link>
            <Link
              to="/label-services"
              onClick={() => setCoinSheetOpen(false)}
              className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Apply for A&R — Rhozeland handles everything →
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ─── Project card list ───────────────────────────────────────────────
interface ProjectListProps {
  projects: ProjectRow[];
  statsFor: (p: ProjectRow) => { total: number; done: number; dueThisWeek: number; days: number };
  supporterCounts: Record<string, number>;
  emptyLabel: string;
}

const ProjectList = ({ projects, statsFor, supporterCounts, emptyLabel }: ProjectListProps) => {
  if (projects.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-12">{emptyLabel}</p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          stats={statsFor(p)}
          supporters={supporterCounts[p.id] ?? 0}
        />
      ))}
    </div>
  );
};

const ProjectCard = ({
  project,
  stats,
  supporters,
}: {
  project: ProjectRow;
  stats: { total: number; done: number; dueThisWeek: number; days: number };
  supporters: number;
}) => {
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const statusLabel =
    project.status === "completed"
      ? "Completed"
      : (project.is_public || stats.total > 0)
        ? "Active"
        : "Draft";

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-5 hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/30 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
            {statusLabel}
          </p>
          <h3 className="font-display text-lg font-semibold text-foreground truncate">
            {project.title}
          </h3>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
            project.is_public
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {project.is_public ? (
            <>
              <Eye className="h-3 w-3" /> Public
            </>
          ) : (
            <>
              <EyeOff className="h-3 w-3" /> Private
            </>
          )}
        </span>
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-muted-foreground tabular-nums">
              {stats.done} of {stats.total} completed
            </span>
            <span className="text-foreground tabular-nums font-medium">{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3" /> {stats.days}d active
          </span>
          {project.is_public && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3 w-3" /> {supporters}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
            View Project <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};

// ─── Eligibility checklist ───────────────────────────────────────────
interface EligibilityData {
  profileComplete: boolean;
  hasWork: boolean;
  walletConnected: boolean;
  verifiedIp: boolean;
  backers: number;
}

const EligibilityChecklist = ({
  data,
  onAction,
}: {
  data: EligibilityData;
  onAction: (href: string) => void;
}) => {
  const items = [
    {
      label: "Profile complete",
      met: data.profileComplete,
      actionLabel: "Complete profile",
      href: "/settings",
    },
    {
      label: "At least 1 work posted",
      met: data.hasWork,
      actionLabel: "Upload work",
      href: "/settings#provenance",
    },
    {
      label: "Phantom wallet connected",
      met: data.walletConnected,
      actionLabel: "Connect wallet",
      href: "/settings#wallet",
    },
    {
      label: "At least 1 piece of IP verified",
      met: data.verifiedIp,
      actionLabel: "Verify IP",
      href: "/settings/verification",
    },
    {
      label: "At least 5 backers",
      met: data.backers >= 5,
      actionLabel: data.backers > 0 ? `${data.backers} of 5 so far` : "Get backers",
      href: "/profile",
    },
  ];

  const metCount = items.filter((i) => i.met).length;
  const pct = Math.round((metCount / items.length) * 100);
  const allMet = metCount === items.length;

  return (
    <div className="mt-6 space-y-5">
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground tabular-nums">
            {metCount} of {items.length} requirements met
          </span>
          <span className="font-medium text-foreground tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                  item.met ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {item.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </span>
              <span
                className={cn(
                  "text-sm truncate",
                  item.met ? "text-foreground" : "text-foreground/80",
                )}
              >
                {item.label}
              </span>
            </div>
            {!item.met && (
              <button
                type="button"
                onClick={() => onAction(item.href)}
                className="text-[11px] font-medium text-foreground hover:underline underline-offset-2 shrink-0"
              >
                {item.actionLabel} →
              </button>
            )}
          </li>
        ))}
      </ul>

      <Button
        disabled={!allMet}
        onClick={() => onAction("/settings#token")}
        className="w-full gap-2"
      >
        <Coins className="h-4 w-4" />
        {allMet ? "Start a Coin" : "Complete requirements to unlock"}
      </Button>
    </div>
  );
};

export default StudioPage;
