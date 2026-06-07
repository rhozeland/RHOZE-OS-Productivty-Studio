import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EyeOff, Loader2, Sparkles, Image as ImageIcon, Play, Music, FileText,
  Calendar as CalendarIcon, FolderKanban, ExternalLink, Coins, Heart,
  Rocket, Inbox, Users, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import CreatorAvailabilityCalendar from "@/components/profile/CreatorAvailabilityCalendar";
import SupportSheet from "@/components/profile/SupportSheet";
import CreatorCoinsGallery from "@/components/profile/coins/CreatorCoinsGallery";
import ProfileGemHeader from "@/components/profile/ProfileGemHeader";
import { BoostProfileSheet } from "@/components/profile/BoostProfileSheet";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import FlowPostOwnerMenu from "@/components/profile/FlowPostOwnerMenu";
import TokenDiscoveryChip from "@/components/profile/TokenDiscoveryChip";
import { useUserNote } from "@/hooks/useNotes";
import { EmptyState } from "@/components/ui/empty-state";
import ShareCardModal from "@/components/share/ShareCardModal";
import ProfileProjectCard from "@/components/profile/ProfileProjectCard";

type TabKey = "projects" | "works";

const ProfileDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const isOwnProfile = user?.id === id;
  const { data: profileNote } = useUserNote(id);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  const initialTab = (searchParams.get("tab") as TabKey) || "projects";
  const [tab, setTab] = useState<TabKey>(
    ["projects", "works"].includes(initialTab) ? initialTab : "projects",
  );

  const [subscribeOpen, setSubscribeOpen] = useState(
    searchParams.get("subscribe") === "1" || searchParams.get("back") === "1",
  );

  useEffect(() => {
    if (searchParams.get("back") === "1" || searchParams.get("subscribe") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("back");
      next.delete("subscribe");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Data ───
  const { data: profile, isLoading, error: profileError } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_profile", { _user_id: id! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!id,
    retry: 1,
    staleTime: 30_000,
  });

  const { data: connectionStatus } = useQuery({
    queryKey: ["connection-status", user?.id, id],
    queryFn: async () => {
      const { data } = await supabase.from("connections").select("*")
        .or(`and(follower_id.eq.${user!.id},following_id.eq.${id}),and(follower_id.eq.${id},following_id.eq.${user!.id})`);
      return data ?? [];
    },
    enabled: !!user && !!id && !isOwnProfile,
  });

  const { data: reviewStats } = useQuery({
    queryKey: ["seller-review-stats", id],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("rating").eq("seller_id", id!);
      if (!data || data.length === 0) return { avg: 0, count: 0 };
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!id,
  });

  const { data: flowPosts } = useQuery({
    queryKey: ["profile-flow-posts", id],
    queryFn: async () => {
      const { data } = await supabase.from("flow_items")
        .select("id, title, file_url, link_url, category, content_type, description, solana_signature, anchored_at, archived_at, created_at")
        .eq("user_id", id!).order("created_at", { ascending: false }).limit(24);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: buildingProjects } = useQuery({
    queryKey: ["profile-building-projects", id],
    queryFn: async () => {
      const { data } = await supabase.from("projects")
        .select("id, title, description, status, cover_color, categories, created_at, intake_tier")
        .eq("user_id", id!).order("created_at", { ascending: false }).limit(12);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Collaborators for all projects on this profile — one round-trip
  const projectIds = (buildingProjects ?? []).map((p: any) => p.id);
  const { data: projectCollaborators } = useQuery({
    queryKey: ["profile-project-collaborators", projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("project_collaborators")
        .select("project_id, user_id")
        .in("project_id", projectIds);
      const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
      const { data: profs } = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, display_name, username, avatar_url")
            .in("user_id", userIds)
        : { data: [] as any[] };
      const byUser: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => { byUser[p.user_id] = p; });
      const map: Record<string, any[]> = {};
      (rows ?? []).forEach((row: any) => {
        const list = map[row.project_id] || (map[row.project_id] = []);
        const pr = byUser[row.user_id] || {};
        list.push({
          user_id: row.user_id,
          display_name: pr.display_name,
          username: pr.username,
          avatar_url: pr.avatar_url,
        });
      });
      return map;
    },
  });

  // Priority project + milestones (top of left column)
  const activeProject = (buildingProjects ?? []).find((p: any) => p.status !== "completed") ?? (buildingProjects ?? [])[0];
  const { data: milestones } = useQuery({
    queryKey: ["profile-project-milestones", activeProject?.id],
    queryFn: async () => {
      const { data } = await supabase.from("project_goals")
        .select("id, title, status, position")
        .eq("project_id", activeProject!.id)
        .order("position", { ascending: true });
      return data ?? [];
    },
    enabled: !!activeProject?.id,
  });

  // "Works mostly with" — creators this user follows
  const { data: collaborators } = useQuery({
    queryKey: ["profile-collaborators", id],
    queryFn: async () => {
      const { data: conns } = await supabase.from("connections")
        .select("following_id").eq("follower_id", id!).eq("type", "follow").eq("status", "active").limit(6);
      const ids = (conns ?? []).map((c: any) => c.following_id);
      if (ids.length === 0) return [];
      const { data: people } = await supabase.from("profiles")
        .select("user_id, display_name, username, avatar_url, headline").in("user_id", ids);
      return people ?? [];
    },
    enabled: !!id,
  });

  // Owner-only pending inbox count
  const { data: inboxCount } = useQuery({
    queryKey: ["profile-inbox-count", id],
    queryFn: async () => {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("receiver_id", id!).eq("read", false);
      return count ?? 0;
    },
    enabled: !!id && isOwnProfile,
  });

  // ─── Follow logic ───
  const isFollowing = connectionStatus?.some((c: any) => c.follower_id === user?.id && c.following_id === id && c.type === "follow" && c.status === "active");

  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from("connections").delete().eq("follower_id", user!.id).eq("following_id", id!).eq("type", "follow");
      } else {
        await supabase.from("connections").insert({ follower_id: user!.id, following_id: id!, type: "follow", status: "active" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["followers-count"] });
      toast.success(isFollowing ? "Unfollowed" : "Following!");
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!profile) {
    const errored = !!profileError;
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">
          {errored ? "Couldn't load this profile. Please try again." : "Profile not found"}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {errored && <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["profile", id] })}>Retry</Button>}
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    );
  }
  if (!isOwnProfile && profile.is_public === false) {
    return (
      <div className="text-center py-20">
        <EyeOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-display text-xl font-semibold text-foreground">Private Profile</h2>
        <p className="text-muted-foreground mt-2">This creator's profile is set to private.</p>
      </div>
    );
  }

  const p = profile as any;
  const profileBg = p.profile_background;
  const completedMs = (milestones ?? []).filter((m: any) => m.status === "done" || m.status === "completed").length;
  const totalMs = (milestones ?? []).length;

  const handleTabChange = (next: TabKey) => {
    setTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  };

  const TABS: { key: TabKey; label: string; Icon: any }[] = [
    { key: "works", label: "Works", Icon: ImageIcon },
    { key: "projects", label: "Projects", Icon: FolderKanban },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8 p-4 md:p-8 transition-colors duration-500" style={{ background: profileBg || undefined }}>
      <div className="space-y-5 max-w-6xl mx-auto">

        {/* ─── Header ─── */}
        <ProfileGemHeader
          profile={p}
          isOwnProfile={isOwnProfile}
          authedUser={user ? { id: user.id } : null}
          profileNote={profileNote ?? null}
          isFollowing={!!isFollowing}
          onFollow={() => followMutation.mutate()}
          followPending={followMutation.isPending}
          onMessage={() => navigate(`/messages?to=${id}`)}
          onSupport={() => user ? setSubscribeOpen(true) : navigate("/auth")}
          onEditProfile={() => navigate("/settings")}
          onBoost={() => setBoostOpen(true)}
          onShareCard={() => setShareCardOpen(true)}
          reviewStats={reviewStats}
        />

        {/* ─── Floating icon tabs (no bar, free-flowing) ─── */}
        <div className="flex items-center justify-start gap-2">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleTabChange(key)}
              aria-label={label}
              title={label}
              className={cn(
                "inline-flex items-center justify-center h-10 w-10 rounded-full transition-all",
                tab === key
                  ? "bg-foreground text-background shadow-md scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* ─── 65/35 grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-5">

          {/* LEFT — Active Engine */}
          <div className="space-y-4 min-w-0">
            {/* Priority Tracker */}
            {activeProject && totalMs > 0 && (
              <Link
                to={`/projects/${activeProject.id}`}
                className="block rounded-2xl border border-border/60 bg-card/70 hover:bg-card transition-colors p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Priority release</p>
                    <p className="font-display text-base font-semibold text-foreground mt-1 truncate">{activeProject.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {completedMs} of {totalMs} milestones completed
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-fuchsia-500 transition-all"
                    style={{ width: `${totalMs ? (completedMs / totalMs) * 100 : 0}%` }}
                  />
                </div>
              </Link>
            )}

            {/* Tab content */}
            {tab === "projects" && (
              <section className="space-y-3">
                {(buildingProjects?.length ?? 0) === 0 ? (
                  <EmptyState icon={FolderKanban} title="No projects yet" description="Releases this creator is building will appear here." size="sm" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(buildingProjects ?? []).map((pr: any) => (
                      <ProfileProjectCard
                        key={pr.id}
                        project={pr}
                        collaborators={projectCollaborators?.[pr.id] ?? []}
                        onOpen={() => navigate(`/projects/${pr.id}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {tab === "works" && (
              <section className="space-y-3">
                <PostsGrid posts={flowPosts ?? []} isOwnProfile={isOwnProfile} navigate={navigate} />
              </section>
            )}

          </div>

          {/* RIGHT — Action & Utility Hub */}
          <aside className="space-y-3 min-w-0">
            {isOwnProfile ? (
              <>
                {/* Start a project */}
                <button
                  type="button"
                  onClick={() => navigate("/projects/new")}
                  className="w-full text-left rounded-2xl p-5 bg-gradient-to-br from-primary via-fuchsia-500 to-amber-500 text-primary-foreground shadow-lg hover:opacity-95 transition-opacity"
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-90">
                    <Sparkles className="h-3.5 w-3.5" /> Build in public
                  </div>
                  <p className="font-display text-lg font-bold mt-2">Start a project</p>
                  <p className="text-xs opacity-90 mt-1">Spin up a release with milestones, scope and collaborators.</p>
                </button>

                {/* Start a coin */}
                {!p.token_mint_address && (
                  <a
                    href="https://pump.fun/create"
                    target="_blank"
                    rel="noopener"
                    className="block rounded-2xl p-5 bg-zinc-950 text-white shadow-lg hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-75">
                      <Rocket className="h-3.5 w-3.5" /> Monetize
                    </div>
                    <p className="font-display text-lg font-bold mt-2">Launch on pump.fun</p>
                    <p className="text-xs opacity-75 mt-1">Start a coin and earn 5bps on every trade.</p>
                  </a>
                )}

                {/* Pending inbox */}
                <button
                  type="button"
                  onClick={() => navigate("/messages")}
                  className="w-full text-left rounded-2xl border border-border/50 bg-card/70 hover:bg-card p-4 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Inbox</span>
                    </div>
                    {(inboxCount ?? 0) > 0 ? (
                      <Badge className="text-[10px]">{inboxCount} new</Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">All caught up</span>
                    )}
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Support */}
                <button
                  type="button"
                  onClick={() => user ? setSubscribeOpen(true) : navigate("/auth")}
                  className="w-full text-left rounded-2xl p-5 bg-gradient-to-br from-primary via-fuchsia-500 to-amber-500 text-primary-foreground shadow-lg hover:opacity-95 transition-opacity"
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-90">
                    <Heart className="h-3.5 w-3.5" /> Back this artist
                  </div>
                  <p className="font-display text-lg font-bold mt-2">Support {p.display_name || p.username}</p>
                  <p className="text-xs opacity-90 mt-1">Subscribe, tip, or fund the next milestone.</p>
                </button>
              </>
            )}

            {/* Token / Coin — full chart panel */}
            {p.token_mint_address ? (
              <CreatorCoinsGallery
                userId={p.user_id}
                creatorName={p.display_name || p.username}
                isOwner={isOwnProfile}
                fallbackWallet={p.solana_wallet ?? null}
              />
            ) : isOwnProfile ? null : (
              <div className="rounded-2xl border border-dashed border-border/50 bg-card/40 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  <Coins className="h-3.5 w-3.5" /> Creator coin
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.display_name || p.username} hasn't launched a coin yet.
                </p>
              </div>
            )}
          </aside>
        </div>

        {/* Sheets / dialogs */}
        {!isOwnProfile && id && (
          <SupportSheet
            open={subscribeOpen}
            onOpenChange={setSubscribeOpen}
            creatorId={id}
            creatorName={p.display_name || p.username || "this artist"}
          />
        )}
        {id && (
          <ShareCardModal open={shareCardOpen} onOpenChange={setShareCardOpen} creatorId={id} />
        )}
        {isOwnProfile && <BoostProfileSheet open={boostOpen} onOpenChange={setBoostOpen} />}
        <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
          <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
              <DialogTitle className="font-display flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Book a session with {p.display_name || p.username}
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 sm:p-6">
              <CreatorAvailabilityCalendar creatorId={id!} creatorName={p.display_name || p.username} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};


/* ─── PostsGrid ─── */
const PostsGrid = ({
  posts,
  isOwnProfile,
  navigate,
  emptyTitle = "No posts yet",
  emptyDescription = "Use the post button on Discover to drop a work — it'll show up here.",
}: {
  posts: any[];
  isOwnProfile: boolean;
  navigate: (to: string, opts?: any) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) => {
  if (!posts || posts.length === 0) {
    if (isOwnProfile) {
      return (
        <EmptyState
          icon={Sparkles}
          title={emptyTitle}
          description={emptyDescription}
          cta={{ label: "Open post", to: "/discover?post=1", prominent: true }}
          size="sm"
        />
      );
    }
    return <p className="text-xs text-muted-foreground italic">{emptyTitle}.</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
      {posts.map((post: any) => {
        const cat = (post.category || "").toLowerCase();
        const CatIcon =
          cat.includes("music") || cat.includes("audio") ? Music
          : cat.includes("video") ? Play
          : cat.includes("write") || cat.includes("text") ? FileText
          : cat.includes("link") ? ExternalLink
          : ImageIcon;
        return (
          <div
            key={post.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/flow?item=${post.id}`, { state: { from: location.pathname + location.search + location.hash } })}
            onKeyDown={(e: any) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`/flow?item=${post.id}`, { state: { from: location.pathname + location.search + location.hash } });
              }
            }}
            className="group relative aspect-square overflow-hidden bg-muted rounded-md hover:opacity-90 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label={post.title || "Open post"}
          >
            <FlowThumbnail
              fileUrl={post.file_url}
              linkUrl={post.link_url}
              title={post.title}
              description={post.description}
              category={post.category}
              hideCaption
              className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {post.archived_at && (
              <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-white/90 bg-white/10 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/20">
                  Archived
                </span>
              </div>
            )}
            <div className="absolute top-1.5 left-1.5 h-6 w-6 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
              <CatIcon className="h-3 w-3 text-white" />
            </div>
            {post.solana_signature && (
              <div className="absolute top-1.5 right-1.5">
                <VerifiedIPBadge signature={post.solana_signature} size="xs" showLabel={false} className="shadow-sm" />
              </div>
            )}
            {isOwnProfile && <FlowPostOwnerMenu post={post} />}
          </div>
        );
      })}
    </div>
  );
};

export default ProfileDetailPage;
