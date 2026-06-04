/**
 * HomeFeedPage — `/home`
 *
 * Feed-first. Compact top bar (Start Project / Launch Coin + Flow pill),
 * Following / Discover tabs, vertical stack of project cards. Flow mode
 * collapses the sidebar and renders the feed full-screen, chrome-less.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Rocket, Sparkles, Heart, Radio, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type PhaseKey = "pre_production" | "production" | "post_production" | "release";

const PHASE_LABEL: Record<PhaseKey, string> = {
  pre_production: "Pre-production",
  production: "Recording",
  post_production: "Mixing",
  release: "Release",
};

const SUPPORTER_GOAL = 10;

type ProjectCard = {
  id: string;
  title: string;
  public_slug: string | null;
  cheer_count: number;
  owner: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    genre: string | null;
  };
  phaseLabel: string;
};

const HomeFeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setOpen, setOpenMobile } = useSidebar();
  const [tab, setTab] = useState<"following" | "discover">(user ? "following" : "discover");
  const [flowMode, setFlowMode] = useState(false);

  // Toggling flow mode collapses the sidebar; exit restores it.
  useEffect(() => {
    if (flowMode) {
      setOpen(false);
      setOpenMobile(false);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setFlowMode(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [flowMode, setOpen, setOpenMobile]);

  const { data: followedOwnerIds = [] } = useQuery<string[]>({
    queryKey: ["home-following-owners", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("creator_subscriptions")
        .select("creator_id")
        .eq("subscriber_id", user!.id)
        .eq("status", "active");
      return [...new Set(((data ?? []) as any[]).map((r) => r.creator_id))];
    },
  });

  const { data: projects = [], isLoading } = useQuery<ProjectCard[]>({
    queryKey: ["home-feed-projects", tab, followedOwnerIds.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("projects")
        .select("id, title, public_slug, cheer_count, user_id, updated_at")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (tab === "following" && followedOwnerIds.length) {
        q = q.in("user_id", followedOwnerIds);
      } else if (tab === "following" && !followedOwnerIds.length) {
        return [];
      }
      const { data: rows } = await q;
      const list = rows ?? [];
      if (!list.length) return [];

      const ownerIds = [...new Set(list.map((p: any) => p.user_id))];
      const { data: owners } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, creator_roles")
        .in("user_id", ownerIds);
      const ownerMap = new Map<string, any>();
      (owners ?? []).forEach((o: any) => ownerMap.set(o.user_id, o));

      const projectIds = list.map((p: any) => p.id);
      const { data: contracts } = await supabase
        .from("project_contracts")
        .select("id, project_id")
        .in("project_id", projectIds);
      const contractToProject = new Map<string, string>();
      const contractIds: string[] = [];
      (contracts ?? []).forEach((c: any) => {
        contractToProject.set(c.id, c.project_id);
        contractIds.push(c.id);
      });

      const phaseByProject = new Map<string, string>();
      if (contractIds.length) {
        const { data: ms } = await supabase
          .from("project_milestones")
          .select("contract_id, phase, approved_at, order_index")
          .in("contract_id", contractIds)
          .order("order_index", { ascending: true });
        const grouped = new Map<string, any[]>();
        (ms ?? []).forEach((m: any) => {
          const pid = contractToProject.get(m.contract_id);
          if (!pid) return;
          if (!grouped.has(pid)) grouped.set(pid, []);
          grouped.get(pid)!.push(m);
        });
        grouped.forEach((mils, pid) => {
          const nextOpen = mils.find((m) => !m.approved_at && m.phase);
          const lastDone = [...mils].reverse().find((m) => m.approved_at && m.phase);
          const phase = (nextOpen?.phase || lastDone?.phase) as PhaseKey | undefined;
          if (phase && PHASE_LABEL[phase]) phaseByProject.set(pid, PHASE_LABEL[phase]);
        });
      }

      return list
        .map((p: any) => {
          const o = ownerMap.get(p.user_id);
          if (!o) return null;
          const genre = Array.isArray(o.creator_roles) && o.creator_roles.length
            ? String(o.creator_roles[0])
            : null;
          return {
            id: p.id,
            title: p.title,
            public_slug: p.public_slug,
            cheer_count: p.cheer_count ?? 0,
            owner: {
              user_id: p.user_id,
              display_name: o.display_name || o.username || "Musician",
              avatar_url: o.avatar_url ?? null,
              genre,
            },
            phaseLabel: phaseByProject.get(p.id) ?? "In progress",
          } as ProjectCard;
        })
        .filter(Boolean) as ProjectCard[];
    },
  });

  const content = (
    <div className={cn("mx-auto w-full", flowMode ? "max-w-2xl px-4 py-6" : "max-w-2xl px-4 sm:px-6 py-4 pb-20")}>
      {/* ─── Top bar ─────────────────────────────────────────────────── */}
      {!flowMode && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              size="sm"
              onClick={() => navigate("/studio?new=1")}
              className="h-9 rounded-full bg-emerald-500 hover:bg-emerald-500/90 text-white font-semibold gap-1.5 px-4"
            >
              <Sparkles className="h-3.5 w-3.5" /> Start a Project
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/why-coin")}
              className="h-9 rounded-full gap-1.5 px-4"
            >
              <Rocket className="h-3.5 w-3.5" /> Launch a Coin
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFlowMode(true)}
            className="h-9 rounded-full gap-1.5 px-4 border-foreground/30 bg-gradient-to-r from-fuchsia-500/10 via-violet-500/10 to-cyan-500/10 hover:from-fuchsia-500/20 hover:via-violet-500/20 hover:to-cyan-500/20 font-semibold"
          >
            <Radio className="h-3.5 w-3.5" /> Flow
          </Button>
        </div>
      )}

      {/* ─── Tabs ────────────────────────────────────────────────────── */}
      {!flowMode && (
        <div className="flex items-center gap-1 border-b border-border mb-4">
          {(["following", "discover"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold capitalize -mb-px border-b-2 transition-colors",
                tab === t
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {flowMode && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-fuchsia-500" />
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Flow Mode</span>
          </div>
          <button
            onClick={() => setFlowMode(false)}
            className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
            aria-label="Exit Flow Mode"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ─── Feed ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5 h-36 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {tab === "following" ? "You're not following anyone yet." : "No public projects yet."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {tab === "following" ? "Switch to Discover to find artists." : "Be the first to build in public."}
          </p>
          {tab === "following" && (
            <Button size="sm" variant="outline" className="mt-4 rounded-full" onClick={() => setTab("discover")}>
              Browse Discover
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <ProjectFeedCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );

  if (flowMode) {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">{content}</div>,
      document.body,
    );
  }
  return content;
};

const ProjectFeedCard = ({ project }: { project: ProjectCard }) => {
  const pct = useMemo(
    () => Math.min(100, Math.round((project.cheer_count / SUPPORTER_GOAL) * 100)),
    [project.cheer_count],
  );
  const href = project.public_slug ? `/release/${project.public_slug}` : `/projects/${project.id}`;
  const initials = project.owner.display_name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="p-5 flex flex-col gap-4 hover:bg-card/80 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Link to={`/profile/${project.owner.user_id}`} className="shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={project.owner.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              to={`/profile/${project.owner.user_id}`}
              className="text-sm font-semibold text-foreground truncate hover:underline"
            >
              {project.owner.display_name}
            </Link>
            {project.owner.genre && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground truncate capitalize">{project.owner.genre}</span>
              </>
            )}
          </div>
          <Link to={href} className="text-base font-bold text-foreground truncate block hover:underline">
            {project.title}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5 italic">{project.phaseLabel}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Supporters</span>
          <span className="font-medium tabular-nums text-foreground">
            {Math.min(project.cheer_count, SUPPORTER_GOAL)} / {SUPPORTER_GOAL}
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1 rounded-full gap-1.5">
          <Link to={href}>
            Follow Release <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full gap-1.5 px-3">
          <Heart className="h-3.5 w-3.5" /> Support
        </Button>
      </div>
    </Card>
  );
};

export default HomeFeedPage;
