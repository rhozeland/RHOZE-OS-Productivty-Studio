import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EyeOff, Loader2, Sparkles, Image as ImageIcon, Play, Music, FileText,
  Calendar as CalendarIcon, FolderKanban, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import CreatorAvailabilityCalendar from "@/components/profile/CreatorAvailabilityCalendar";
import SupportSheet from "@/components/profile/SupportSheet";
import CreatorCoinsGallery from "@/components/profile/coins/CreatorCoinsGallery";
import ProfileGemHeader from "@/components/profile/ProfileGemHeader";
import { BoostProfileSheet } from "@/components/profile/BoostProfileSheet";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import FlowPostOwnerMenu from "@/components/profile/FlowPostOwnerMenu";
import { useUserNote } from "@/hooks/useNotes";
import { EmptyState } from "@/components/ui/empty-state";
import ShareCardModal from "@/components/share/ShareCardModal";

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

  // ─── Data fetching ───
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
        .select("id, title, description, status, cover_color, categories, created_at")
        .eq("user_id", id!).order("created_at", { ascending: false }).limit(12);
      return data ?? [];
    },
    enabled: !!id,
  });

  // ─── Connection logic ───
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
          {errored && (
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["profile", id] })}>
              Retry
            </Button>
          )}
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

  return (
    <div className="min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8 p-4 md:p-8 transition-colors duration-500" style={{ background: profileBg || undefined }}>
      <div className="space-y-5 max-w-6xl mx-auto">

        {/* ─── Unified Gem Header (banner + identity + stats integrated) ─── */}
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

        {/* ─── Coins ─── */}
        <CreatorCoinsGallery
          userId={p.user_id}
          creatorName={p.display_name || p.username}
          isOwner={isOwnProfile}
          fallbackWallet={p.solana_wallet ?? null}
        />

        {/* ─── Works grid ─── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" /> Works
              {flowPosts && flowPosts.length > 0 && (
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal ml-1">
                  · {flowPosts.length}
                </span>
              )}
            </h2>
          </div>
          <PostsGrid posts={flowPosts ?? []} isOwnProfile={isOwnProfile} navigate={navigate} />
        </section>

        {/* ─── Projects ─── */}
        {(buildingProjects?.length ?? 0) > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" /> Projects
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal ml-1">
                · {buildingProjects!.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(buildingProjects ?? []).map((pr: any) => (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => navigate(`/projects/${pr.id}`)}
                  className="text-left rounded-2xl border border-border/50 bg-card/60 hover:bg-card transition-colors p-4 space-y-2"
                >
                  <div className="h-1.5 rounded-full" style={{ background: pr.cover_color || "hsl(var(--primary))" }} />
                  <p className="font-display text-base font-semibold text-foreground line-clamp-2">{pr.title}</p>
                  {pr.description && <p className="text-xs text-muted-foreground line-clamp-2">{pr.description}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px] capitalize">{pr.status || "active"}</Badge>
                    {pr.created_at && <span className="text-[10px] text-muted-foreground">{format(new Date(pr.created_at), "MMM d, yyyy")}</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

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
          <ShareCardModal
            open={shareCardOpen}
            onOpenChange={setShareCardOpen}
            creatorId={id}
          />
        )}
        {isOwnProfile && (
          <BoostProfileSheet open={boostOpen} onOpenChange={setBoostOpen} />
        )}
        <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
          <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
            <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
              <DialogTitle className="font-display flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Book a session with {p.display_name || p.username}
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 sm:p-6">
              <CreatorAvailabilityCalendar
                creatorId={id!}
                creatorName={p.display_name || p.username}
              />
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
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
