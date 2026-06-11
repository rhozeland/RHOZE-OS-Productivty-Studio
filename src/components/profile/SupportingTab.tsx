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
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/ui/empty-state";
import { HeartHandshake, FolderKanban, Users, Coins, ArrowRight } from "lucide-react";

interface Props {
  userId: string;
  isOwnProfile: boolean;
}

const SupportingTab = ({ userId, isOwnProfile }: Props) => {
  const sb: any = supabase;

  // Cheered public projects
  const { data: cheeredProjects = [] } = useQuery({
    queryKey: ["supporting-cheers", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("project_cheers")
        .select("project_id, created_at, projects:project_id(id, title, accent_color, public_slug, is_public, owner_id)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.projects?.is_public);
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
              const pr = row.projects;
              const slug = pr?.public_slug;
              const to = slug ? `/release/${slug}` : `/projects/${pr.id}`;
              return (
                <Link
                  key={pr.id}
                  to={to}
                  className="block rounded-2xl border border-border/60 overflow-hidden hover:opacity-95 transition-opacity"
                  style={{
                    background:
                      pr.accent_color
                        ? `linear-gradient(135deg, ${pr.accent_color}, #1a0a2e)`
                        : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                  }}
                >
                  <div className="p-4 min-h-[110px] flex items-end">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Cheering</p>
                      <p className="font-display text-base font-bold text-white truncate">{pr.title}</p>
                    </div>
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
