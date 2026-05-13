/**
 * CreatorsGrid — Discover Featured layout for a single archetype.
 *
 * Replaces the old infinite gray-tile grid. We now show a small, curated
 * set per archetype, ranked by a completeness + recent-activity score so
 * empty default profiles don't pollute Discover.
 *
 * Ranking pipeline:
 *   1. Admin-pinned profiles where `featured_pin_until > now()` float first.
 *   2. Remaining profiles are scored:
 *        avatar         × 3
 *        custom banner  × 2  (anything other than the default gradient)
 *        bio ≥ 40 chars × 2
 *        creator_roles  × 1
 *        verified       × 4
 *        works count    × 3 (capped at 5)
 *        7d activity    × 1 per (capped at 5)
 *   3. Profiles scoring below 4 are hidden from Discover (still searchable
 *      elsewhere). Capped at 12 results — "View all creators" link sits
 *      at the bottom for the full browse experience.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import RegionChip from "@/components/profile/RegionChip";
import ArchetypeChip from "@/components/profile/ArchetypeChip";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Pin, Users, Sparkles } from "lucide-react";
import { ARCHETYPE_BY_ID, archetypeBannerGradient, type Archetype } from "@/lib/archetypes";
import { iconForRole, labelForRole } from "@/lib/creator-roles";
import { EmptyState } from "@/components/ui/empty-state";

const QUALITY_THRESHOLD = 3;
// v9.4: Featured Creators is now a tight, editorial 3-up — no more
// 12-tile grid. The "Browse all" link below is the escape hatch.
const MAX_FEATURED = 3;

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

interface ScoredProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_gradient: string | null;
  headline: string | null;
  bio: string | null;
  region_code: string | null;
  verification_status: string | null;
  creator_roles: string[] | null;
  archetype: string | null;
  featured_pin_until: string | null;
  score: number;
  pinned: boolean;
  workCount: number;
  /** Most recent work title + when, used to render the "live signal" line. */
  latestWork: { title: string | null; created_at: string } | null;
}

const CreatorsGrid = ({
  search = "",
  archetype = null,
  onArchetypeClick,
}: {
  search?: string;
  /** Optional archetype filter. `null` = show all creators. */
  archetype?: Archetype | null;
  /** When a chip on a tile is clicked, bubble it up so Discover can filter. */
  onArchetypeClick?: (a: Archetype) => void;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["discover-featured-creators", archetype ?? "all"],
    queryFn: async (): Promise<ScoredProfile[]> => {
      let query = supabase
        .from("profiles")
        .select(
          "user_id, display_name, username, avatar_url, banner_gradient, headline, bio, region_code, verification_status, is_public, creator_roles, archetype, featured_pin_until, created_at",
        )
        .neq("is_public", false)
        .limit(200);
      if (archetype === "artist") {
        // Backward-compat: profiles without archetype default to artist.
        query = query.or("archetype.eq.artist,archetype.is.null");
      } else if (archetype) {
        query = query.eq("archetype", archetype);
      }
      const { data: profiles, error } = await query;
      if (error) throw error;
      if (!profiles?.length) return [];

      const ids = profiles.map((p: any) => p.user_id);

      // Count works per creator (quality + activity signal).
      const { data: works } = await supabase
        .from("works")
        .select("user_id")
        .in("user_id", ids);
      const workCount = new Map<string, number>();
      (works ?? []).forEach((w: any) => {
        workCount.set(w.user_id, (workCount.get(w.user_id) ?? 0) + 1);
      });

      const now = Date.now();

      const scored: ScoredProfile[] = profiles.map((p: any) => {
        let score = 0;
        if (p.avatar_url) score += 3;
        // Treat custom banner as anything saved (default is null).
        if (p.banner_gradient) score += 2;
        if ((p.bio ?? "").length >= 40) score += 2;
        if (Array.isArray(p.creator_roles) && p.creator_roles.length) score += 1;
        if (p.verification_status === "verified") score += 4;
        const wc = workCount.get(p.user_id) ?? 0;
        score += Math.min(wc, 5) * 3;

        const pinned =
          !!p.featured_pin_until && new Date(p.featured_pin_until).getTime() > now;

        return {
          user_id: p.user_id,
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
          banner_gradient: p.banner_gradient,
          headline: p.headline,
          bio: p.bio,
          region_code: p.region_code,
          verification_status: p.verification_status,
          creator_roles: p.creator_roles ?? null,
          archetype: p.archetype,
          featured_pin_until: p.featured_pin_until ?? null,
          score,
          pinned,
          workCount: wc,
        };
      });

      // Quality gate (pinned profiles bypass it — admin override).
      const eligible = scored.filter((p) => p.pinned || p.score >= QUALITY_THRESHOLD);

      // Sort: pinned first, then score desc.
      eligible.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.score - a.score;
      });

      return eligible.slice(0, MAX_FEATURED);
    },
    staleTime: 60_000,
  });

  const meta = archetype ? ARCHETYPE_BY_ID.get(archetype) : null;
  const noun = meta?.plural.toLowerCase() ?? "creators";
  const term = search.trim().toLowerCase();
  const filtered = (data ?? []).filter((p) => {
    if (!term) return true;
    return (
      p.display_name?.toLowerCase().includes(term) ||
      p.username?.toLowerCase().includes(term) ||
      p.headline?.toLowerCase().includes(term) ||
      p.bio?.toLowerCase().includes(term)
    );
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <EmptyState
        icon={Users}
        title={
          term
            ? `No ${noun} match that search`
            : archetype
              ? `No ${noun} featured here yet`
              : "No creators featured yet"
        }
        description={
          term
            ? "Try a different word, or clear the search."
            : archetype
              ? `No one in this branch has been featured yet. Check back soon — or browse all creators.`
              : `Featured creators need an avatar, a bio, and a few works first.`
        }
        cta={!term && archetype ? { label: "Browse all creators", to: "/profiles" } : undefined}
        size="lg"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((p, i) => {
          const name = p.display_name ?? p.username ?? "Creator";
          const role =
            Array.isArray(p.creator_roles) && p.creator_roles.length
              ? p.creator_roles[0]
              : p.headline ?? null;
          const banner =
            p.banner_gradient || archetypeBannerGradient(p.archetype as Archetype | null, p.user_id);

          return (
            <motion.div
              key={p.user_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.24) }}
            >
              <Link
                to={`/profiles/${p.user_id}`}
                className="group relative block aspect-square overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-foreground/40 hover:shadow-lg"
                aria-label={`Open ${name}'s profile`}
              >
                <div
                  className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                  style={{ background: banner }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                {/* Top chips */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2 z-10">
                  <div className="flex items-center gap-1.5">
                    {p.archetype && onArchetypeClick ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onArchetypeClick(p.archetype as Archetype);
                        }}
                        className="rounded-full hover:scale-105 transition-transform"
                        aria-label={`Filter by ${p.archetype}`}
                      >
                        <ArchetypeChip archetype={p.archetype} size="xs" />
                      </button>
                    ) : (
                      <ArchetypeChip archetype={p.archetype} size="xs" />
                    )}
                    {p.pinned && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-foreground/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-background backdrop-blur-md"
                        title="Featured by Rhozeland"
                      >
                        <Pin className="h-2.5 w-2.5" /> Featured
                      </span>
                    )}
                  </div>
                  {p.verification_status === "verified" && (
                    <VerifiedArtistBadge status="verified" size="xs" showLabel={false} />
                  )}
                </div>

                {/* Avatar */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] z-10">
                  <Avatar className="h-16 w-16 ring-2 ring-white/40 shadow-xl">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="text-base font-semibold">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Footer */}
                <div className="absolute inset-x-0 bottom-0 p-3 text-white z-10">
                  <p className="font-display font-semibold text-sm leading-tight line-clamp-1">
                    {name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {role && (
                      <p className="text-[11px] text-white/75 truncate flex-1">{role}</p>
                    )}
                    <RegionChip code={p.region_code} />
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Escape hatch into the full list */}
      <div className="flex justify-center pt-1">
        <Link
          to="/profiles"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Browse all {noun} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
};

export default CreatorsGrid;
