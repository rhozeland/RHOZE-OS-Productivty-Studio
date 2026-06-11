/**
 * SupportingTab — shows the artists, releases and coins this user backs.
 *
 * Public data (always visible):
 *   - project_cheers → public release projects they've cheered
 *
 * Private data (only when viewing your own profile):
 *   - creator_subscriptions → creators they back monthly
 *   - creator_token_grants  → pump.fun coins they hold
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/ui/empty-state";
import { HeartHandshake, FolderKanban, Users, Coins, ArrowRight, Heart, Lock, Sparkles } from "lucide-react";

interface Props {
  userId: string;
  isOwnProfile: boolean;
}

const SupportingTab = ({ userId, isOwnProfile }: Props) => {
  const sb: any = supabase;

  // Cheered public projects.
  // On your own profile we show every cheer (private ones get a "Private" chip).
  // On someone else's, only cheers explicitly shared to profile.
  const { data: cheeredProjects = [] } = useQuery({
    queryKey: ["supporting-cheers", userId, isOwnProfile],
    enabled: !!userId,
    queryFn: async () => {
      let q = sb
        .from("project_cheers")
        .select("project_id, created_at, shared_to_profile")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(24);
      if (!isOwnProfile) q = q.eq("shared_to_profile", true);
      const { data: cheerRows, error } = await q;
      if (error) throw error;

      const projectIds = Array.from(
        new Set((cheerRows ?? []).map((row: any) => row.project_id).filter(Boolean)),
      );
      if (!projectIds.length) return [];

      const { data: projects, error: projectsError } = await sb
        .from("projects")
        .select("id, title, cover_color, public_slug, is_public, user_id, owner:user_id(id, username, display_name, avatar_url)")
        .in("id", projectIds);
      if (projectsError) throw projectsError;

      const projectById = new Map((projects ?? []).map((project: any) => [project.id, project]));

      return (cheerRows ?? [])
        .map((row: any) => ({
          ...row,
          project: projectById.get(row.project_id) ?? null,
        }))
        .filter((row: any) => row.project?.is_public);
    },
  });


  // Backed creators (subscriptions) — own profile only (RLS)
  const { data: backedCreators = [] } = useQuery({
    queryKey: ["supporting-subs", userId],
    enabled: !!userId && isOwnProfile,
    queryFn: async () => {
      const { data, error } = await sb
        .from("creator_subscriptions")
        .select("creator_id, tier, monthly_price_usd, status, creator:creator_id(id, username, display_name, avatar_url)")
        .eq("subscriber_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Held creator tokens — own profile only (RLS)
  const { data: heldCoins = [] } = useQuery({
    queryKey: ["supporting-coins", userId],
    enabled: !!userId && isOwnProfile,
    queryFn: async () => {
      const { data, error } = await sb
        .from("creator_token_grants")
        .select("creator_id, mint_address, balance, creator:creator_id(id, username, display_name, avatar_url, token_ticker)")
        .eq("user_id", userId)
        .gt("balance", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const nothingHere =
    cheeredProjects.length === 0 &&
    backedCreators.length === 0 &&
    heldCoins.length === 0;

  if (nothingHere) {
    return (
      <EmptyState
        icon={HeartHandshake}
        title={isOwnProfile ? "You're not supporting anyone yet" : "Not supporting anyone publicly yet"}
        description={
          isOwnProfile
            ? "Cheer releases, back creators, or hold their coin — everything you support will live here."
            : "Releases this person cheers will show up here."
        }
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Backed creators */}
      {isOwnProfile && backedCreators.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Backed creators
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {backedCreators.map((row: any) => (
              <Link
                key={row.creator_id}
                to={`/profile/${row.creator_id}`}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 hover:bg-card transition-colors p-3"
              >
                <div className="h-11 w-11 rounded-full overflow-hidden bg-muted shrink-0">
                  {row.creator?.avatar_url && (
                    <img src={row.creator.avatar_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground truncate">
                    {row.creator?.display_name || row.creator?.username || "Creator"}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {row.tier} · ${row.monthly_price_usd}/mo
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Held coins */}
      {isOwnProfile && heldCoins.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Coins className="h-3.5 w-3.5" /> Coins you hold
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {heldCoins.map((row: any) => (
              <Link
                key={row.mint_address}
                to={`/profile/${row.creator_id}`}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 hover:bg-card transition-colors p-3"
              >
                <div className="h-11 w-11 rounded-full overflow-hidden bg-muted shrink-0">
                  {row.creator?.avatar_url && (
                    <img src={row.creator.avatar_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground truncate">
                    {row.creator?.display_name || row.creator?.username || "Creator"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    ${row.creator?.token_ticker ?? "COIN"} · {Number(row.balance).toLocaleString()} held
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Cheered projects */}
      {cheeredProjects.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <FolderKanban className="h-3.5 w-3.5" /> Releases cheered
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cheeredProjects.map((row: any) => {
              const pr = row.project;
              const slug = pr?.public_slug;
              const to = slug ? `/release/${slug}` : `/projects/${pr.id}`;
              return (
                <Link
                  key={pr.id}
                  to={to}
                  className="block rounded-2xl border border-border/60 overflow-hidden hover:opacity-95 transition-opacity"
                  style={{
                    background:
                      pr.cover_color
                        ? `linear-gradient(135deg, ${pr.cover_color}, #1a0a2e)`
                        : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                  }}
                >
                  <div className="p-4 min-h-[110px] flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Cheering</p>
                      <p className="font-display text-base font-bold text-white truncate">{pr.title}</p>
                    </div>
                    {isOwnProfile && !row.shared_to_profile && (
                      <span className="shrink-0 rounded-full bg-white/15 backdrop-blur px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/90">
                        Private
                      </span>
                    )}
                  </div>

                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default SupportingTab;
