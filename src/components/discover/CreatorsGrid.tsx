/**
 * CreatorsGrid — Discover Stream filter view for "Creators".
 *
 * Renders a uniform grid of public profiles, matching the density of the
 * filtered ConversationsMosaic (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4`)
 * so toggling between filters feels visually consistent.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import RegionChip from "@/components/profile/RegionChip";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

const CreatorsGrid = ({ search = "" }: { search?: string }) => {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["discover-creators-grid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id, display_name, username, avatar_url, banner_gradient, headline, bio, region_code, verification_status, is_public, creator_roles",
        )
        .order("created_at", { ascending: false })
        .limit(48);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const term = search.trim().toLowerCase();
  const filtered = (profiles ?? []).filter((p: any) => {
    if (p.is_public === false) return false;
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
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-foreground font-medium">
          {term ? "No creators match that search." : "No creators yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {filtered.map((p: any, i: number) => {
        const name = p.display_name ?? p.username ?? "Creator";
        const role = Array.isArray(p.creator_roles) && p.creator_roles.length
          ? p.creator_roles[0]
          : p.headline ?? null;
        const banner =
          p.banner_gradient ||
          `linear-gradient(135deg, hsl(var(--primary) / 0.6), hsl(var(--accent) / 0.4) 70%, hsl(var(--card)))`;

        return (
          <motion.div
            key={p.user_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.025, 0.3) }}
          >
            <Link
              to={`/profiles/${p.user_id}`}
              className="group relative block aspect-square overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-foreground/40 hover:shadow-lg"
              aria-label={`Open ${name}'s profile`}
            >
              {/* Banner backdrop */}
              <div
                className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                style={{ background: banner }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

              {/* Top chip */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2 z-10">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-md bg-violet-500/20 text-violet-100">
                  Creator
                </span>
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
  );
};

export default CreatorsGrid;
