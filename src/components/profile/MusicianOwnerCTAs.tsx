/**
 * MusicianOwnerCTAs — owner-only primary action area on the musician profile.
 *
 * Three states, in priority order:
 *  1. Has approved live coin (profiles.token_mint_address)  → render nothing
 *     (the existing <CreatorCoinsGallery /> below already takes the spotlight).
 *  2. Has at least one is_public=true project → status card + two CTAs.
 *  3. Otherwise → two CTAs only ("Start a Project" primary, "Start a Coin" secondary).
 *
 * Only mounted when the profile owner is viewing their own profile.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Star, Coins, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  userId: string;
  hasLiveCoin: boolean;
}

export default function MusicianOwnerCTAs({ userId, hasLiveCoin }: Props) {
  const navigate = useNavigate();

  const { data: publicProject } = useQuery({
    queryKey: ["owner-active-public-project", userId],
    enabled: !!userId && !hasLiveCoin,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, public_slug, cheer_count")
        .eq("user_id", userId)
        .eq("is_public", true as any)
        .order("created_at", { ascending: false })
        .limit(1);
      const row: any = (data ?? [])[0];
      if (!row) return null;

      const [{ count: total }, { count: done }] = await Promise.all([
        supabase
          .from("project_goals")
          .select("id", { count: "exact", head: true })
          .eq("project_id", row.id),
        supabase
          .from("project_goals")
          .select("id", { count: "exact", head: true })
          .eq("project_id", row.id)
          .eq("status", "completed" as any),
      ]);
      return {
        ...row,
        milestones_total: total ?? 0,
        milestones_done: done ?? 0,
      };
    },
  });

  // State 1 — has coin → defer to existing coin card.
  if (hasLiveCoin) return null;

  const openRoadmap = () => navigate("/studio?from=profile");
  const openCoinFlow = () => navigate("/settings#token");

  return (
    <div className="mt-5 space-y-3">
      {/* Status card for an active public project */}
      {publicProject && (
        <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-foreground truncate">
              {publicProject.title}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5 flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              {publicProject.cheer_count ?? 0} supporters
              <span className="opacity-50">·</span>
              {publicProject.milestones_done} of {publicProject.milestones_total} milestones completed
            </p>
          </div>
          {publicProject.public_slug && (
            <a
              href={`/release/${publicProject.public_slug}`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
            >
              View release page <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* CTA 1 — PRIMARY */}
      <Button
        type="button"
        size="lg"
        onClick={openRoadmap}
        className="w-full h-auto py-3.5 rounded-2xl bg-gradient-to-r from-primary to-fuchsia-500 hover:opacity-90 text-primary-foreground shadow-lg flex-col gap-0.5"
      >
        <span className="flex items-center gap-1.5 font-display text-base font-semibold">
          <Star className="h-4 w-4 fill-current" />
          Start a Project
        </span>
        <span className="text-[11px] font-normal opacity-90">
          Build in public. Fans follow your roadmap. Earn your coin.
        </span>
      </Button>

      {/* CTA 2 — SECONDARY */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={openCoinFlow}
        className="w-full h-auto py-3 rounded-2xl flex-col gap-0.5 border-foreground/30"
      >
        <span className="flex items-center gap-1.5 font-semibold text-sm">
          <Coins className="h-4 w-4" />
          Start a Coin
        </span>
        <span className="text-[11px] font-normal text-muted-foreground">
          Already have proven work? Launch directly.
        </span>
      </Button>
    </div>
  );
}
