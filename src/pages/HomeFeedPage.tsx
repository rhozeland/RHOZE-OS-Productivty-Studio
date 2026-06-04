/**
 * HomeFeedPage — `/home`
 *
 * Redesigned: hero pitch + clean feed of public project cards.
 * No stat pills, no dashboard. Explains the product in 3 seconds.
 */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Rocket, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type PhaseKey = "pre_production" | "production" | "post_production" | "release";

const PHASE_LABEL: Record<PhaseKey, string> = {
  pre_production: "Pre-production",
  production: "Recording",
  post_production: "Mixing",
  release: "Release",
};

const PHASE_ORDER: PhaseKey[] = ["pre_production", "production", "post_production", "release"];

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
  };
  phaseLabel: string;
};

const HomeFeedPage = () => {
  const navigate = useNavigate();

  const { data: projects = [], isLoading } = useQuery<ProjectCard[]>({
    queryKey: ["home-public-projects"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("projects")
        .select("id, title, public_slug, cheer_count, user_id, updated_at")
        .eq("is_public", true)
        .order("updated_at", { ascending: false })
        .limit(24);

      const list = rows ?? [];
      if (!list.length) return [];

      const ownerIds = [...new Set(list.map((p: any) => p.user_id))];
      const { data: owners } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ownerIds);
      const ownerMap = new Map<string, any>();
      (owners ?? []).forEach((o: any) => ownerMap.set(o.user_id, o));

      // Pull milestones per project to derive current phase
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
          return {
            id: p.id,
            title: p.title,
            public_slug: p.public_slug,
            cheer_count: p.cheer_count ?? 0,
            owner: {
              user_id: p.user_id,
              display_name: o.display_name || o.username || "Musician",
              avatar_url: o.avatar_url ?? null,
            },
            phaseLabel: phaseByProject.get(p.id) ?? "In progress",
          } as ProjectCard;
        })
        .filter(Boolean) as ProjectCard[];
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 space-y-10 pb-20">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-500/10 via-card to-card px-6 sm:px-10 py-10 sm:py-14">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight text-foreground">
            Where musicians build in public and fans back the work.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
            Follow a project. Support the roadmap. Back the coin when it launches.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <Button
              size="lg"
              onClick={() => navigate("/studio?new=1")}
              className="h-12 px-6 rounded-full bg-emerald-500 hover:bg-emerald-500/90 text-white font-semibold gap-2 shadow-sm"
            >
              Start a Project <ArrowRight className="h-4 w-4" />
            </Button>
            <Link
              to="/why-coin"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              <Rocket className="h-4 w-4" />
              Already have work? Launch a coin
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Feed of public project cards ──────────────────────────────── */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5 h-40 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <Music className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-foreground">No public projects yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Be the first to build in public.
            </p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {projects.map((p) => (
              <ProjectFeedCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
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
          <Link
            to={`/profile/${project.owner.user_id}`}
            className="text-xs text-muted-foreground hover:text-foreground truncate block"
          >
            {project.owner.display_name}
          </Link>
          <Link
            to={href}
            className="text-sm font-semibold text-foreground truncate block hover:underline"
          >
            {project.title}
          </Link>
        </div>
        <span className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {project.phaseLabel}
        </span>
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

      <Button asChild variant="outline" size="sm" className="w-full rounded-full gap-1.5">
        <Link to={href}>
          Follow Release <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </Card>
  );
};

export default HomeFeedPage;
