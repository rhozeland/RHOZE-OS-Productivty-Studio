/**
 * ReleasePage — public `/release/:slug` view of a project that's been flipped
 * to `is_public = true`. Part of v11 Tier 3 "build in public" surface.
 *
 * What it shows: title, cover color, vision/scope, public milestone list
 * (title + status, no budget), cheer count, cheer button (free, 1 per user),
 * and — when an admin/A&R has flipped `tokenize_ready` — a graduation CTA
 * deeplinking to pump.fun to launch a coin for the release.
 *
 * What it hides: budget, deliverables, files, contracts, collaborators' DMs.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Sparkles, ArrowLeft, Music4, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ReleasePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["release", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, vision, scope_of_work, cover_color, cheer_count, tokenize_ready, user_id, public_slug",
        )
        .eq("public_slug", slug!)
        .eq("is_public", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: owner } = useQuery({
    queryKey: ["release-owner", project?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url, token_mint_address, token_ticker")
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
        .select("id, title, status, sort_order")
        .eq("contract_id", contract!.id)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!contract?.id,
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

  const cheer = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to cheer");
      if (myCheer) {
        const { error } = await supabase
          .from("project_cheers")
          .delete()
          .eq("project_id", project!.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_cheers")
          .insert({ project_id: project!.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release", slug] });
      qc.invalidateQueries({ queryKey: ["release-mycheer", project?.id, user?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not cheer"),
  });

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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cover}, hsl(var(--background)))`,
        }}
      >
        <div className="container mx-auto px-4 py-12 md:py-16">
          <Link to="/discover" className="inline-flex items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground mb-6">
            <ArrowLeft className="h-3 w-3" /> Discover
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Badge variant="outline" className="bg-background/60 backdrop-blur text-[10px] uppercase tracking-wider mb-3">
              <Music4 className="h-3 w-3 mr-1" /> Building in public
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
              {project.title}
            </h1>
            {project.description && (
              <p className="mt-3 text-base md:text-lg text-foreground/80 max-w-2xl">
                {project.description}
              </p>
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
                {owner.token_ticker && (
                  <Badge variant="outline" className="text-[10px]">${owner.token_ticker}</Badge>
                )}
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-[1fr,320px] gap-8">
        <div className="space-y-8">
          {project.vision && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Vision</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.vision}</p>
            </section>
          )}
          {project.scope_of_work && (
            <section>
              <h2 className="text-lg font-semibold mb-2">Scope</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.scope_of_work}</p>
            </section>
          )}
          {milestones && milestones.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Roadmap</h2>
              <ol className="space-y-2">
                {milestones.map((m: any, i: number) => {
                  const done = m.status === "approved" || m.status === "released";
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-3 py-2.5"
                    >
                      <div
                        className={[
                          "h-6 w-6 rounded-full grid place-items-center text-[10px] font-semibold shrink-0",
                          done
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </div>
                      <span className="text-sm flex-1">{m.title}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {m.status?.replace(/_/g, " ") ?? "pending"}
                      </Badge>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        {/* Rail */}
        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <div className="rounded-xl border border-border bg-card/60 p-4 text-center">
            <Heart className="h-6 w-6 mx-auto text-rose-500 fill-rose-500/20" />
            <div className="text-3xl font-display font-bold mt-1">{project.cheer_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">cheers</div>
            <Button
              className="w-full mt-3 gap-1.5"
              variant={myCheer ? "outline" : "default"}
              onClick={() => cheer.mutate()}
              disabled={cheer.isPending}
            >
              <Heart className={"h-3.5 w-3.5 " + (myCheer ? "fill-current" : "")} />
              {myCheer ? "Cheered" : user ? "Cheer this release" : "Sign in to cheer"}
            </Button>
          </div>

          {project.tokenize_ready && (
            <a
              href="https://pump.fun/create"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 hover:bg-emerald-500/10 transition-colors"
            >
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <Sparkles className="h-4 w-4" />
                Tokenize this release
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                A&R has flagged this release for tokenization. Launch a coin on pump.fun with Rhozeland support.
              </p>
            </a>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ReleasePage;
