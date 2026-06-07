/**
 * ActiveProjectsLane — horizontal scroller of public projects (releases)
 * currently being built in public. Surfaces `projects.is_public = true`
 * rows on the Discover page so fans can cheer + follow along.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Heart, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  title: string;
  public_slug: string;
  vision: string | null;
  cheer_count: number | null;
  tokenize_ready: boolean | null;
  cover_color: string | null;
  cover_image_url: string | null;
  status: string | null;
  owner: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

const ActiveProjectsLane = () => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["discover-active-projects"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, public_slug, vision, cheer_count, tokenize_ready, cover_color, cover_image_url, status, user_id"
        )
        .eq("is_public", true)
        .not("public_slug", "is", null)
        .order("cheer_count", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
      const profileMap = new Map<string, Row["owner"]>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", userIds);
        (profs ?? []).forEach((p: any) =>
          profileMap.set(p.user_id, {
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
          })
        );
      }
      return (data ?? []).map((r: any) => ({
        ...r,
        owner: profileMap.get(r.user_id) ?? null,
      }));
    },
    staleTime: 60_000,
  });

  if (!isLoading && data.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold mb-0.5">
            Building in public
          </p>
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
            Active projects
          </h2>
        </div>
        <Link
          to="/projects"
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        >
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
        {data.map((p) => {
          const ownerName = p.owner?.display_name ?? p.owner?.username ?? "Creator";
          const handle = p.owner?.username ? `@${p.owner.username}` : null;
          return (
            <Link
              key={p.id}
              to={`/release/${p.public_slug}`}
              className="group relative shrink-0 w-[220px] sm:w-[240px] snap-start rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-foreground/30"
            >
              <div
                className="relative aspect-square w-full bg-muted"
                style={
                  p.cover_image_url
                    ? undefined
                    : { backgroundImage: `linear-gradient(135deg, ${p.cover_color ?? "hsl(292 84% 61%)"}, hsl(330 85% 60%))` }
                }
              >
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt={p.title} className="absolute inset-0 w-full h-full object-cover" />
                )}
                {p.tokenize_ready && (
                  <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-foreground/90 text-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <Rocket className="h-2.5 w-2.5" /> Tokenize
                  </span>
                )}
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
                  {p.title}
                </p>
                {p.vision && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                    {p.vision}
                  </p>
                )}
                <div className="flex items-center gap-1.5 pt-1">
                  {p.owner?.avatar_url ? (
                    <img
                      src={p.owner.avatar_url}
                      alt={ownerName}
                      className="h-5 w-5 rounded-full object-cover border border-border/60"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-muted border border-border/60 grid place-items-center text-[9px] font-bold text-muted-foreground">
                      {ownerName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[11px] text-muted-foreground truncate">
                    {handle ?? ownerName}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <Heart className="h-3 w-3" />
                    <span className="tabular-nums">{p.cheer_count ?? 0}</span>
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
