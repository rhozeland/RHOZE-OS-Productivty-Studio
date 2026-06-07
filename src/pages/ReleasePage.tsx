/**
 * ReleasePage — public `/release/:slug` view of a project flipped to is_public.
 *
 * Tabs mirror the owner's ProjectDetailPage but read-only:
 *   Description · Roadmap · List · Timeline · Smartboard · Team
 *
 * Above the tabs: hero + Progress Overview + sticky Support rail (cheer /
 * comment / share-to-feed / buy coin). Hidden from public: budget amounts,
 * file URLs, contract metadata, DMs.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, ArrowLeft, Music4, Check, Copy, Users, Target, ListChecks, Clock,
  CalendarDays, Layout as LayoutIcon, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { pumpFunCreateUrl, pumpFunDetailsJson } from "@/lib/pump-fun";
import { useRef, useMemo } from "react";
import SupportPanel from "@/components/release/SupportPanel";
import ReleaseComments from "@/components/release/ReleaseComments";

const TAB_TRIGGER =
  "shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

const ReleasePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const { data: project, isLoading } = useQuery({
    queryKey: ["release", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, vision, scope_of_work, cover_color, cover_image_url, cheer_count, tokenize_ready, user_id, public_slug, linked_token_id, created_at",
        )
        .eq("public_slug", slug!)
        .eq("is_public", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: linkedToken } = useQuery({
    queryKey: ["release-linked-token", (project as any)?.linked_token_id],
    enabled: !!(project as any)?.linked_token_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("creator_tokens")
        .select("ticker, name, mint_address")
        .eq("id", (project as any).linked_token_id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
  });

  const { data: owner } = useQuery({
    queryKey: ["release-owner", project?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", project!.user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!project?.user_id,
  });

  const { data: contract } = useQuery({
    queryKey: ["release-contract", project?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_contracts")
        .select("id")
        .eq("project_id", project!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!project?.id,
  });

  const { data: milestones } = useQuery({
    queryKey: ["release-milestones", contract?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_milestones")
        .select("id, title, description, status, sort_order, due_date, approved_at")
        .eq("contract_id", contract!.id)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!contract?.id,
  });

  const { data: goals } = useQuery({
    queryKey: ["release-goals", project?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_goals")
        .select("id, title, description, status, sort_order, due_date, parent_id, stage_date_start, stage_date_end, progress, priority")
        .eq("project_id", project!.id)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!project?.id,
  });

  const { data: deliverables } = useQuery({
    queryKey: ["release-deliverables", project?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_deliverables")
        .select("id, title, completed, sort_order, anchored_at")
        .eq("project_id", project!.id)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!project?.id,
  });

  const { data: team } = useQuery({
    queryKey: ["release-team", project?.id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("project_collaborators")
        .select("user_id, project_role")
        .eq("project_id", project!.id);
      if (!rows?.length) return [] as any[];
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, bio")
        .in("user_id", ids);
      return rows.map((r) => ({
        ...r,
        profile: profs?.find((p) => p.user_id === r.user_id),
      }));
    },
    enabled: !!project?.id,
  });

  const { data: smartboards } = useQuery({
    queryKey: ["release-smartboards", project?.id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("project_smartboards")
        .select("smartboard_id")
        .eq("project_id", project!.id);
      const ids = links?.map((l) => l.smartboard_id) ?? [];
      if (!ids.length) return [] as any[];
      const { data: sbs } = await supabase
        .from("smartboards")
        .select("id, title, description")
        .in("id", ids);
      return sbs ?? [];
    },
    enabled: !!project?.id,
  });

  const { data: myCheer } = useQuery({
    queryKey: ["release-mycheer", project?.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_cheers")
        .select("id")
        .eq("project_id", project!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!project?.id && !!user?.id,
  });

  const stats = useMemo(() => {
    const ms = milestones ?? [];
    const dlv = deliverables ?? [];
    const done = ms.filter((m) => m.status === "approved" || m.status === "released").length;
    const inProgress = ms.filter((m) => m.status === "in_progress" || m.status === "submitted").length;
    const overall = ms.length ? Math.round((done / ms.length) * 100) : 0;
    const tasksDone = dlv.filter((d) => d.completed).length;
    return { done, inProgress, overall, tasksDone, tasksTotal: dlv.length, goalsTotal: ms.length };
  }, [milestones, deliverables]);

  const commentsRef = useRef<HTMLDivElement>(null);
  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) {
    return <div className="container mx-auto py-20 text-center text-muted-foreground">Loading release…</div>;
  }
  if (!project) {
    return (
      <div className="container mx-auto py-20 text-center">
        <p className="text-muted-foreground">This release isn't public.</p>
        <Link to="/discover" className="text-sm underline mt-2 inline-block">Back to Discover</Link>
      </div>
    );
  }

  const cover = project.cover_color ?? "hsl(var(--primary))";

  // Timeline buckets — sort all milestones + goals with dates chronologically
  const timelineItems = [
    ...(milestones ?? [])
      .filter((m: any) => m.due_date || m.approved_at)
      .map((m: any) => ({
        id: m.id,
        title: m.title,
        date: m.approved_at ?? m.due_date,
        type: "milestone",
        status: m.status,
      })),
    ...(goals ?? [])
      .filter((g: any) => g.due_date || g.stage_date_start)
      .map((g: any) => ({
        id: g.id,
        title: g.title,
        date: g.stage_date_start ?? g.due_date,
        type: "goal",
        status: g.status,
      })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cover}, hsl(var(--background)))` }}
      >
        <div className="container mx-auto px-4 py-12 md:py-16">
          <Link to="/discover" className="inline-flex items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground mb-6">
            <ArrowLeft className="h-3 w-3" /> Discover
          </Link>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Badge variant="outline" className="bg-background/60 backdrop-blur text-[10px] uppercase tracking-wider mb-3">
              <Music4 className="h-3 w-3 mr-1" /> Building in public
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">{project.title}</h1>
            {project.description && (
              <p className="mt-3 text-base md:text-lg text-foreground/80 max-w-2xl">{project.description}</p>
            )}
            {owner && (
              <Link
                to={`/profile/${owner.username ?? project.user_id}`}
                className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-background/70 backdrop-blur border border-border px-3 py-1.5 hover:bg-background"
              >
                {owner.avatar_url && (
                  <img src={owner.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                )}
                <span className="text-sm font-medium">{owner.display_name ?? owner.username}</span>
                {linkedToken?.ticker && (
                  <Badge variant="outline" className="text-[10px]">${linkedToken.ticker}</Badge>
                )}
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-[1fr,340px] gap-8">
        <div className="space-y-8 min-w-0">
          {/* Progress overview */}
          <section className="rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Progress Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<ListChecks className="h-3.5 w-3.5" />} label="Overall progress" value={`${stats.overall}%`} bar={stats.overall} />
              <StatCard icon={<Check className="h-3.5 w-3.5" />} label="Tasks done" value={`${stats.tasksDone}/${stats.tasksTotal}`} bar={stats.tasksTotal ? (stats.tasksDone / stats.tasksTotal) * 100 : 0} />
              <StatCard icon={<Target className="h-3.5 w-3.5" />} label="Goals completed" value={`${stats.done}/${stats.goalsTotal}`} bar={stats.goalsTotal ? (stats.done / stats.goalsTotal) * 100 : 0} />
              <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="In progress" value={`${stats.inProgress}`} />
            </div>
          </section>

          <Tabs defaultValue="description" className="w-full">
            <TabsList className="mb-6 w-full justify-start overflow-x-auto flex-nowrap shrink-0 h-auto gap-6 rounded-none border-b border-border bg-transparent p-0 text-muted-foreground">
              <TabsTrigger value="description" className={TAB_TRIGGER}>Description</TabsTrigger>
              <TabsTrigger value="roadmap" className={TAB_TRIGGER}>Roadmap</TabsTrigger>
              <TabsTrigger value="list" className={TAB_TRIGGER}>List</TabsTrigger>
              <TabsTrigger value="timeline" className={TAB_TRIGGER}>Timeline</TabsTrigger>
              <TabsTrigger value="smartboard" className={TAB_TRIGGER}>Smartboard</TabsTrigger>
              <TabsTrigger value="team" className={TAB_TRIGGER}>Team</TabsTrigger>
            </TabsList>

            {/* DESCRIPTION */}
            <TabsContent value="description" className="space-y-6">
              {project.vision && (
                <section>
                  <h2 className="text-lg font-semibold mb-2">Vision</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{project.vision}</p>
                </section>
              )}
              {project.scope_of_work && (
                <section>
                  <h2 className="text-lg font-semibold mb-2">Scope of work</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{project.scope_of_work}</p>
                </section>
              )}
              {!project.vision && !project.scope_of_work && (
                <EmptyState text="No description shared yet." />
              )}
            </TabsContent>

            {/* ROADMAP — milestones stage cards */}
            <TabsContent value="roadmap" className="space-y-3">
              {milestones && milestones.length > 0 ? (
                <ol className="space-y-3">
                  {milestones.map((m: any, i: number) => {
                    const done = m.status === "approved" || m.status === "released";
                    const active = m.status === "in_progress" || m.status === "submitted";
                    return (
                      <li key={m.id} className="rounded-xl border border-border bg-card/40 p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={[
                              "h-7 w-7 rounded-full grid place-items-center text-[11px] font-semibold shrink-0",
                              done
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : active
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-muted text-muted-foreground",
                            ].join(" ")}
                          >
                            {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{m.title}</span>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {m.status?.replace(/_/g, " ") ?? "pending"}
                              </Badge>
                              {m.due_date && (
                                <span className="text-[10px] text-muted-foreground">
                                  Due {new Date(m.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {m.description && (
                              <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {m.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EmptyState text="Roadmap not published yet." />
              )}
            </TabsContent>

            {/* LIST — flat checklist of goals + deliverables */}
            <TabsContent value="list" className="space-y-6">
              {goals && goals.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Goals</h3>
                  <ul className="space-y-1.5">
                    {goals.map((g: any) => {
                      const done = g.status === "completed" || g.status === "approved";
                      return (
                        <li key={g.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-3 py-2">
                          <div className={["h-4 w-4 rounded grid place-items-center shrink-0 border", done ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-border bg-background"].join(" ")}>
                            {done && <Check className="h-3 w-3" />}
                          </div>
                          <span className={`text-sm flex-1 ${done ? "line-through text-muted-foreground" : ""}`}>{g.title}</span>
                          {g.due_date && <span className="text-[10px] text-muted-foreground">{new Date(g.due_date).toLocaleDateString()}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {deliverables && deliverables.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Deliverables</h3>
                  <ul className="space-y-1.5">
                    {deliverables.map((d: any) => (
                      <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-3 py-2">
                        <div className={["h-4 w-4 rounded grid place-items-center shrink-0 border", d.completed ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-border bg-background"].join(" ")}>
                          {d.completed && <Check className="h-3 w-3" />}
                        </div>
                        <span className={`text-sm flex-1 ${d.completed ? "line-through text-muted-foreground" : ""}`}>{d.title}</span>
                        {d.anchored_at && <Badge variant="outline" className="text-[9px]">Verified IP</Badge>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {(!goals?.length && !deliverables?.length) && <EmptyState text="No tasks added yet." />}
            </TabsContent>

            {/* TIMELINE — chronological strip */}
            <TabsContent value="timeline" className="space-y-3">
              {timelineItems.length === 0 ? (
                <EmptyState text="No scheduled milestones yet." />
              ) : (
                <ol className="relative border-l border-border pl-6 space-y-4 ml-2">
                  {timelineItems.map((it) => {
                    const done = it.status === "approved" || it.status === "released" || it.status === "completed";
                    return (
                      <li key={`${it.type}-${it.id}`} className="relative">
                        <span
                          className={[
                            "absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-background",
                            done ? "bg-emerald-500" : "bg-muted-foreground/50",
                          ].join(" ")}
                        />
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(it.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          <Badge variant="outline" className="text-[9px] capitalize">{it.type}</Badge>
                        </div>
                        <div className="mt-0.5 text-sm font-medium">{it.title}</div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </TabsContent>

            {/* SMARTBOARD — public preview list */}
            <TabsContent value="smartboard" className="space-y-3">
              {smartboards && smartboards.length > 0 ? (
                <ul className="space-y-2">
                  {smartboards.map((sb: any) => (
                    <li key={sb.id} className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4">
                      <div className="h-9 w-9 rounded-lg bg-muted grid place-items-center shrink-0">
                        <LayoutIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{sb.title}</div>
                        {sb.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{sb.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <ExternalLink className="h-2.5 w-2.5" /> Private
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState text="No smartboards attached to this release." />
              )}
            </TabsContent>

            {/* TEAM */}
            <TabsContent value="team" className="space-y-3">
              {/* Owner */}
              {owner && (
                <Link
                  to={`/profile/${owner.username ?? project.user_id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4 hover:bg-card"
                >
                  {owner.avatar_url ? (
                    <img src={owner.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{owner.display_name ?? owner.username}</div>
                    <div className="text-[11px] text-muted-foreground">Release owner</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Owner</Badge>
                </Link>
              )}
              {team && team.length > 0 ? (
                team.map((t: any) => (
                  <Link
                    key={t.user_id}
                    to={`/profile/${t.profile?.username ?? t.user_id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4 hover:bg-card"
                  >
                    {t.profile?.avatar_url ? (
                      <img src={t.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{t.profile?.display_name ?? t.profile?.username ?? "Collaborator"}</div>
                      {t.profile?.bio && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{t.profile.bio}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{t.project_role}</Badge>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No additional collaborators yet.</p>
              )}
            </TabsContent>
          </Tabs>

          <ReleaseComments ref={commentsRef} projectId={project.id} />
        </div>

        {/* Rail */}
        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <SupportPanel
            projectId={project.id}
            projectTitle={project.title}
            cheerCount={project.cheer_count ?? 0}
            iSupport={!!myCheer}
            releaseUrl={typeof window !== "undefined" ? window.location.href : `/release/${slug}`}
            ownerName={owner?.display_name ?? owner?.username ?? null}
            coverColor={project.cover_color}
            coverImageUrl={(project as any).cover_image_url ?? null}
            linkedTokenTicker={linkedToken?.ticker ?? null}
            linkedTokenMint={linkedToken?.mint_address ?? null}
            onScrollToComments={scrollToComments}
          />

          {project.tokenize_ready && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <Sparkles className="h-4 w-4" />
                Tokenize this release
              </div>
              <p className="text-xs text-muted-foreground">
                A&R flagged this for tokenization. Launch on pump.fun with the
                release title, vision, and cover pre-filled.
              </p>
              <Button asChild className="w-full gap-1.5" size="sm">
                <a
                  href={pumpFunCreateUrl({
                    name: project.title,
                    description: project.vision ?? project.description ?? undefined,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Launch on pump.fun
                </a>
              </Button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    pumpFunDetailsJson({
                      name: project.title,
                      description: project.vision ?? project.description ?? undefined,
                    }),
                  );
                  toast.success("Coin details copied to clipboard");
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-2.5 w-2.5" /> Copy details (fallback)
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const StatCard = ({
  icon, label, value, bar,
}: { icon: React.ReactNode; label: string; value: string; bar?: number }) => (
  <div className="rounded-xl border border-border bg-background/40 p-3">
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      {icon} {label}
    </div>
    <div className="mt-1.5 text-2xl font-display font-bold tabular-nums">{value}</div>
    {typeof bar === "number" && <Progress value={bar} className="h-1 mt-2" />}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center text-xs text-muted-foreground">
    {text}
  </div>
);

export default ReleasePage;
