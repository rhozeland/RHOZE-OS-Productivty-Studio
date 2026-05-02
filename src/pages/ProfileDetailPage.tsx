import { useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Globe, CheckCircle, UserPlus, UserCheck, MessageSquare, MapPin, Clock,
  EyeOff, Loader2, Settings, Store, Star, ExternalLink, ShoppingBag,
  Sparkles, Image as ImageIcon, Play, Music, FileText, Award, Shield,
  Zap, Coins, Calendar as CalendarIcon, User as UserIcon, FolderKanban,
  Heart, ArrowRight, Search,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import ProfileBadges from "@/components/profile/ProfileBadges";
import CreatorAvailabilityCalendar from "@/components/profile/CreatorAvailabilityCalendar";
import ProfileCoinTab from "@/components/profile/ProfileCoinTab";
import { cn } from "@/lib/utils";
import { ROLE_BY_ID } from "@/lib/creator-roles";
import FlowThumbnail from "@/components/flow/FlowThumbnail";

// Human-readable labels + destinations for on-chain reputation tiles.
// Tiles are clickable when href is set; otherwise rendered as static cards.
const PROOF_TYPE_META: Record<string, { label: string; href: string | null }> = {
  reward:           { label: "Rewards earned",   href: "/rewards" },
  work_register:    { label: "Works registered", href: "/works" },
  event_attendance: { label: "Events attended",  href: "/spaces?tab=events" },
  event_manifest:   { label: "Events hosted",    href: "/spaces?tab=events" },
  milestone:        { label: "Milestones",       href: null },
  flow_post:        { label: "Flow posts",       href: "/discover" },
  review:           { label: "Reviews",          href: null },
};

const ProfileDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const isOwnProfile = user?.id === id;

  // Tabs: Overview · Coin · Works · Listings · Availability.
  // ?tab=coin etc. deep-links from Flow speculate pills + Hub coins strip.
  const tabFromUrl = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [bookingOpen, setBookingOpen] = useState(false);
  const handleTabChange = (v: string) => {
    setActiveTab(v);
    const next = new URLSearchParams(searchParams);
    if (v === "overview") next.delete("tab"); else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

  // ─── Data fetching ───
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      if (isOwnProfile) {
        const { data, error } = await supabase.from("profiles").select("*").eq("user_id", id!).single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.rpc("get_public_profile", { _user_id: id! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!id,
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

  const { data: flowPosts } = useQuery({
    queryKey: ["profile-flow-posts", id],
    queryFn: async () => {
      const { data } = await supabase.from("flow_items")
        .select("id, title, file_url, link_url, category, content_type, description, created_at")
        .eq("user_id", id!).order("created_at", { ascending: false }).limit(12);
      return data ?? [];
    },
    enabled: !!id,
  });

  // "Building" — projects this user owns. RLS limits visibility to team
  // members; for non-members the array is just empty (graceful).
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

  // ─── Support tab data ───
  const { data: profileCoin } = useQuery({
    queryKey: ["profile-coin-ticker", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("coin_launches")
        .select("id, ticker, name, image_url, status")
        .eq("creator_id", id!)
        .neq("status", "cancelled")
        .order("work_id", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: upcomingEvents } = useQuery({
    queryKey: ["profile-upcoming-events", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, slug, title, cover_url, starts_at, venue_name, is_online")
        .eq("host_id", id!)
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3);
      return data ?? [];
    },
    enabled: !!id,
  });
  const { data: proofs } = useQuery({
    queryKey: ["contribution-proofs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contribution_proofs")
        .select("*").eq("user_id", id!).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Creator pass tier
  const { data: userCredits } = useQuery({
    queryKey: ["user-credits-tier", id],
    queryFn: async () => {
      const { data } = await supabase.from("user_credits")
        .select("tier, balance").eq("user_id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  // ─── Connection logic ───
  const isFollowing = connectionStatus?.some((c: any) => c.follower_id === user?.id && c.following_id === id && c.type === "follow" && c.status === "active");
  const connectRequest = connectionStatus?.find((c: any) => c.type === "connect");
  const isConnected = connectRequest?.status === "active";
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

  // ─── Loading / guards ───
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

  // ─── Derived data ───
  const p = profile as any;
  const initials = (p.display_name || p.username || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const profileBg = p.profile_background;
  const bannerGradient = p.banner_gradient || "linear-gradient(135deg, hsl(220,15%,40%), hsl(220,10%,55%), hsl(175,30%,65%))";
  const bannerImageUrl = p.banner_url;
  const hasSellerContent = (sellerListings?.length ?? 0) > 0;

  const anchoredCount = proofs?.filter((pr) => pr.solana_signature).length ?? 0;
  const totalProofs = proofs?.length ?? 0;

  const tierConfig: Record<string, { label: string; color: string; bg: string }> = {
    spark: { label: "Spark", color: "text-muted-foreground", bg: "bg-muted" },
    bloom: { label: "Bloom", color: "text-emerald-600", bg: "bg-emerald-500/15" },
    glow: { label: "Glow", color: "text-amber-500", bg: "bg-amber-500/15" },
    play: { label: "Play", color: "text-violet-500", bg: "bg-violet-500/15" },
  };
  const tier = tierConfig[(userCredits as any)?.tier || "spark"] || tierConfig.spark;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8 p-4 md:p-8 transition-colors duration-500" style={{ background: profileBg || undefined }}>
      <div className="space-y-5 max-w-4xl mx-auto">

        {/* ─── Hero Header ─── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg overflow-hidden">
          {/* Banner */}
          <div className="h-36 sm:h-44 relative" style={{ background: bannerGradient }}>
            {bannerImageUrl && <img src={bannerImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            {isOwnProfile && (
              <div className="absolute top-3 right-3">
                <Button variant="secondary" size="sm" onClick={() => navigate("/settings")}
                  className="gap-1.5 bg-card/80 backdrop-blur-sm hover:bg-card/95 shadow-md text-xs">
                  <Settings className="h-3.5 w-3.5" /> Edit Profile
                </Button>
              </div>
            )}
          </div>

          <div className="px-5 sm:px-8 pb-5 pt-3">
            {/* Avatar + Name row — handle sits tight beside name */}
            <div className="flex items-end gap-4 sm:gap-5">
              <div className="-mt-14 sm:-mt-16 relative z-10 shrink-0">
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-4 border-card bg-muted shadow-xl overflow-hidden ring-2 ring-background/50">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-2xl font-bold text-muted-foreground">{initials}</span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight break-words leading-none">
                    {p.display_name || p.username || "Creator"}
                  </h1>
                  {p.username && (
                    <span className="text-sm text-muted-foreground leading-none">@{p.username}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <ProfileBadges userId={id!} compact />
                  {reviewStats && reviewStats.count > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 font-medium">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {reviewStats.avg} ({reviewStats.count})
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Roles + meta — compact, no emojis, no italics */}
            <div className="mt-4 space-y-2.5">
              {Array.isArray(p.creator_roles) && p.creator_roles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.creator_roles.map((rid: string) => {
                    const role = ROLE_BY_ID.get(rid);
                    return (
                      <span
                        key={rid}
                        className="rounded-full bg-foreground/5 border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80"
                      >
                        {role?.label ?? rid}
                      </span>
                    );
                  })}
                </div>
              )}
              {p.headline && (
                <p className="text-sm text-foreground/80 leading-snug">{p.headline}</p>
              )}

              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground">
                {p.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.location}</span>
                )}
                {totalProofs > 0 && (
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-primary" />
                    {anchoredCount > 0 ? `${anchoredCount} verified earnings` : `${totalProofs} earnings`}
                  </span>
                )}
                {hasSellerContent && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> {sellerListings?.length ?? 0} listings
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons for visitors */}
            {!isOwnProfile && user && (
              <div className="flex gap-2 mt-4 flex-wrap">
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
        </motion.div>

        {/* ─── Tabbed sections ─── */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full grid grid-cols-5 h-auto bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-1">
            <TabsTrigger value="overview" className="text-xs gap-1.5"><UserIcon className="h-3 w-3" />Overview</TabsTrigger>
            <TabsTrigger value="support" className="text-xs gap-1.5"><Heart className="h-3 w-3" />Support</TabsTrigger>
            <TabsTrigger value="coin" className="text-xs gap-1.5"><Coins className="h-3 w-3" />Coin</TabsTrigger>
            <TabsTrigger value="works" className="text-xs gap-1.5"><Sparkles className="h-3 w-3" />Works</TabsTrigger>
            <TabsTrigger value="building" className="text-xs gap-1.5"><FolderKanban className="h-3 w-3" />Building</TabsTrigger>
          </TabsList>

          {/* ─── Overview tab ─── */}
          <TabsContent value="overview" className="space-y-5 mt-5">
        {/* ─── About + Details ─── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
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
            {p.mediums && p.mediums.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Mediums</h3>
                <div className="flex flex-wrap gap-1.5">
                  {p.mediums.map((medium: string) => <Badge key={medium} variant="outline" className="text-xs">{medium}</Badge>)}
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
            {(p.instagram_url || p.tiktok_url || p.twitter_url || p.youtube_url) && (
              <div className="pt-2 border-t border-border/50">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Socials</h3>
                <div className="flex items-center gap-2">
                  {p.instagram_url && (
                    <a href={p.instagram_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="Instagram">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    </a>
                  )}
                  {p.tiktok_url && (
                    <a href={p.tiktok_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="TikTok">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.8a8.23 8.23 0 004.77 1.52V6.85a4.86 4.86 0 01-1-.16z"/></svg>
                    </a>
                  )}
                  {p.twitter_url && (
                    <a href={p.twitter_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="X">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                  )}
                  {p.youtube_url && (
                    <a href={p.youtube_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="YouTube">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── On-Chain Reputation (compact) ─── */}
        {totalProofs > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}
            className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <h2 className="font-display text-base font-semibold text-foreground">On-Chain Reputation</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {anchoredCount}/{totalProofs} verified
                </Badge>
                {isOwnProfile && anchoredCount < totalProofs && (
                  <AnchorButton proofs={proofs!} />
                )}
              </div>
            </div>
            {/* Summary stats — clickable, with human-readable labels */}
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(
                proofs!.reduce<Record<string, number>>((acc, pr) => {
                  acc[pr.action_type] = (acc[pr.action_type] || 0) + 1;
                  return acc;
                }, {})
              ).sort(([, a], [, b]) => b - a).slice(0, 3).map(([type, count]) => {
                const meta = PROOF_TYPE_META[type] ?? {
                  label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                  href: null as string | null,
                };
                const inner = (
                  <>
                    <p className="text-2xl font-bold text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground">{meta.label}</p>
                  </>
                );
                return meta.href ? (
                  <Link
                    key={type}
                    to={meta.href}
                    className="rounded-lg border border-border bg-muted/30 p-3 text-center transition-colors hover:bg-muted/60 hover:border-border/80"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={type} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    {inner}
                  </div>
                );
              })}
            </div>
            {anchoredCount > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Independently verifiable on the public ledger
              </p>
            )}
          </motion.div>
        )}

        {/* Ratings inside Overview */}
        {reviewStats && reviewStats.count > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5">
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-amber-400" /> Ratings
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-foreground">{reviewStats.avg}</p>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={cn("h-4 w-4", s <= Math.round(reviewStats.avg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{reviewStats.count} rating{reviewStats.count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </motion.div>
        )}
          </TabsContent>

          {/* ─── Support tab — single answer to "how do I help this artist?" ─── */}
          <TabsContent value="support" className="mt-5 space-y-4">
            {/* Top intro */}
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-card/80 to-accent/10 backdrop-blur-sm border border-border/50 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="h-4 w-4 text-primary" />
                <h2 className="font-display text-base font-semibold text-foreground">
                  Ways to back {p.display_name || p.username || "this artist"}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Pick whatever fits — every action helps. Curious about the
                token layer?{" "}
                <Link
                  to="/rewards"
                  className="underline-offset-2 hover:underline text-foreground/80"
                >
                  How rewards work →
                </Link>
              </p>
            </div>

            {/* Action grid — Book a session is full-width when present */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Book / availability — full width, opens calendar in modal */}
              {profile.available && (
                <button
                  onClick={() => user ? setBookingOpen(true) : navigate("/auth")}
                  className="sm:col-span-2 group text-left rounded-2xl bg-gradient-to-br from-primary/5 via-card/80 to-accent/5 backdrop-blur-sm border border-border/60 p-5 hover:border-foreground/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <CalendarIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Book a session</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Open to work — pick a time, drop a meeting link, get on a call.
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                </button>
              )}
              {/* Follow */}
              {!isOwnProfile && (
                <button
                  onClick={() => user ? followMutation.mutate() : navigate("/auth")}
                  disabled={followMutation.isPending}
                  className="group text-left rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4 hover:border-foreground/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {isFollowing ? <UserCheck className="h-4 w-4 text-primary" /> : <UserPlus className="h-4 w-4 text-primary" />}
                        <p className="text-sm font-semibold text-foreground">{isFollowing ? "Following" : "Follow"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Show up in their early-supporter list. Free.</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              )}

              {/* Message */}
              {!isOwnProfile && (
                <button
                  onClick={() => user ? navigate(`/messages?to=${id}`) : navigate("/auth")}
                  className="group text-left rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4 hover:border-foreground/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-foreground">Send a message</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Hire, collab, or just say what their work means to you.</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              )}

              {/* Coin */}
              {profileCoin && (
                <button
                  onClick={() => handleTabChange("coin")}
                  className="group text-left rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-4 hover:border-foreground/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-foreground">Hold ${profileCoin.ticker}</p>
                        {profileCoin.status === "graduated" && (
                          <Badge variant="secondary" className="text-[9px]">Graduated</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        Skin in the game. Trade their bonding-curve coin and ride the upside.
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                </button>
              )}

              {/* Book / availability — original slot now removed; Book card lives at top of grid */}
            </div>

            {/* Listings inline — what they're offering OR looking for */}
            {hasSellerContent && (
              <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5">
                <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <ShoppingBag className="h-4 w-4 text-primary" /> Offerings & requests
                </h3>
                <div className="space-y-2">
                  {sellerListings!.slice(0, 5).map((listing: any) => {
                    const isRequest = listing.listing_type === "project_request";
                    return (
                      <button
                        key={listing.id}
                        onClick={() => navigate(`/creators/${listing.id}`)}
                        className="group w-full text-left flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3 hover:border-foreground/30 transition-colors"
                      >
                        <div
                          className={cn(
                            "h-11 w-11 rounded-lg flex items-center justify-center shrink-0 border",
                            isRequest
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {isRequest ? <Search className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] uppercase tracking-wide font-semibold",
                                isRequest
                                  ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                                  : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {isRequest ? "Looking for" : "Offering"}
                            </Badge>
                            {listing.category && (
                              <Badge variant="outline" className="text-[9px] capitalize">
                                {listing.category}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{listing.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {listing.credits_price && (
                              <span className="text-[10px] font-semibold text-primary">
                                {listing.credits_price} $RHOZE
                              </span>
                            )}
                            {listing.price && (
                              <span className="text-[10px] text-muted-foreground">${listing.price}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming events */}
            {upcomingEvents && upcomingEvents.length > 0 && (
              <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5">
                <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Show up
                </h3>
                <div className="space-y-2">
                  {upcomingEvents.map((e: any) => (
                    <button
                      key={e.id}
                      onClick={() => navigate(`/events/${e.slug || e.id}`)}
                      className="group w-full text-left flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3 hover:border-foreground/30 transition-colors"
                    >
                      {e.cover_url ? (
                        <img src={e.cover_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center shrink-0">
                          <CalendarIcon className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(e.starts_at), "MMM d · h:mm a")}
                          {e.is_online ? " · Online" : e.venue_name ? ` · ${e.venue_name}` : ""}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Off-platform support */}
            {(p.portfolio_url || p.instagram_url || p.tiktok_url || p.twitter_url || p.youtube_url) && (
              <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5">
                <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-primary" /> Find them off-platform
                </h3>
                <div className="flex flex-wrap gap-2">
                  {p.portfolio_url && (
                    <a href={p.portfolio_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card/60 hover:border-foreground/30 transition-colors">
                      <Globe className="h-3 w-3" /> Portfolio <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  )}
                  {p.instagram_url && (
                    <a href={p.instagram_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card/60 hover:border-foreground/30 transition-colors">
                      Instagram <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  )}
                  {p.tiktok_url && (
                    <a href={p.tiktok_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card/60 hover:border-foreground/30 transition-colors">
                      TikTok <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  )}
                  {p.twitter_url && (
                    <a href={p.twitter_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card/60 hover:border-foreground/30 transition-colors">
                      X <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  )}
                  {p.youtube_url && (
                    <a href={p.youtube_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card/60 hover:border-foreground/30 transition-colors">
                      YouTube <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Empty fallback if nothing surfaces */}
            {isOwnProfile && !hasSellerContent && !profileCoin && !upcomingEvents?.length && (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
                Add an offering, launch your coin, or post an event so people have something to back.
              </div>
            )}
          </TabsContent>

          {/* ─── Coin tab ─── */}
          <TabsContent value="coin" className="mt-5">
            <ProfileCoinTab
              creatorId={id!}
              isOwnProfile={isOwnProfile}
              defaultName={p.display_name || p.username}
              defaultImage={p.avatar_url}
              memberSince={p.created_at}
            />
          </TabsContent>

          {/* ─── Works (Posts) tab ─── */}
          {/* Anything they've shared on Flow — uploads, links (YouTube/Spotify/SoundCloud),
              writing. Thumbnails are resolved by <FlowThumbnail/> so audio/link posts
              get a proper preview image instead of a generic icon. */}
          <TabsContent value="works" className="mt-5">
            {flowPosts && flowPosts.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Posts
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Everything they've shared on Flow — uploads, tracks, videos and links.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {flowPosts.map((post: any) => (
                    <div key={post.id} onClick={() => navigate("/flow")}
                      className="group rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer">
                      <div className="aspect-square overflow-hidden bg-muted">
                        <FlowThumbnail
                          fileUrl={post.file_url}
                          linkUrl={post.link_url}
                          title={post.title}
                          description={post.description}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-foreground truncate">{post.title}</p>
                        <Badge variant="outline" className="text-[8px] mt-1 capitalize">{post.category}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-8 text-center text-sm text-muted-foreground">
                No works posted yet.
              </div>
            )}
          </TabsContent>

          {/* ─── Building (Projects) tab ─── */}
          <TabsContent value="building" className="mt-5">
            {buildingProjects && buildingProjects.length > 0 ? (
              <div className="space-y-3">
                <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" /> Currently Building
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {buildingProjects.map((proj: any) => (
                    <div
                      key={proj.id}
                      onClick={() => navigate(`/projects/${proj.id}`)}
                      className="group rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
                    >
                      <div
                        className="h-20 w-full"
                        style={{ background: `linear-gradient(135deg, ${proj.cover_color || "#7c3aed"}, hsl(var(--accent)))` }}
                      />
                      <div className="p-4 space-y-2">
                        <p className="text-sm font-semibold text-foreground truncate">{proj.title}</p>
                        {proj.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{proj.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[9px] capitalize">{proj.status}</Badge>
                          {(proj.categories ?? []).slice(0, 2).map((c: string) => (
                            <Badge key={c} variant="secondary" className="text-[9px]">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-8 text-center text-sm text-muted-foreground">
                {isOwnProfile
                  ? "No active projects yet. Start one from the Projects page."
                  : "Nothing public to share here yet."}
              </div>
            )}
          </TabsContent>

        </Tabs>

        {/* Booking modal — opened from the "Book a session" support card */}
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

/* ─── Anchor button sub-component ─── */
const AnchorButton = ({ proofs }: { proofs: any[] }) => {
  const [anchoring, setAnchoring] = useState(false);
  const unanchored = proofs.filter((p) => !p.solana_signature);

  const handleAnchor = async () => {
    setAnchoring(true);
    let success = 0;
    for (const proof of unanchored.slice(0, 5)) {
      try {
        const { error } = await supabase.functions.invoke("anchor-contribution", { body: { proof_id: proof.id } });
        if (!error) success++;
      } catch { /* continue */ }
    }
    toast.success(`Verified ${success} earnings!`);
    setAnchoring(false);
    window.location.reload();
  };

  return (
    <Button size="sm" variant="outline" onClick={handleAnchor} disabled={anchoring} className="gap-1.5 text-xs">
      {anchoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
      Verify ({Math.min(unanchored.length, 5)})
    </Button>
  );
};

export default ProfileDetailPage;
