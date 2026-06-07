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
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowLeft, Music4, Check, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { pumpFunCreateUrl, pumpFunDetailsJson } from "@/lib/pump-fun";
import { useRef } from "react";
import SupportPanel from "@/components/release/SupportPanel";
import ReleaseComments from "@/components/release/ReleaseComments";


const ReleasePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  

  const { data: project, isLoading } = useQuery({
    queryKey: ["release", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, vision, scope_of_work, cover_color, cheer_count, tokenize_ready, user_id, public_slug, linked_token_id",
        )
        .eq("public_slug", slug!)
        .eq("is_public", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Linked coin — ONLY shows when owner explicitly attached an approved token
  // to this project (no more auto-pull of the profile's primary token).
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
                {linkedToken?.ticker && (
                  <Badge variant="outline" className="text-[10px]">${linkedToken.ticker}</Badge>
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
          </section>
          )}

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
                release title, vision, and cover pre-filled — one motion.
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

export default ReleasePage;
