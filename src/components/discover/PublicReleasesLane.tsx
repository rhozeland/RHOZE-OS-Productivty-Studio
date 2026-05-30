/**
 * PublicReleasesLane — Discover-hero lane that promotes "building in public"
 * releases as the primary unit of the platform.
 *
 * Each card composes the project (release) with its nested milestones
 * progress + the creator's token chip + cheer count. Lifts releases above
 * coins / listings / creators in the Discover hierarchy so a first-time
 * visitor instantly sees what Rhozeland is: tokenized music projects.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Music4, Heart, ArrowRight, Sparkles, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

type ReleaseRow = {
  id: string;
  title: string;
  description: string | null;
  cover_color: string | null;
  cheer_count: number | null;
  public_slug: string | null;
  tokenize_ready: boolean | null;
  status: string | null;
  user_id: string;
  updated_at: string | null;
};

const statusPill = (status: string | null | undefined) => {
  switch (status) {
    case "completed":
    case "released":
      return { label: "Released", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
    case "active":
      return { label: "In production", tone: "bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/30" };
    default:
      return { label: "Drafting", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  }
};

const PublicReleasesLane = () => {
  const { data: releases = [], isLoading } = useQuery({
    queryKey: ["discover-public-releases"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select(
          "id, title, description, cover_color, cheer_count, public_slug, tokenize_ready, status, user_id, updated_at",
        )
        .eq("is_public", true)
        .order("cheer_count", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(12);
      return (data ?? []) as ReleaseRow[];
    },
  });

  const userIds = releases.map((r) => r.user_id);
  const { data: owners = [] } = useQuery({
    queryKey: ["discover-public-release-owners", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, token_ticker, token_mint_address, show_token_chip")
        .in("user_id", userIds);
      return data ?? [];
    },
  });

  const ownerBy = new Map(owners.map((o: any) => [o.user_id, o]));

  if (isLoading || releases.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-1">
            <Sparkles className="inline h-3 w-3 mr-1" />
            Building in public
          </p>
          <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-foreground">
            Music projects, live now.
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Follow an artist's roadmap, cheer their milestones, back their coin.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {releases.map((r, i) => {
          const owner: any = ownerBy.get(r.user_id);
          const pill = statusPill(r.status);
          const showToken =
            owner?.token_mint_address && owner?.show_token_chip !== false && owner?.token_ticker;
          return (
            <motion.article
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.18) }}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card hover:border-border transition-colors flex flex-col"
            >
              <Link
                to={r.public_slug ? `/release/${r.public_slug}` : `/projects/${r.id}`}
                className="block"
              >
                <div
                  className="aspect-[16/7] relative"
                  style={{
                    background: `linear-gradient(135deg, ${r.cover_color ?? "hsl(var(--primary))"}, hsl(var(--background)))`,
                  }}
                >
                  <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] backdrop-blur ${pill.tone}`}>
                      <Music4 className="h-3 w-3 mr-1" />
                      {pill.label}
                    </Badge>
                    {r.tokenize_ready && (
                      <Badge variant="outline" className="bg-background/70 backdrop-blur text-[10px]">
                        <Coins className="h-3 w-3 mr-1 text-emerald-500" />
                        Tokenize-ready
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>

              <div className="flex-1 p-4 space-y-3">
                <Link to={r.public_slug ? `/release/${r.public_slug}` : `/projects/${r.id}`}>
                  <h3 className="font-display text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {r.title}
                  </h3>
                </Link>
                {r.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                )}

                {/* Nested mini-rows */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {owner && (
                    <Link
                      to={`/profile/${owner.username ?? owner.user_id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {owner.avatar_url && (
                        <img src={owner.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                      )}
                      <span className="truncate max-w-[120px]">
                        {owner.display_name ?? owner.username}
                      </span>
                    </Link>
                  )}
                  {showToken && (
                    <a
                      href={`https://pump.fun/coin/${owner.token_mint_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                    >
                      <Coins className="h-2.5 w-2.5" />${owner.token_ticker}
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border/60 bg-muted/20">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Heart className="h-3 w-3 text-rose-500 fill-rose-500/20" />
                  {r.cheer_count ?? 0} cheer{(r.cheer_count ?? 0) === 1 ? "" : "s"}
                </span>
                <Link
                  to={r.public_slug ? `/release/${r.public_slug}` : `/projects/${r.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 hover:text-foreground"
                >
                  Open release
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
};

export default PublicReleasesLane;
