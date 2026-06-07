/**
 * ActiveProjectsLane — "Building Now" horizontal scroller.
 *
 * Each card surfaces: artist avatar+name (top-left), project title (bold),
 * milestone progress bar (X of Y complete), supporter + like counts
 * (bottom-right), and a hover-reveal "Back this" pill.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Heart, Users, Rocket, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Owner = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Row = {
  id: string;
  title: string;
  public_slug: string;
  cheer_count: number | null;
  tokenize_ready: boolean | null;
  cover_color: string | null;
  cover_image_url: string | null;
  owner: Owner | null;
  milestonesTotal: number;
  milestonesDone: number;
};

const ActiveProjectsLane = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["discover-active-projects"],
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, public_slug, cheer_count, tokenize_ready, cover_color, cover_image_url, user_id",
        )
        .eq("is_public", true)
        .not("public_slug", "is", null)
        .order("cheer_count", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
      const projectIds = rows.map((r: any) => r.id);

      const profilesRes: { data: any[] | null } = userIds.length
        ? await (supabase as any)
            .from("profiles")
            .select("user_id, display_name, username, avatar_url")
            .in("user_id", userIds)
        : { data: [] };
      const milestonesRes: { data: any[] | null } = projectIds.length
        ? await (supabase as any)
            .from("project_milestones")
            .select("project_id, status")
            .in("project_id", projectIds)
        : { data: [] };



      const profileMap = new Map<string, Owner>();
      (profilesRes.data ?? []).forEach((p: any) =>
        profileMap.set(p.user_id, {
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
        }),
      );

      const msTotals = new Map<string, { total: number; done: number }>();
      (milestonesRes.data ?? []).forEach((m: any) => {
        const t = msTotals.get(m.project_id) ?? { total: 0, done: 0 };
        t.total += 1;
        if (m.status === "approved" || m.status === "completed") t.done += 1;
        msTotals.set(m.project_id, t);
      });

      return rows.map((r: any) => {
        const t = msTotals.get(r.id) ?? { total: 0, done: 0 };
        return {
          ...r,
          owner: profileMap.get(r.user_id) ?? null,
          milestonesTotal: t.total,
          milestonesDone: t.done,
        };
      });
    },
  });

  if (!isLoading && data.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-0.5">
            Live progress
          </p>
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
            Building Now
          </h2>
        </div>
        <Link
          to="/projects"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {data.map((p) => {
          const ownerName = p.owner?.display_name ?? p.owner?.username ?? "Creator";
          const total = p.milestonesTotal;
          const done = p.milestonesDone;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const supporters = p.cheer_count ?? 0;

          return (
            <Link
              key={p.id}
              to={`/release/${p.public_slug}`}
              className="group relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-foreground/30 flex flex-col"
            >

              {/* Cover */}
              <div
                className="relative aspect-[16/10] w-full bg-muted"
                style={
                  p.cover_image_url
                    ? undefined
                    : {
                        backgroundImage: `linear-gradient(135deg, ${p.cover_color ?? "hsl(292 84% 61%)"}, hsl(330 85% 60%))`,
                      }
                }
              >
                {p.cover_image_url && (
                  <img
                    src={p.cover_image_url}
                    alt={p.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Owner chip — top left */}
                <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-background/85 backdrop-blur-md border border-border/40 pl-0.5 pr-2 py-0.5 max-w-[75%]">
                  {p.owner?.avatar_url ? (
                    <img
                      src={p.owner.avatar_url}
                      alt={ownerName}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-muted grid place-items-center text-[9px] font-bold text-muted-foreground">
                      {ownerName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-foreground truncate">
                    {ownerName}
                  </span>
                </div>

                {p.tokenize_ready && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-foreground/90 text-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <Rocket className="h-2.5 w-2.5" /> Coin
                  </span>
                )}

                {/* Hover CTA */}
                <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 bg-gradient-to-t from-black/70 to-transparent">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white text-foreground px-2.5 py-1 text-[11px] font-semibold shadow-md">
                    <Sparkles className="h-3 w-3" /> Back this
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-3 space-y-2.5 flex-1 flex flex-col">
                <p className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                  {p.title}
                </p>

                {/* Milestone progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="uppercase tracking-wider font-semibold">
                      Milestones
                    </span>
                    <span className="tabular-nums">
                      {total > 0 ? `${done} of ${total}` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/70 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundImage:
                          "linear-gradient(90deg, hsl(330 85% 60%), hsl(292 84% 61%), hsl(38 92% 55%))",
                      }}
                    />
                  </div>
                </div>

                {/* Stats bottom-right */}
                <div className="mt-auto flex items-center justify-end gap-3 pt-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1" title="Supporters">
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{supporters}</span>
                  </span>
                  <span className="inline-flex items-center gap-1" title="Likes">
                    <Heart className="h-3 w-3" />
                    <span className="tabular-nums">{supporters}</span>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ActiveProjectsLane;
