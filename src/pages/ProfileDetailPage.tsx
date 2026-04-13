import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe, CheckCircle, UserPlus, UserCheck, MessageSquare, MapPin, Clock,
  Eye, EyeOff, Loader2, Palette, FolderOpen, Settings, Store, Star,
  ExternalLink, ShoppingBag, GripVertical, Sparkles, Image as ImageIcon,
  X, Play, Music, FileText, Bookmark, Send,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, Reorder } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import ProfileSellerStats from "@/components/profile/ProfileSellerStats";
import CreatorReputation from "@/components/reputation/CreatorReputation";
import ProfileBadges from "@/components/profile/ProfileBadges";
import { cn } from "@/lib/utils";

type SectionId = "about" | "stats" | "offerings" | "flow_posts" | "boards";

const DEFAULT_LAYOUT: SectionId[] = ["about", "stats", "offerings", "flow_posts", "boards"];

const SECTION_LABELS: Record<SectionId, string> = {
  about: "About",
  stats: "Stats",
  offerings: "Offerings",
  flow_posts: "Flow Posts",
  boards: "Public Boards",
};

const ProfileDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customizing, setCustomizing] = useState(false);
  

  const isOwnProfile = user?.id === id;

  // Fetch profile — own profile gets full data, other users get public fields only
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      if (isOwnProfile) {
        const { data, error } = await supabase.from("profiles").select("*").eq("user_id", id!).single();
        if (error) throw error;
        return data;
      }
      // Use RPC for other users to avoid exposing shipping addresses
      const { data, error } = await supabase.rpc("get_public_profile", { _user_id: id! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!id,
  });

  // Connection status
  const { data: connectionStatus } = useQuery({
    queryKey: ["connection-status", user?.id, id],
    queryFn: async () => {
      const { data } = await supabase.from("connections").select("*")
        .or(`and(follower_id.eq.${user!.id},following_id.eq.${id}),and(follower_id.eq.${id},following_id.eq.${user!.id})`);
      return data ?? [];
    },
    enabled: !!user && !!id && !isOwnProfile,
  });

  const { data: publicSmartboards } = useQuery({
    queryKey: ["public-smartboards", id],
    queryFn: async () => {
      const { data } = await supabase.from("smartboards")
        .select("id, title, description, cover_color, created_at")
        .eq("user_id", id!).eq("is_public", true).order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: publicProjects } = useQuery({
    queryKey: ["user-projects", id],
    queryFn: async () => {
      const { data } = await supabase.from("projects")
        .select("id, title, description, status, cover_color, created_at")
        .eq("user_id", id!).order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
    enabled: !!id && isOwnProfile,
  });

  const { data: sellerListings } = useQuery({
    queryKey: ["seller-listings", id],
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_listings")
        .select("id, title, category, listing_type, price, currency, credits_price, cover_url, image_url, tags")
        .eq("user_id", id!).eq("is_active", true).order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
    enabled: !!id,
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

  // Flow posts for this user
  const { data: flowPosts } = useQuery({
    queryKey: ["profile-flow-posts", id],
    queryFn: async () => {
      const { data } = await supabase.from("flow_items")
        .select("id, title, file_url, link_url, category, content_type, description, created_at")
        .eq("user_id", id!)
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: followerCount } = useQuery({
    queryKey: ["followers-count", id],
    queryFn: async () => {
      const { count } = await supabase.from("connections").select("*", { count: "exact", head: true })
        .eq("following_id", id!).eq("type", "follow").eq("status", "active");
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: followingCount } = useQuery({
    queryKey: ["following-count", id],
    queryFn: async () => {
      const { count } = await supabase.from("connections").select("*", { count: "exact", head: true })
        .eq("follower_id", id!).eq("type", "follow").eq("status", "active");
      return count ?? 0;
    },
    enabled: !!id,
  });

  const isFollowing = connectionStatus?.some((c: any) => c.follower_id === user?.id && c.following_id === id && c.type === "follow" && c.status === "active");
  const connectRequest = connectionStatus?.find((c: any) => c.type === "connect");
  const isConnected = connectRequest?.status === "active" && ((connectRequest?.follower_id === user?.id) || (connectRequest?.following_id === user?.id));
  const hasPendingConnect = connectRequest?.status === "pending";
  const receivedConnectRequest = hasPendingConnect && connectRequest?.following_id === user?.id;

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

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (isConnected) {
        await supabase.from("connections").delete().eq("id", connectRequest!.id);
      } else {
        await supabase.from("connections").insert({ follower_id: user!.id, following_id: id!, type: "connect", status: "pending" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      toast.success(isConnected ? "Disconnected" : "Connection request sent!");
    },
  });

  const acceptConnectMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("connections").update({ status: "active" }).eq("id", connectRequest!.id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["connection-status"] }); toast.success("Connected!"); },
  });

  const toggleSectionMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: boolean }) => {
      const { error } = await supabase.from("profiles").update({ [field]: value } as any).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["profile", id] }); },
    onError: () => { toast.error("Failed to update section visibility"); },
  });

  const saveLayoutMutation = useMutation({
    mutationFn: async (layout: SectionId[]) => {
      const { error } = await supabase.from("profiles").update({ profile_layout: layout } as any).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", id] });
      toast.success("Layout saved!");
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Profile not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Back</Button>
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

  const initials = (profile.display_name || (profile as any).username || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const profileBg = (profile as any).profile_background;
  const bannerGradient = (profile as any).banner_gradient || "linear-gradient(135deg, hsl(220,15%,40%), hsl(220,10%,55%), hsl(175,30%,65%))";
  const bannerImageUrl = (profile as any).banner_url;
  const hasSellerContent = (sellerListings?.length ?? 0) > 0;

  const showSellerStats = (profile as any).show_seller_stats !== false;
  const showOfferings = (profile as any).show_offerings !== false;
  const showPublicBoards = (profile as any).show_public_boards !== false;
  const showFlowPosts = (profile as any).show_flow_posts !== false;

  const layout: SectionId[] = (() => {
    const saved = (profile as any).profile_layout;
    if (Array.isArray(saved) && saved.length > 0) return saved as SectionId[];
    return DEFAULT_LAYOUT;
  })();

  const visibilityMap: Record<SectionId, { field: string; visible: boolean }> = {
    about: { field: "", visible: true },
    stats: { field: "show_seller_stats", visible: showSellerStats },
    offerings: { field: "show_offerings", visible: showOfferings },
    flow_posts: { field: "show_flow_posts", visible: showFlowPosts },
    boards: { field: "show_public_boards", visible: showPublicBoards },
  };

  const renderSection = (sectionId: SectionId, index: number) => {
    const vis = visibilityMap[sectionId];
    const isVisible = vis.visible;
    if (!isVisible && !isOwnProfile) return null;

    const wrapperClass = !isVisible && isOwnProfile ? "opacity-50 relative" : "relative";

    const toggleButton = isOwnProfile && vis.field && (
      <button
        onClick={() => toggleSectionMutation.mutate({ field: vis.field, value: !isVisible })}
        className="absolute -top-1 right-0 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title={isVisible ? "Hide from public" : "Show to public"}
      >
        {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
    );

    const dashedBorder = !isVisible && isOwnProfile && (
      <div className="absolute inset-0 rounded-xl border-2 border-dashed border-muted-foreground/20 pointer-events-none z-0" />
    );

    switch (sectionId) {
      case "about":
        return (
          <motion.div key="about" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">About</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {profile.bio || "This creator hasn't added a bio yet."}
              </p>
              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((skill: string) => <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>)}
                  </div>
                </div>
              )}
              {(profile as any).mediums && (profile as any).mediums.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1"><Palette className="h-3 w-3" /> Mediums</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile as any).mediums.map((medium: string) => <Badge key={medium} variant="outline" className="text-xs">{medium}</Badge>)}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5 space-y-3">
              <h2 className="font-display text-lg font-semibold text-foreground">Details</h2>
              {profile.portfolio_url && (
                <a href={profile.portfolio_url} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Globe className="h-4 w-4" /> Portfolio <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /> Joined {format(new Date(profile.created_at), "MMMM yyyy")}
              </div>
              {hasSellerContent && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Store className="h-4 w-4" /> Active seller</div>
              )}
              {((profile as any).instagram_url || (profile as any).tiktok_url || (profile as any).twitter_url || (profile as any).youtube_url) && (
                <div className="pt-2 border-t border-border/50">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Socials</h3>
                  <div className="flex items-center gap-2">
                    {(profile as any).instagram_url && (
                      <a href={(profile as any).instagram_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="Instagram">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      </a>
                    )}
                    {(profile as any).tiktok_url && (
                      <a href={(profile as any).tiktok_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="TikTok">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.8a8.23 8.23 0 004.77 1.52V6.85a4.86 4.86 0 01-1-.16z"/></svg>
                      </a>
                    )}
                    {(profile as any).twitter_url && (
                      <a href={(profile as any).twitter_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="X">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                    )}
                    {(profile as any).youtube_url && (
                      <a href={(profile as any).youtube_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="YouTube">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        );

      case "stats":
        return (
          <div key="stats" className={wrapperClass}>
            {toggleButton}
            {dashedBorder}
            <div className={!isVisible && isOwnProfile ? "opacity-50" : ""}>
              <ProfileSellerStats userId={id!} isOwnProfile={isOwnProfile} />
            </div>
          </div>
        );

      case "offerings":
        if (!hasSellerContent) return null;
        return (
          <motion.div key="offerings" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className={`space-y-3 ${wrapperClass}`}>
            {toggleButton}
            {dashedBorder}
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" /> Offerings
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sellerListings!.map((listing: any) => (
                <div key={listing.id} onClick={() => navigate(`/creators/${listing.id}`)}
                  className="group rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200">
                  {(listing.cover_url || listing.image_url) ? (
                    <div className="aspect-[4/3] overflow-hidden bg-muted">
                      <img src={listing.cover_url || listing.image_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <Store className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate">{listing.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="outline" className="text-[9px] capitalize">{listing.category}</Badge>
                      {listing.credits_price && <span className="text-[10px] font-semibold text-primary">{listing.credits_price} ◊</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );

      case "flow_posts":
        if (!flowPosts || flowPosts.length === 0) {
          if (!isOwnProfile) return null;
          return (
            <div key="flow_posts" className={wrapperClass}>
              {toggleButton}
              {dashedBorder}
              <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-8 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No Flow posts yet. Share content in Flow Mode to showcase here.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/flow")}>Go to Flow</Button>
              </div>
            </div>
          );
        }
        return (
          <motion.div key="flow_posts" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }} className={`space-y-3 ${wrapperClass}`}>
            {toggleButton}
            {dashedBorder}
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Flow Posts
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {flowPosts.map((post: any) => (
                <div key={post.id} onClick={() => navigate("/flow")}
                  className="group rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer">
                  {post.file_url && (post.category === "photo" || post.category === "design" || post.content_type === "image") ? (
                    <div className="aspect-square overflow-hidden bg-muted">
                      <img src={post.file_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  ) : post.file_url && (post.category === "video" || post.content_type === "video") ? (
                    <div className="aspect-square overflow-hidden bg-muted">
                      <video src={post.file_url} className="h-full w-full object-cover" muted preload="metadata" />
                    </div>
                  ) : post.link_url && post.link_url.includes("youtu") ? (
                    <div className="aspect-square overflow-hidden bg-muted relative">
                      <img src={`https://img.youtube.com/vi/${post.link_url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)?.[1]}/mqdefault.jpg`} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center">
                          <Play className="h-4 w-4 text-foreground ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-3">
                      {post.category === "music" ? (
                        <Music className="h-6 w-6 text-muted-foreground/40" />
                      ) : post.category === "writing" ? (
                        <FileText className="h-6 w-6 text-muted-foreground/40" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                      )}
                      <p className="text-xs text-muted-foreground mt-2 text-center line-clamp-2">{post.title}</p>
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-foreground truncate">{post.title}</p>
                    <Badge variant="outline" className="text-[8px] mt-1 capitalize">{post.category}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        );

      case "boards":
        return (
          <motion.div key="boards" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }} className={`space-y-3 ${wrapperClass}`}>
            {toggleButton}
            {dashedBorder}
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Public Boards
            </h2>
            {publicSmartboards && publicSmartboards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {publicSmartboards.map((board: any) => (
                  <div key={board.id} onClick={() => navigate(`/smartboards/${board.id}`)}
                    className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200">
                    <div className="h-14" style={{ backgroundColor: board.cover_color || "hsl(175,60%,55%)" }} />
                    <div className="p-3.5">
                      <h3 className="font-medium text-foreground text-sm truncate">{board.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{board.description || "No description"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-8 text-center">
                <Eye className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isOwnProfile ? "You haven't made any boards public yet" : "No public boards yet"}
                </p>
                {isOwnProfile && <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/smartboards")}>Manage Boards</Button>}
              </div>
            )}
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8 p-4 md:p-8 transition-colors duration-500" style={{ background: profileBg || undefined }}>
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* Hero header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg">
          <div className="h-36 sm:h-44 relative rounded-t-2xl overflow-hidden" style={{ background: bannerGradient }}>
            {bannerImageUrl && <img src={bannerImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            {isOwnProfile && (
              <div className="absolute top-3 right-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCustomizing(!customizing)}
                  className="gap-1.5 bg-card/80 backdrop-blur-sm hover:bg-card/95 shadow-md text-xs">
                  <GripVertical className="h-3.5 w-3.5" /> {customizing ? "Done" : "Customize"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate("/settings")}
                  className="gap-1.5 bg-card/80 backdrop-blur-sm hover:bg-card/95 shadow-md text-xs">
                  <Settings className="h-3.5 w-3.5" /> Edit Profile
                </Button>
              </div>
            )}
          </div>
          <div className="px-5 sm:px-8 pb-6 pt-3">
            <div className="-mt-14 sm:-mt-16 flex gap-4 relative z-10">
              <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-4 border-card bg-muted shadow-xl overflow-hidden shrink-0 ring-2 ring-background/50">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-2xl font-bold text-muted-foreground">{initials}</span>
                )}
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight break-words">
                  {profile.display_name || (profile as any).username || "Creator"}
                </h1>
                {profile.available && (
                  <Badge variant="secondary" className="text-[10px] gap-1 font-medium">
                    <CheckCircle className="h-3 w-3 text-emerald-500" /> Available
                  </Badge>
                )}
                <ProfileBadges userId={id!} compact />
                {reviewStats && reviewStats.count > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1 font-medium">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {reviewStats.avg} ({reviewStats.count})
                  </Badge>
                )}
              </div>
              {(profile as any).username && (
                <p className="text-xs text-muted-foreground mt-0.5">@{(profile as any).username}</p>
              )}
              {(profile as any).headline && <p className="text-sm text-muted-foreground mt-0.5">{(profile as any).headline}</p>}
              {(profile as any).location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" /> {(profile as any).location}</p>}
              {(profile as any).wallet_address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-mono">
                  💳 {(profile as any).wallet_address.slice(0, 4)}...{(profile as any).wallet_address.slice(-4)}
                </p>
              )}
              {!isOwnProfile && user && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button variant={isFollowing ? "outline" : "default"} size="sm" onClick={() => followMutation.mutate()} disabled={followMutation.isPending}>
                    {isFollowing ? <><UserCheck className="mr-1.5 h-4 w-4" /> Following</> : <><UserPlus className="mr-1.5 h-4 w-4" /> Follow</>}
                  </Button>
                  {receivedConnectRequest ? (
                    <Button size="sm" onClick={() => acceptConnectMutation.mutate()} disabled={acceptConnectMutation.isPending}>
                      <UserCheck className="mr-1.5 h-4 w-4" /> Accept
                    </Button>
                  ) : (
                    <Button variant={isConnected ? "outline" : "secondary"} size="sm" onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending || (hasPendingConnect && !receivedConnectRequest)}>
                      {isConnected ? "Connected" : hasPendingConnect ? "Pending…" : "Connect"}
                    </Button>
                  )}
                  {isConnected && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/messages?to=${id}`)}>
                      <MessageSquare className="mr-1.5 h-4 w-4" /> Message
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border/50">
              {[
                { value: followerCount ?? 0, label: "Followers" },
                { value: followingCount ?? 0, label: "Following" },
                { value: publicSmartboards?.length ?? 0, label: "Boards" },
                ...(hasSellerContent ? [{ value: sellerListings?.length ?? 0, label: "Listings" }] : []),
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-bold text-foreground text-lg">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground tracking-wide">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Customize panel */}
        {customizing && isOwnProfile && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl bg-card/80 backdrop-blur-sm border border-primary/30 p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-primary" /> Customize Layout
            </h3>
            <p className="text-xs text-muted-foreground">Drag sections to reorder how your profile appears to visitors.</p>
            <ProfileLayoutReorder
              layout={layout}
              onSave={(newLayout) => saveLayoutMutation.mutate(newLayout)}
              saving={saveLayoutMutation.isPending}
            />
          </motion.div>
        )}

        {/* Sections rendered in layout order */}
        {layout.map((sectionId, i) => renderSection(sectionId, i))}

        {/* On-Chain Reputation */}
        {id && (
          <CreatorReputation userId={id} isOwner={isOwnProfile} />
        )}

        {/* Projects — own profile only, always at bottom */}
        {isOwnProfile && publicProjects && publicProjects.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }} className="space-y-3">
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" /> Projects
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {publicProjects.map((project: any) => (
                <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)}
                  className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200">
                  <div className="h-10" style={{ backgroundColor: project.cover_color || "#7c3aed" }} />
                  <div className="p-3.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground text-sm truncate flex-1">{project.title}</h3>
                      <Badge variant="outline" className="text-[9px] capitalize shrink-0">{project.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{project.description || "No description"}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

    </div>
  );
};

// Sub-component for drag-reorder
const ProfileLayoutReorder = ({
  layout,
  onSave,
  saving,
}: {
  layout: SectionId[];
  onSave: (layout: SectionId[]) => void;
  saving: boolean;
}) => {
  const [items, setItems] = useState<SectionId[]>(layout);

  return (
    <div className="space-y-3">
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
        {items.map((item) => (
          <Reorder.Item key={item} value={item}
            className="flex items-center gap-3 rounded-xl border border-border bg-card/90 p-3 cursor-grab active:cursor-grabbing active:shadow-md transition-shadow">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground">{SECTION_LABELS[item]}</span>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <Button size="sm" onClick={() => onSave(items)} disabled={saving} className="w-full">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save Layout
      </Button>
    </div>
  );
};

export default ProfileDetailPage;
