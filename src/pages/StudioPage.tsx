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
  Play,
  Music,
  Image as ImageIcon,
  Radio,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { fetchCreatorContext } from "@/lib/creator-context";
import { composeMilestoneDescription, chainMilestoneDates, type DraftedMilestone, type AssetRef, type MilestonePhase, PHASE_ORDER, PHASE_LABELS } from "@/hooks/useAiRoadmapDraft";
import StartProjectPicker from "@/components/project/StartProjectPicker";
import LaunchCoinFlowModal from "@/components/launchpad/LaunchCoinFlowModal";
import AttachCoinLauncher from "@/components/coin/AttachCoinLauncher";
import { ConciergeIntakeSheet } from "@/components/concierge/ConciergeIntakeSheet";

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
  // CTA mode: musicians/creators see "Start a Project" + "Launch a Coin".
  // Fans (or anyone who has already shipped a project) see discovery CTAs.
  const hasOwnProjects = (projects ?? []).length > 0;
  const isFan = userType === "fan";
  const showDiscoverCtas = isFan && !hasOwnProjects;

  // Backing — projects this user has cheered (project_cheers). PostgREST
  // cannot embed `profiles` directly off `projects` (the FK on projects.user_id
  // points to auth.users, not public.profiles), so we fetch profiles in a
  // second round-trip and merge.
  const { data: backedProjects } = useQuery({
    queryKey: ["studio-backed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: cheerRows, error } = await (supabase as any)
        .from("project_cheers")
        .select("project_id, created_at, shared_to_profile")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) return [];

      const projectIds = Array.from(
        new Set(((cheerRows ?? []) as any[]).map((row) => row.project_id).filter(Boolean)),
      );
      if (projectIds.length === 0) return [];

      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, title, is_public, public_slug, user_id, status")
        .in("id", projectIds);
      if (projectsError) return [];

      const projectById = new Map((projectsData ?? []).map((project: any) => [project.id, project]));
      const rows = ((cheerRows ?? []) as any[])
        .map((row) => {
          const project = projectById.get(row.project_id);
          if (!project?.is_public) return null;
          return {
            ...project,
            cheered_at: row.created_at,
            shared_to_profile: !!row.shared_to_profile,
          };
        })
        .filter(Boolean) as any[];

      const ownerIds = Array.from(new Set(rows.map((p: any) => p.user_id).filter(Boolean)));
      if (ownerIds.length === 0) return rows;
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, username")
        .in("user_id", ownerIds);
      const byId = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      return rows.map((p: any) => ({ ...p, profiles: byId.get(p.user_id) ?? null }));
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

      // Use the same AI title generator the rest of the app uses so the
      // project gets a punchy, music-native name instead of the raw brief.
      let title = "";
      try {
        const { data: gen, error: genErr } = await supabase.functions.invoke(
          "generate-project-title",
          { body: { prompt: brief } },
        );
        if (genErr) throw genErr;
        title = ((gen as any)?.title ?? "").trim();
      } catch {
        title = "";
      }
      if (!title) {
        const firstLine = brief.split(/\n|\.|—|·/)[0].trim();
        title = firstLine.slice(0, 60) || "Untitled release";
      }

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

      // Insert and return the new row directly — avoids a race / title
      // collision when looking the project up by title afterwards.
      const { data: created, error: insErr } = await supabase
        .from("projects")
        .insert({
          title: draftedTitle,
          description: brief,
          vision: brief, // populates the Overview tab
          user_id: user.id,
          status: "active",
          project_type: "collaborative",
          cover_color: "#7c3aed",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      if (!created?.id) throw new Error("Project was created, but could not be opened.");

      if (draftedMilestones.length) {
        const dates = chainMilestoneDates(draftedMilestones);
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
              stage_date_start: dates[i].stage_date_start,
              stage_date_end: dates[i].stage_date_end,
              due_date: dates[i].due_date,
            })),
          );
        if (goalsErr) throw goalsErr;

        // Flatten AI-generated per-milestone tasks into the project's task list
        // so the Overview "Tasks" card isn't empty after the AI run.
        const taskRows = draftedMilestones.flatMap((m) =>
          (m.tasks ?? []).slice(0, 4).map((t) => ({
            project_id: created.id,
            user_id: user.id,
            title: t,
            completed: false,
          })),
        );
        if (taskRows.length) {
          await (supabase as any).from("tasks").insert(taskRows);
        }
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

  // Rhozeland A&R intake mode — "new" (fresh release) vs "grow" (existing work).
  const [arIntent, setArIntent] = useState<"new" | "grow">("new");
  const [arSheetOpen, setArSheetOpen] = useState(false);

  // ── render ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-12">
      {/* Editorial header */}
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="font-display text-4xl font-light tracking-tight text-foreground">
            Releases
          </h1>
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-muted-foreground mt-2">
            Artist Workspace / Rhoze
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-mono text-muted-foreground">
            {totalActive} {totalActive === 1 ? "release" : "releases"} in motion
            {milestonesDueThisWeek > 0 && ` · ${milestonesDueThisWeek} due this week`}
          </span>
        </div>
      </header>

      {/* Core Actions Grid — 4 modular tiles */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border/60 border border-border/60 rounded-sm overflow-hidden">
        {/* 1. Rhozeland A&R */}
        <div className="bg-card p-6 flex flex-col justify-between group hover:bg-muted/40 transition-colors">
          <div>
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-mono text-emerald-500 border border-emerald-500/40 px-2 py-0.5 tracking-wider">
                STRATEGY
              </span>
              <div className="flex bg-background p-1 rounded border border-border/60">
                <button
                  type="button"
                  onClick={() => setArIntent("new")}
                  className={cn(
                    "px-2 py-1 text-[9px] font-mono rounded transition-colors",
                    arIntent === "new"
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  NEW
                </button>
                <button
                  type="button"
                  onClick={() => setArIntent("grow")}
                  className={cn(
                    "px-2 py-1 text-[9px] font-mono rounded transition-colors",
                    arIntent === "grow"
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  GROW
                </button>
              </div>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Rhozeland A&R</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {arIntent === "new"
                ? "Tell us the vision — we co-produce, market, and split the upside."
                : "Bring an existing track — we scale reach and set a fair split."}
            </p>
            <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
              Intake · budget · cut split
            </p>
          </div>
          <button
            type="button"
            onClick={() => setArSheetOpen(true)}
            className="mt-8 w-full py-3 border border-border text-xs font-mono uppercase tracking-wider text-foreground hover:bg-foreground hover:text-background transition-all"
          >
            Open Intake
          </button>
        </div>

        {/* 2. Attach / Back with Coin */}
        <div className="bg-card p-6 flex flex-col justify-between group hover:bg-muted/40 transition-colors">
          <div>
            <span className="text-[10px] font-mono text-purple-500 border border-purple-500/40 px-2 py-0.5 mb-6 inline-block tracking-wider">
              LIQUIDITY
            </span>
            <h3 className="text-lg font-medium text-foreground mb-2">Attach a Coin</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Link a $coin to a project or a track. Every post inside inherits the coin — social proof + upside built in.
            </p>
            <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
              Project · track · content
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCoinSheetOpen(true)}
            className="mt-8 w-full py-3 bg-purple-500/10 border border-purple-500/40 text-purple-600 dark:text-purple-300 text-xs font-mono uppercase tracking-wider hover:bg-purple-500 hover:text-white transition-all"
          >
            Link Coin
          </button>
        </div>

        {/* 3. Start Blank */}
        <div className="bg-card p-6 flex flex-col justify-between group hover:bg-muted/40 transition-colors">
          <div>
            <span className="text-[10px] font-mono text-muted-foreground border border-border px-2 py-0.5 mb-6 inline-block tracking-wider">
              CREATE
            </span>
            <h3 className="text-lg font-medium text-foreground mb-2">New Release</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Spin up a fresh project — vision, milestones, files. AI drafts the roadmap around your style.
            </p>
            <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
              Full project workspace
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStartProjectOpen(true)}
            className="mt-8 w-full py-3 border border-border text-xs font-mono uppercase tracking-wider text-foreground hover:bg-foreground hover:text-background transition-all"
          >
            Start Blank
          </button>
        </div>

        {/* 4. Post to Flow */}
        <button
          type="button"
          onClick={() => navigate("/flow?share=1")}
          className="bg-card p-6 border-dashed border-2 border-border/50 flex flex-col items-center justify-center text-center group hover:border-emerald-500/50 hover:bg-muted/40 transition-all"
        >
          <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Rocket className="w-5 h-5 text-muted-foreground rotate-45" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Post a Work</h3>
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
            Audio · Video · Photo → Flow
          </p>
        </button>
      </section>

      {/* Live release strip — subtle */}
      {featuredPublic && (
        <Link
          to={`/release/${featuredPublic.public_slug}`}
          className="group flex items-center justify-between gap-4 border-l-2 border-emerald-500 pl-4 py-2 hover:bg-muted/40 transition-colors"
        >
          <div className="min-w-0 flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500">
              Live
            </span>
            <span className="text-sm text-foreground font-medium truncate">
              {featuredPublic.title}
            </span>
            <span className="hidden sm:inline text-[11px] font-mono text-muted-foreground">
              · {supporterCounts?.[featuredPublic.id] ?? 0} supporter
              {(supporterCounts?.[featuredPublic.id] ?? 0) === 1 ? "" : "s"}
              {" · "}
              {projectStats(featuredPublic).done}/{projectStats(featuredPublic).total} milestones
            </span>
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1 shrink-0">
            View <ArrowUpRight className="h-3 w-3" />
          </span>
        </Link>
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
            const sectionBuilding = hasOwnProjects ? (
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
            ) : null;

            const sectionHolding = (holdings ?? []).length > 0 ? (
              <HoldingSection key="holding" holdings={holdings ?? []} />
            ) : null;

            return [sectionBuilding, sectionHolding].filter(Boolean);
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

      {/* Attach a Coin — paste CA → pick target → celebrate */}
      <AttachCoinLauncher
        open={coinSheetOpen}
        onOpenChange={setCoinSheetOpen}
      />

      {/* Rhozeland A&R intake */}
      <ConciergeIntakeSheet
        open={arSheetOpen}
        onOpenChange={setArSheetOpen}
        initialTier="curated"
      />


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

/**
 * ProjectCard — SoundCloud-style release row.
 * Wide album-cover thumb (with waveform accent), title + status,
 * a slim progress bar with % ticker and meta chips. Reads more like
 * a record in a crate than a productivity task card.
 */
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
      ? "Shipped"
      : (project.is_public || stats.total > 0)
        ? "Live"
        : "Sketch";
  const accent = project.cover_color || "#111111";
  const cover = (project as any).cover_image_url as string | undefined;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group relative flex gap-3 items-stretch bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-foreground/30 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_hsl(var(--foreground)/0.2)] transition-all duration-300"
    >
      {/* Album cover */}
      <div
        className="relative w-24 sm:w-28 shrink-0 overflow-hidden"
        style={{ background: cover ? undefined : `linear-gradient(135deg, ${accent}, ${accent}88 55%, transparent)` }}
      >
        {cover ? (
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            {/* Waveform sketch */}
            <div className="absolute inset-x-0 bottom-3 flex items-end justify-center gap-[3px] h-10 opacity-70">
              {[3, 6, 4, 8, 5, 9, 6, 4, 7, 3, 6, 8, 5].map((h, i) => (
                <span key={i} className="w-[3px] bg-white/80 rounded-full" style={{ height: `${h * 3}px` }} />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/30" />
          </>
        )}
        {/* Play affordance */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25">
          <span className="h-8 w-8 rounded-full bg-white flex items-center justify-center">
            <Play className="h-3.5 w-3.5 fill-black text-black translate-x-[1px]" />
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-grow min-w-0 py-3 pr-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-display text-base font-semibold text-foreground truncate leading-tight">
              {project.title}
            </h4>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mt-1 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  statusLabel === "Live" && "text-emerald-500",
                  statusLabel === "Shipped" && "text-foreground/80",
                )}
              >
                {statusLabel === "Live" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {statusLabel}
              </span>
              <span className="text-foreground/20">·</span>
              {project.is_public ? (
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-2.5 w-2.5" /> Public
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <EyeOff className="h-2.5 w-2.5" /> Private
                </span>
              )}
              {stats.dueThisWeek > 0 && (
                <>
                  <span className="text-foreground/20">·</span>
                  <span className="text-amber-500">{stats.dueThisWeek} due</span>
                </>
              )}
            </p>
          </div>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0 mt-0.5">
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 h-[3px] w-full bg-muted/60 rounded-full overflow-hidden">
          <div
            className="h-full transition-all rounded-full"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>

        {/* Meta */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-[10px] font-mono text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-2.5 w-2.5" /> {stats.days}d
            </span>
            {project.is_public && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-2.5 w-2.5" /> {supporters}
              </span>
            )}
            <span className="tabular-nums">
              {stats.done}/{stats.total || "—"}
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1 transition-colors">
            Open <ArrowRight className="h-2.5 w-2.5" />
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

// ─────────────────────────────────────────────────────────────────────
// Empty Studio card — brand new user
// ─────────────────────────────────────────────────────────────────────
function EmptyStudioCard({ onStart, onDiscover }: { onStart: () => void; onDiscover: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border p-6 sm:p-8 text-center bg-[length:300%_300%] animate-gradient-shift"
      style={{
        backgroundImage:
          "linear-gradient(120deg, hsl(330 85% 60% / 0.12) 0%, hsl(292 84% 61% / 0.12) 50%, hsl(200 90% 55% / 0.12) 100%)",
      }}
    >
      <p className="font-display text-lg sm:text-xl font-semibold text-foreground max-w-md mx-auto">
        Your Studio is empty — start building or back an artist to see your work here.
      </p>
      <div className="mt-5 flex flex-wrap gap-3 justify-center">
        <Button onClick={onStart} className="gap-2">
          <Rocket className="h-4 w-4" /> Start a Project
        </Button>
        <Button variant="outline" onClick={onDiscover} className="gap-2">
          <Compass className="h-4 w-4" /> Discover Artists
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Section shell
// ─────────────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: typeof Pencil; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-foreground/70" />
      <h2 className="font-display text-lg font-semibold text-foreground">{label}</h2>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Building section
// ─────────────────────────────────────────────────────────────────────
function BuildingSection({
  activeProjects,
  draftProjects,
  completedProjects,
  statsFor,
  supporterCounts,
  milestonesDueThisWeek,
  onStart,
}: {
  activeProjects: ProjectRow[];
  draftProjects: ProjectRow[];
  completedProjects: ProjectRow[];
  statsFor: (p: ProjectRow) => { total: number; done: number; dueThisWeek: number; days: number };
  supporterCounts: Record<string, number>;
  milestonesDueThisWeek: number;
  onStart: () => void;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70 font-semibold mb-1.5 inline-flex items-center gap-2">
            <span className="h-px w-6 bg-foreground/40" />
            Workshop
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-none">
            In&nbsp;the&nbsp;Studio
            <span className="text-foreground/30">.</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5">
            Releases you're shaping — blueprints, drafts, and shipped work.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground/80 shrink-0">
          <Pencil className="h-3 w-3" />
          {activeProjects.length + draftProjects.length + completedProjects.length} total
        </span>
      </div>
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
          <TabsTrigger value="flow" className="gap-1.5">
            <Radio className="h-3 w-3" />
            Flow
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {activeProjects.length > 0 ? (
            <ProjectList
              projects={activeProjects}
              statsFor={statsFor}
              supporterCounts={supporterCounts}
              emptyLabel=""
            />
          ) : (
            <DashedAddCard onClick={onStart} />
          )}
        </TabsContent>
        <TabsContent value="drafts">
          {draftProjects.length > 0 ? (
            <div className="opacity-75">
              <ProjectList
                projects={draftProjects}
                statsFor={statsFor}
                supporterCounts={supporterCounts}
                emptyLabel=""
              />
            </div>
          ) : (
            <DashedAddCard onClick={onStart} label="+ Draft a new release" />
          )}
        </TabsContent>
        <TabsContent value="completed">
          {completedProjects.length > 0 ? (
            <div className="relative">
              <ProjectList
                projects={completedProjects}
                statsFor={statsFor}
                supporterCounts={supporterCounts}
                emptyLabel=""
              />
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nothing shipped yet — keep building.
            </p>
          )}
        </TabsContent>
        <TabsContent value="flow">
          <FlowDropsTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/**
 * FlowDropsTab — lets an artist scroll through everything they've
 * dropped on Flow right inside the Studio, so projects and posts live
 * side by side. Mirrors the profile Flow strip so the workspace feels
 * like the same crate.
 */
function FlowDropsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const worksQ = useQuery({
    queryKey: ["studio-flow-works", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("works")
        .select("id, title, kind, cover_url, thumbnail_url, created_at")
        .eq("user_id", user!.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(24);
      return data ?? [];
    },
  });

  const flowQ = useQuery({
    queryKey: ["studio-flow-items", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("flow_items")
        .select("id, title, category, file_url, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(24);
      return data ?? [];
    },
  });

  const items = useMemo(() => {
    const w = (worksQ.data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      cover: r.thumbnail_url || r.cover_url,
      href: `/works/${r.id}`,
      created_at: r.created_at,
    }));
    const f = (flowQ.data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      kind: r.category ?? "post",
      cover: r.file_url,
      href: `/flow?item=${r.id}`,
      created_at: r.created_at,
    }));
    return [...w, ...f]
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
      .slice(0, 24);
  }, [worksQ.data, flowQ.data]);

  if (worksQ.isLoading || flowQ.isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-muted/60 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <Radio className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-foreground">Nothing on Flow yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Drop audio, visuals, or photos and they'll surface here alongside your releases.
        </p>
        <Button asChild variant="outline" size="sm" className="rounded-full mt-4">
          <Link to="/settings#provenance">Post a work</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => navigate(item.href)}
          className="group relative aspect-square rounded-xl overflow-hidden bg-muted"
          title={item.title || "Untitled"}
        >
          {item.cover ? (
            <img
              src={item.cover}
              alt=""
              className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              {item.kind === "audio" || item.kind === "music" ? (
                <Music className="h-4 w-4" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </div>
          )}
          {item.kind === "video" && (
            <div className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center">
              <Play className="h-2.5 w-2.5 fill-white text-white" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
            <span className="block text-[10px] font-medium text-white truncate">
              {item.title || "Untitled"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function BuildingEmpty({ onStart }: { onStart: () => void }) {
  return (
    <section>
      <SectionHeader icon={Pencil} label="Building" />
      <DashedAddCard onClick={onStart} />
    </section>
  );
}

function DashedAddCard({ onClick, label = "+ Start your first project" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border-2 border-dashed border-border hover:border-foreground/40 bg-transparent px-6 py-10 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Backing section
// ─────────────────────────────────────────────────────────────────────
function BackingSection({
  projects,
  goalsByProject,
}: {
  projects: any[];
  goalsByProject: Map<string, GoalRow[]>;
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 via-fuchsia-500 to-amber-500 text-white shadow-sm">
          <Heart className="h-3.5 w-3.5" fill="currentColor" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
          Backing
        </h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {projects.length}
        </span>
      </div>
      <div className="-mx-1 px-1 overflow-x-auto">
        <div className="flex gap-4 pb-2 min-w-min">
          {projects.map((p) => {
            const goals = goalsByProject.get(p.id) ?? [];
            const total = goals.length;
            const done = goals.filter((g) => g.status === "completed" || g.completed_at).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const artist = p.profiles ?? {};
            const initial = (artist.display_name || artist.username || "A").charAt(0).toUpperCase();
            return (
              <Link
                key={p.id}
                to={p.public_slug ? `/release/${p.public_slug}` : `/projects/${p.id}`}
                className="group relative shrink-0 w-[280px] rounded-3xl overflow-hidden border border-border/60 bg-card hover:-translate-y-1 hover:border-foreground/40 hover:shadow-[0_24px_60px_-20px_hsl(var(--foreground)/0.25)] transition-all duration-300"
              >
                {/* gradient hero strip */}
                <div className="relative h-20 bg-gradient-to-br from-rose-500 via-fuchsia-500 to-amber-500">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/30 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white">
                    <Heart className="h-2.5 w-2.5" fill="currentColor" /> Backing
                  </span>
                  {/* avatar overlapping */}
                  <span className="absolute -bottom-5 left-4 h-12 w-12 rounded-full overflow-hidden bg-muted ring-4 ring-card flex items-center justify-center text-sm font-semibold text-muted-foreground">
                    {artist.avatar_url ? (
                      <img src={artist.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initial
                    )}
                  </span>
                </div>

                <div className="pt-7 px-4 pb-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    {artist.display_name || artist.username || "Artist"}
                  </p>
                  <h3 className="font-display text-[15px] font-semibold text-foreground line-clamp-2 leading-snug mt-1 min-h-[2.5rem]">
                    {p.title}
                  </h3>

                  {total > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] mb-1.5">
                        <span className="text-muted-foreground tabular-nums">
                          {done}/{total} milestones
                        </span>
                        <span className="text-foreground tabular-nums font-semibold">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-3 mt-3 border-t border-border/40">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground group-hover:gap-2 transition-all">
                      View release <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Holding section
// ─────────────────────────────────────────────────────────────────────
function HoldingSection({ holdings }: { holdings: any[] }) {
  // Spot price from constant-product reserves.
  const cards = holdings
    .map((h) => {
      const l = h.launch;
      if (!l) return null;
      const vsr = Number(l.virtual_sol_reserves || 0);
      const vtr = Number(l.virtual_token_reserves || 1);
      const supply = Number(l.total_supply || 1);
      const priceSol = vsr / vtr;
      const mcSol = priceSol * supply;
      const balance = Number(h.balance || 0);
      const valueSol = priceSol * balance;
      const investedSol = Number(h.sol_invested || 0);
      const pnlPct = investedSol > 0 ? ((valueSol - investedSol) / investedSol) * 100 : 0;
      return { ...h, launch: l, priceSol, mcSol, valueSol, pnlPct, balance };
    })
    .filter(Boolean) as any[];

  const totalValueSol = cards.reduce((s, c) => s + c.valueSol, 0);

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <Heart className="h-4 w-4 text-foreground/70" />
        <h2 className="font-display text-lg font-semibold text-foreground">Backing</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Coins you hold from artists you back. Holding unlocks their token-gated feed.
      </p>
      <div className="-mx-1 px-1 overflow-x-auto">
        <div className="flex gap-3 pb-2 min-w-min">
          {cards.map((c) => {
            const creator = c.launch.creator ?? {};
            const up = c.pnlPct >= 0;
            return (
              <div
                key={c.launch.id}
                className="shrink-0 w-[260px] rounded-2xl border border-border bg-foreground text-background dark:bg-card dark:text-foreground p-4"
              >
                <div className="flex items-center gap-2 mb-3 min-w-0">
                  <span className="h-7 w-7 rounded-full overflow-hidden bg-background/20 shrink-0">
                    {creator.avatar_url && (
                      <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{c.launch.name}</p>
                    <p className="text-[10px] opacity-70 uppercase tracking-wider">${c.launch.ticker}</p>
                  </div>
                </div>
                <p className="text-[10px] opacity-70">Market cap</p>
                <p className="text-sm font-semibold tabular-nums">{c.mcSol.toFixed(2)} SOL</p>
                <p className="mt-2 text-[10px] opacity-70">Your holdings</p>
                <p className="text-sm font-semibold tabular-nums">
                  {c.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
                      up ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(c.pnlPct).toFixed(1)}%
                  </span>
                  {c.launch.mint_address ? (
                    <a
                      href={`https://pump.fun/${c.launch.mint_address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] underline-offset-2 hover:underline opacity-90"
                    >
                      pump.fun ↗
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
        Portfolio value · {totalValueSol.toFixed(3)} SOL
      </p>
    </section>
  );
}

