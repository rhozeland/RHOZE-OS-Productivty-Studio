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
import { motion, AnimatePresence } from "framer-motion";
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
  ArrowUp,
  ArrowDown,
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
  Rocket,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Heart,
  Compass,

} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchCreatorContext } from "@/lib/creator-context";
import { composeMilestoneDescription, type DraftedMilestone, type AssetRef, type MilestonePhase, PHASE_ORDER, PHASE_LABELS } from "@/hooks/useAiRoadmapDraft";
import StartProjectPicker from "@/components/project/StartProjectPicker";

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

  // User type — fan vs creator drives section ordering + CTA copy.
  const { data: userType } = useQuery<"fan" | "creator">({
    queryKey: ["studio-user-type", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("user_id", user!.id)
        .maybeSingle();
      return ((data as any)?.user_type ?? "creator") as "fan" | "creator";
    },
  });
  const isFan = userType === "fan";

  // Backing — projects this user has cheered (project_cheers).
  const { data: backedProjects } = useQuery({
    queryKey: ["studio-backed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_cheers")
        .select(
          "created_at, project:projects(id,title,is_public,public_slug,user_id,status,profiles:profiles!projects_user_id_fkey(display_name,avatar_url,username))",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) return [];
      return ((data ?? []) as any[])
        .map((r) => ({ cheered_at: r.created_at, ...(r.project ?? {}) }))
        .filter((p) => p && p.id);
    },
  });
  const backedIds = useMemo(
    () => (backedProjects ?? []).map((p: any) => p.id),
    [backedProjects],
  );
  const { data: backedGoals } = useQuery<GoalRow[]>({
    queryKey: ["studio-backed-goals", backedIds.join(",")],
    enabled: backedIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_goals")
        .select("id,project_id,status,completed_at,due_date")
        .in("project_id", backedIds);
      return (data ?? []) as GoalRow[];
    },
  });

  // Holdings — simulated coin holdings.
  const { data: holdings } = useQuery({
    queryKey: ["studio-holdings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("coin_holdings")
        .select(
          "balance, sol_invested, launch:coin_launches(id,name,ticker,image_url,virtual_sol_reserves,virtual_token_reserves,total_supply,creator:profiles!coin_launches_creator_id_fkey(display_name,avatar_url,username,user_id))",
        )
        .eq("trader_id", user!.id)
        .gt("balance", 0)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return (data ?? []) as any[];
    },
  });

  // Weekly $RHOZE earnings — sum positive credit_transactions in last 7d.
  const { data: weekEarnings = 0 } = useQuery<number>({
    queryKey: ["studio-week-earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data } = await supabase
        .from("credit_transactions")
        .select("amount,type")
        .eq("user_id", user!.id)
        .gte("created_at", since);
      return (data ?? [])
        .filter((r: any) => Number(r.amount) > 0)
        .reduce((s: number, r: any) => s + Number(r.amount), 0);
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

  const livePublicProjects = useMemo(
    () =>
      (projects ?? []).filter(
        (p) => p.is_public && p.public_slug && p.status !== "completed",
      ),
    [projects],
  );
  const [liveIdx, setLiveIdx] = useState(0);
  const featuredPublic = livePublicProjects[liveIdx % Math.max(1, livePublicProjects.length)];

  // Group backed-project goals for milestone progress on Backing cards.
  const backedGoalsByProject = useMemo(() => {
    const m = new Map<string, GoalRow[]>();
    (backedGoals ?? []).forEach((g) => {
      const arr = m.get(g.project_id) ?? [];
      arr.push(g);
      m.set(g.project_id, arr);
    });
    return m;
  }, [backedGoals]);

  const hasAnyActivity =
    (projects ?? []).length > 0 ||
    (backedProjects ?? []).length > 0 ||
    (holdings ?? []).length > 0;


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
      {/* Header — gradient banner */}
      <StudioHeroBox
        totalActive={totalActive}
        milestonesDueThisWeek={milestonesDueThisWeek}
        draftCount={draftProjects.length}
        completedCount={completedProjects.length}
        emptyMode={!hasAnyActivity}
      />

      {/* Primary actions — role-adaptive */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isFan ? (
          <GradientCtaButton
            onClick={() => navigate("/discover")}
            Icon={Compass}
            eyebrow="Build in public"
            title="Discover Artists"
            subtitle="Find creators worth backing."
            gradient="linear-gradient(120deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 25%, hsl(38 92% 55%) 50%, hsl(292 84% 61%) 75%, hsl(330 85% 60%) 100%)"
          />
        ) : (
          <GradientCtaButton
            onClick={() => setStartProjectOpen(true)}
            Icon={Rocket}
            eyebrow="Build in public"
            title="Start a Project"
            subtitle="Plan a release. Let fans back the work."
            gradient="linear-gradient(120deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 25%, hsl(38 92% 55%) 50%, hsl(292 84% 61%) 75%, hsl(330 85% 60%) 100%)"
          />
        )}
        {isFan ? (
          <GradientCtaButton
            onClick={() => navigate("/discover?filter=projects")}
            Icon={Heart}
            eyebrow="Get backed"
            title="Back a Project"
            subtitle="Cheer on releases in motion."
            gradient="linear-gradient(120deg, hsl(200 90% 55%) 0%, hsl(260 80% 60%) 25%, hsl(170 80% 50%) 50%, hsl(260 80% 60%) 75%, hsl(200 90% 55%) 100%)"
          />
        ) : (
          <GradientCtaButton
            onClick={() => setCoinSheetOpen(true)}
            Icon={Coins}
            eyebrow="Get backed"
            title="Launch a Coin"
            subtitle="Spin up your artist token on pump.fun."
            gradient="linear-gradient(120deg, hsl(200 90% 55%) 0%, hsl(260 80% 60%) 25%, hsl(170 80% 50%) 50%, hsl(260 80% 60%) 75%, hsl(200 90% 55%) 100%)"
          />
        )}
      </section>

      {/* Live release banner — only if user owns a live public project */}
      {featuredPublic && (
        <div className="relative rounded-2xl overflow-hidden border border-border bg-foreground text-background dark:bg-card dark:text-foreground px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-background/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] font-semibold mb-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live release
              </span>
              <p className="text-sm font-semibold truncate">{featuredPublic.title}</p>
              <p className="text-[11px] opacity-75 mt-0.5">
                {supporterCounts?.[featuredPublic.id] ?? 0} supporter
                {(supporterCounts?.[featuredPublic.id] ?? 0) === 1 ? "" : "s"} ·{" "}
                {projectStats(featuredPublic).done} of {projectStats(featuredPublic).total} milestones
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {livePublicProjects.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLiveIdx((i) => i + 1)}
                  className="h-7 w-7 rounded-full bg-background/10 hover:bg-background/20 flex items-center justify-center transition-colors"
                  aria-label="Next live release"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              <Link
                to={`/release/${featuredPublic.public_slug}`}
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                View release <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Brand-new user empty state */}
      {!hasAnyActivity && !isLoading && (
        <EmptyStudioCard
          onStart={() => setStartProjectOpen(true)}
          onDiscover={() => navigate("/discover")}
        />
      )}

      {/* Three sections — order depends on role */}
      {hasAnyActivity && (
        <div className="space-y-10">
          {(() => {
            const sectionBuilding = (projects ?? []).length > 0 ? (
              <BuildingSection
                key="building"
                activeProjects={activeProjects}
                draftProjects={draftProjects}
                completedProjects={completedProjects}
                statsFor={projectStats}
                supporterCounts={supporterCounts ?? {}}
                milestonesDueThisWeek={milestonesDueThisWeek}
                onStart={() => setStartProjectOpen(true)}
              />
            ) : (
              <BuildingEmpty key="building" onStart={() => setStartProjectOpen(true)} />
            );

            const sectionBacking = (backedProjects ?? []).length > 0 ? (
              <BackingSection
                key="backing"
                projects={backedProjects ?? []}
                goalsByProject={backedGoalsByProject}
              />
            ) : null;

            const sectionHolding = (holdings ?? []).length > 0 ? (
              <HoldingSection key="holding" holdings={holdings ?? []} />
            ) : null;

            const ordered = isFan
              ? [sectionBacking, sectionBuilding, sectionHolding]
              : [sectionBuilding, sectionBacking, sectionHolding];
            return ordered.filter(Boolean);
          })()}
        </div>
      )}

      {/* Weekly $RHOZE earnings prompt */}
      {weekEarnings > 0 && (
        <Link
          to="/credits"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors px-5 py-3.5"
        >
          <p className="text-sm text-foreground">
            You've earned{" "}
            <span className="font-semibold tabular-nums">
              {Math.round(weekEarnings).toLocaleString()}
            </span>{" "}
            <span className="text-muted-foreground">$RHOZE</span> this week
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground shrink-0">
            View your Pass <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      )}


      {/* Start a Project picker (v11 Pillar 9 — AI prompt or empty page) */}
      <StartProjectPicker
        open={startProjectOpen}
        onOpenChange={setStartProjectOpen}
      />

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

// ─────────────────────────────────────────────────────────────────────
// StudioHeroBox — animated gradient slider header
// ─────────────────────────────────────────────────────────────────────
function StudioHeroBox({
  totalActive,
  milestonesDueThisWeek,
  draftCount,
  completedCount,
  emptyMode = false,
}: {
  totalActive: number;
  milestonesDueThisWeek: number;
  draftCount: number;
  completedCount: number;
  emptyMode?: boolean;
}) {

  const slides = [
    {
      id: "active",
      label: "Active",
      value: totalActive,
      hint: `${totalActive === 1 ? "release" : "releases"} in motion`,
      gradient:
        "linear-gradient(120deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 25%, hsl(38 92% 55%) 50%, hsl(292 84% 61%) 75%, hsl(330 85% 60%) 100%)",
    },
    {
      id: "due",
      label: "Due this week",
      value: milestonesDueThisWeek,
      hint: `${milestonesDueThisWeek === 1 ? "milestone" : "milestones"} on deck`,
      gradient:
        "linear-gradient(120deg, hsl(200 90% 55%) 0%, hsl(260 80% 60%) 25%, hsl(170 80% 50%) 50%, hsl(260 80% 60%) 75%, hsl(200 90% 55%) 100%)",
    },
    {
      id: "drafts",
      label: "Drafts",
      value: draftCount,
      hint: `${draftCount === 1 ? "idea" : "ideas"} cooking`,
      gradient:
        "linear-gradient(120deg, hsl(20 90% 60%) 0%, hsl(340 85% 60%) 25%, hsl(280 80% 55%) 50%, hsl(340 85% 60%) 75%, hsl(20 90% 60%) 100%)",
    },
    {
      id: "completed",
      label: "Completed",
      value: completedCount,
      hint: `${completedCount === 1 ? "release" : "releases"} shipped`,
      gradient:
        "linear-gradient(120deg, hsl(170 80% 45%) 0%, hsl(200 90% 55%) 25%, hsl(260 80% 60%) 50%, hsl(200 90% 55%) 75%, hsl(170 80% 45%) 100%)",
    },
  ];

  const slide = slides[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative w-full rounded-3xl overflow-hidden shadow-[0_30px_80px_-30px_hsl(var(--foreground)/0.4)]"
    >
      <div
        className="absolute inset-0 bg-[length:300%_300%] animate-gradient-shift"
        style={{ backgroundImage: slide.gradient }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, hsl(0 0% 100% / 0.25), transparent 40%), radial-gradient(circle at 80% 70%, hsl(0 0% 100% / 0.18), transparent 45%)",
          }}
        />
        <motion.div
          aria-hidden
          className="absolute -top-12 -right-10 h-48 w-48 rounded-full bg-white/20 blur-3xl"
          animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-14 -left-10 h-56 w-56 rounded-full bg-white/15 blur-3xl"
          animate={{ y: [0, -14, 0], x: [0, 12, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative px-5 py-4 sm:px-6 sm:py-5 text-white flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.22em] text-white/80">
            Workspace
          </p>
          <h1 className="font-display text-xl sm:text-2xl leading-tight tracking-tight drop-shadow-sm">
            Studio
          </h1>
        </div>

        {emptyMode ? (
          <div className="min-w-0 text-right">
            <p className="font-display text-lg sm:text-xl font-bold leading-tight drop-shadow-sm">
              Let's build something
            </p>
          </div>
        ) : (
          <div className="min-w-0 text-right">
            <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums leading-none">
              {slide.value}
            </p>
            <p className="text-[11px] text-white/85 mt-1 truncate">
              {slide.hint}
            </p>
          </div>
        )}

      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GradientCtaButton — single gradient CTA tile
// ─────────────────────────────────────────────────────────────────────
function GradientCtaButton({
  onClick,
  Icon,
  eyebrow,
  title,
  subtitle,
  gradient,
}: {
  onClick: () => void;
  Icon: typeof Rocket;
  eyebrow: string;
  title: string;
  subtitle: string;
  gradient: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl text-left text-white shadow-[0_20px_50px_-20px_hsl(var(--foreground)/0.4)] transition-transform hover:scale-[1.015] active:scale-[0.99] bg-[length:300%_300%] animate-gradient-shift"
      style={{ backgroundImage: gradient }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, hsl(0 0% 100% / 0.25), transparent 40%), radial-gradient(circle at 80% 70%, hsl(0 0% 100% / 0.18), transparent 45%)",
        }}
        animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden
        className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/20 blur-2xl"
        animate={{ y: [0, 12, 0], x: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative p-5 sm:p-6 flex flex-col gap-3 min-h-[148px]">
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-semibold">
          <Icon className="h-3 w-3" />
          {eyebrow}
        </span>
        <div className="mt-auto">
          <h3 className="font-display text-xl sm:text-2xl font-bold leading-tight drop-shadow-sm">
            {title}
          </h3>
          <p className="text-xs sm:text-sm opacity-95 mt-1">{subtitle}</p>
        </div>
        <span className="absolute right-4 bottom-4 h-9 w-9 rounded-full bg-white text-foreground flex items-center justify-center shadow-lg transition-transform group-hover:translate-x-0.5">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

