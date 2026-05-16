import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Globe, CheckCircle, UserPlus, UserCheck, MessageSquare, MapPin, Clock,
  EyeOff, Loader2, Settings, Store, Star, ExternalLink, ShoppingBag,
  Sparkles, Image as ImageIcon, Play, Music, FileText, Award, Shield,
  Zap, Coins, Calendar as CalendarIcon, User as UserIcon, FolderKanban,
  Heart, ArrowRight, Search, Building2, BadgeCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import ProfileBadges from "@/components/profile/ProfileBadges";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import ProfileTierBadge from "@/components/profile/ProfileTierBadge";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import CreatorAvailabilityCalendar from "@/components/profile/CreatorAvailabilityCalendar";
import ProfileCoinTab from "@/components/profile/ProfileCoinTab";
import InvestUnlockSheet from "@/components/profile/InvestUnlockSheet";
import SupportCreatorSheet from "@/components/profile/SupportCreatorSheet";
import CreatorDropsCatalog from "@/components/profile/CreatorDropsCatalog";
import CreatorReadinessCard from "@/components/profile/CreatorReadinessCard";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ROLE_BY_ID } from "@/lib/creator-roles";
import { archetypeBannerGradient } from "@/lib/archetypes";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import NoteBubble from "@/components/notes/NoteBubble";
import { useUserNote } from "@/hooks/useNotes";

import { EmptyState } from "@/components/ui/empty-state";
import PostMenuButton from "@/components/PostMenuButton";
import { Plus } from "lucide-react";


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
  const { data: profileNote } = useUserNote(id);
  

  // v9.5 tabs: Support (default) · Drops (formerly "Works").
  // Legacy ?tab=coin/building/about/overview → support; ?tab=works → drops.
  const rawTab = searchParams.get("tab") || "support";
  const tabFromUrl =
    rawTab === "coin" || rawTab === "building" || rawTab === "about" || rawTab === "overview"
      ? "support"
      : rawTab === "works"
      ? "drops"
      : rawTab;
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [investOpen, setInvestOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(searchParams.get("back") === "1");
  const [reputationOpen, setReputationOpen] = useState(false);

  // Strip `?back=1` from the URL once we've consumed it so refreshes don't
  // re-open the sheet after the user closes it.
  useEffect(() => {
    if (searchParams.get("back") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("back");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    const next = new URLSearchParams(searchParams);
    if (v === "support") next.delete("tab"); else next.set("tab", v);
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
        .eq("user_id", id!).eq("is_active", true).order("created_at", { ascending: false }).limit(12);
      return data ?? [];
    },
    enabled: !!id,
  });

  // All public events this user hosts (past + upcoming) — surfaced in Drops tab.
  const { data: allHostedEvents } = useQuery({
    queryKey: ["profile-all-hosted-events", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, slug, title, cover_url, starts_at, venue_name, is_online, status")
        .eq("host_id", id!)
        .eq("status", "published")
        .order("starts_at", { ascending: false })
        .limit(12);
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
        .select("id, title, file_url, link_url, category, content_type, description, solana_signature, anchored_at, created_at")
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

  // Spaces this creator hosts — surfaced inside profile Support tab so a
  // fan sees every way to back the artist (including booking their space).
  const { data: hostedSpaces } = useQuery({
    queryKey: ["profile-hosted-spaces", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("id, name, cover_image_url, city, state, hourly_rate, currency")
        .eq("owner_id", id!)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
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
  const bannerGradient = p.banner_gradient || archetypeBannerGradient(p.archetype, p.user_id);
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
              <div className="absolute top-3 right-3 flex items-center gap-2">
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
                {profileNote && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-10 z-20">
                    <NoteBubble body={profileNote.body} size="md" />
                  </div>
                )}
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-4 border-card bg-muted shadow-xl overflow-hidden ring-2 ring-background/50">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-2xl font-bold text-muted-foreground">{initials}</span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight break-words leading-none">
                    {p.display_name || p.username || "Creator"}
                  </h1>
                  {p.verification_status === "verified" && (
                    <HoverCard openDelay={120} closeDelay={80}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          aria-label="Verified Artist — identity confirmed by Rhozeland"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent align="start" className="w-64 text-xs">
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          <BadgeCheck className="h-3.5 w-3.5 text-sky-500" /> Verified Artist
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Identity confirmed by Rhozeland. Unlocks paid services,
                          coin launches, and protects fans from impersonation.
                        </p>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                  <ProfileBadges userId={id!} compact />
                </div>
                {p.username && (
                  <p className="text-sm text-muted-foreground leading-none mt-1.5">
                    @{p.username}
                  </p>
                )}
              </div>
            </div>

            {/* Compact meta — pass badge + location + rating only */}
            <div className="mt-4 flex items-center gap-x-3 gap-y-2 flex-wrap">
              <ProfileTierBadge userId={id!} isOwnProfile={isOwnProfile} />
              {p.location && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {p.location}
                </span>
              )}
              {reviewStats && reviewStats.count > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {reviewStats.avg} <span className="opacity-70">({reviewStats.count})</span>
                </span>
              )}
            </div>

            <div className="mt-3 space-y-2.5">

              {/* Bio inline — moved out of About tab so it lives in the header */}
              {profile.bio && (
                <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap pt-1">
                  {profile.bio}
                </p>
              )}

              {/* Compact details row — portfolio + socials, no separate card */}
              {(profile.portfolio_url || p.instagram_url || p.tiktok_url || p.twitter_url || p.youtube_url) && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {profile.portfolio_url && (
                    <a href={profile.portfolio_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <Globe className="h-3.5 w-3.5" /> Portfolio
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                  {(p.instagram_url || p.tiktok_url || p.twitter_url || p.youtube_url) && profile.portfolio_url && (
                    <span className="text-muted-foreground/40">·</span>
                  )}
                  <div className="flex items-center gap-1">
                    {p.instagram_url && (
                      <a href={p.instagram_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="Instagram">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      </a>
                    )}
                    {p.tiktok_url && (
                      <a href={p.tiktok_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="TikTok">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.8a8.23 8.23 0 004.77 1.52V6.85a4.86 4.86 0 01-1-.16z"/></svg>
                      </a>
                    )}
                    {p.twitter_url && (
                      <a href={p.twitter_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="X">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                    )}
                    {p.youtube_url && (
                      <a href={p.youtube_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="YouTube">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons for visitors */}
            {!isOwnProfile && user && (
              <div className="flex flex-col gap-3 mt-4">
                {/* Primary CTA — Invest & Unlock */}
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="lg"
                    onClick={() => setInvestOpen(true)}
                    className="self-start gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 hover:opacity-90 text-primary-foreground shadow-lg"
                  >
                    <Sparkles className="h-4 w-4" />
                    Invest & Unlock
                  </Button>
                  <span className="text-[11px] text-muted-foreground max-w-[280px] leading-snug">
                    Buy a Share to unlock private posts, drops, and behind-the-scenes.
                  </span>
                </div>

                {/* Secondary actions — Follow / Connect / Message */}
                <div className="flex gap-2 flex-wrap">
                  <Button variant={isFollowing ? "outline" : "secondary"} size="sm" onClick={() => followMutation.mutate()} disabled={followMutation.isPending}>
                    {isFollowing ? <><UserCheck className="mr-1.5 h-4 w-4" /> Following</> : <><UserPlus className="mr-1.5 h-4 w-4" /> Follow</>}
                  </Button>
                  {receivedConnectRequest ? (
                    <Button variant="outline" size="sm" onClick={() => acceptConnectMutation.mutate()} disabled={acceptConnectMutation.isPending}>
                      <UserCheck className="mr-1.5 h-4 w-4" /> Accept
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending || (hasPendingConnect && !receivedConnectRequest)}>
                      {isConnected ? "Connected" : hasPendingConnect ? "Pending…" : "Connect"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate(`/messages?to=${id}`)}>
                    <MessageSquare className="mr-1.5 h-4 w-4" /> Message
                  </Button>
                </div>
              </div>
            )}
{/* buddy-removed */}
          </div>
        </motion.div>

        {/* ─── Tabbed sections ─── */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-auto bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-1">
            <TabsTrigger value="support" className="text-xs gap-1.5"><Heart className="h-3 w-3" />Support</TabsTrigger>
            <TabsTrigger value="drops" className="text-xs gap-1.5"><ImageIcon className="h-3 w-3" />Posts</TabsTrigger>
          </TabsList>

          {/* ─── Support tab — back this artist (actions + token) ─── */}
          <TabsContent value="support" className="mt-5 space-y-4">
            {/* Primary CTA — opens the umbrella Support sheet with all backing paths */}
            {!isOwnProfile && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="rounded-2xl bg-gradient-to-br from-primary/10 via-card/80 to-accent/5 border border-border/60 p-5 sm:p-6 backdrop-blur-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                      <Heart className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-semibold text-foreground truncate">
                        Back {p.display_name || p.username || "this artist"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Shares, shows, sessions, or a tip — all in one place.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => user ? setSupportOpen(true) : navigate("/auth")}
                    size="lg"
                    className="gap-1.5 shrink-0 w-full sm:w-auto"
                  >
                    <Sparkles className="h-4 w-4" />
                    Back them
                  </Button>
                </div>
                <Link
                  to="/credits?tab=how"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  How this works <ArrowRight className="h-3 w-3" />
                </Link>
              </motion.div>
            )}

            {/* ─── Ways to support — launches + listings + events + spaces (+ inline Verify) ─── */}
            {(() => {
              const events    = allHostedEvents ?? [];
              const spaces    = hostedSpaces ?? [];
              const listings  = sellerListings ?? [];

              const tabs: { value: string; label: string; icon: any; count: number | null }[] = [
                { value: "launches", label: "Launches", icon: Coins, count: null },
              ];
              if (listings.length) tabs.push({ value: "listings", label: "Listings", icon: ShoppingBag, count: listings.length });
              if (events.length)   tabs.push({ value: "events",   label: "Events",   icon: CalendarIcon, count: events.length });
              if (spaces.length)   tabs.push({ value: "spaces",   label: "Spaces",   icon: Building2,    count: spaces.length });

              const totalCount = listings.length + events.length + spaces.length;

              return (
                <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5 space-y-4">
                  {/* ─── Verify this creator — collapsible header, sits ABOVE the tabs ─── */}
                  <Collapsible open={reputationOpen} onOpenChange={setReputationOpen}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Award className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">Verify this creator</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              On-chain reputation, investor signal & proof of work.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {totalProofs > 0 && (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {anchoredCount}/{totalProofs}
                            </Badge>
                          )}
                          <ArrowRight className={cn("h-4 w-4 text-muted-foreground transition-transform", reputationOpen && "rotate-90")} />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-4">
                      {isOwnProfile && totalProofs > 0 && anchoredCount < totalProofs && (
                        <div className="flex justify-end">
                          <AnchorButton proofs={proofs!} />
                        </div>
                      )}
                      <CreatorReadinessCard creatorId={id!} memberSince={p.created_at} />
                      {totalProofs > 0 && (
                        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
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
                                <Link key={type} to={meta.href} className="rounded-lg border border-border bg-card/50 p-3 text-center transition-colors hover:bg-muted/60">
                                  {inner}
                                </Link>
                              ) : (
                                <div key={type} className="rounded-lg border border-border bg-card/50 p-3 text-center">
                                  {inner}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  {totalCount > 0 && (
                    <div className="flex justify-end -mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{totalCount} total</span>
                    </div>
                  )}

                  <Tabs defaultValue="launches">
                    <TabsList className="w-full justify-start overflow-x-auto bg-muted/40 p-1 h-auto">
                      {tabs.map(({ value, label, icon: Icon, count }) => (
                        <TabsTrigger key={value} value={value} className="text-xs gap-1.5 data-[state=active]:bg-background">
                          <Icon className="h-3 w-3" />
                          {label}
                          {count !== null && <span className="text-[9px] text-muted-foreground">{count}</span>}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <TabsContent value="launches" className="mt-3">
                      <CreatorDropsCatalog creatorId={id!} isOwnProfile={isOwnProfile} />
                    </TabsContent>

                    {listings.length > 0 && (
                      <TabsContent value="listings" className="mt-3 space-y-2">
                        {listings.map((l: any) => {
                          const priceLabel = l.credits_price
                            ? `${l.credits_price} $RHOZE`
                            : l.price
                            ? `${l.currency || "$"}${l.price}`
                            : null;
                          const typeLabel = l.listing_type === "project_request" ? "Open call" : "Offering";
                          return (
                            <button
                              key={l.id}
                              onClick={() => navigate(`/marketplace/${l.id}`)}
                              className="group w-full text-left flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3 hover:border-foreground/30 transition-colors"
                            >
                              <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {typeLabel}
                                  {priceLabel ? ` · ${priceLabel}` : ""}
                                </p>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          );
                        })}
                      </TabsContent>
                    )}

                    {events.length > 0 && (
                      <TabsContent value="events" className="mt-3 space-y-2">
                        {events.map((e: any) => {
                          const isPast = new Date(e.starts_at) < new Date();
                          return (
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
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                                  {isPast && <Badge variant="outline" className="text-[8px] shrink-0">Past</Badge>}
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {format(new Date(e.starts_at), "MMM d · h:mm a")}
                                  {e.is_online ? " · Online" : e.venue_name ? ` · ${e.venue_name}` : ""}
                                </p>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          );
                        })}
                      </TabsContent>
                    )}

                    {spaces.length > 0 && (
                      <TabsContent value="spaces" className="mt-3 space-y-2">
                        {spaces.map((s: any) => (
                          <button
                            key={s.id}
                            onClick={() => navigate(`/studios/${s.id}`)}
                            className="group w-full text-left flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3 hover:border-foreground/30 transition-colors"
                          >
                            {s.cover_image_url ? (
                              <img src={s.cover_image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center shrink-0">
                                <Building2 className="h-5 w-5 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {[s.city, s.state].filter(Boolean).join(" · ") || "Space"}
                                {s.hourly_rate ? ` · ${s.currency || "$"}${s.hourly_rate}/hr` : ""}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        ))}
                      </TabsContent>
                    )}
                  </Tabs>


                </div>
              );
            })()}
          </TabsContent>

          {/* ─── Posts tab — TikTok/Instagram-style grid of everything they've shared on Flow.
              No titles, no labels — just the work. A small category glyph in the corner
              hints at the medium (music / video / image / link / writing). */}
          <TabsContent value="drops" className="mt-5 space-y-3">
            <div>
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Posts
              </h2>
            </div>
            {flowPosts && flowPosts.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1 sm:gap-1.5">
                {flowPosts.map((post: any) => {
                  const cat = (post.category || "").toLowerCase();
                  const CatIcon =
                    cat.includes("music") || cat.includes("audio") ? Music
                    : cat.includes("video") ? Play
                    : cat.includes("write") || cat.includes("text") ? FileText
                    : cat.includes("link") ? ExternalLink
                    : ImageIcon;
                  return (
                    <button
                      key={post.id}
                      onClick={() => navigate(`/flow?item=${post.id}`, { state: { from: location.pathname + location.search + location.hash } })}
                      className="group relative aspect-square overflow-hidden bg-muted rounded-md hover:opacity-90 transition-opacity"
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
                      {/* Tiny medium glyph — top-left */}
                      <div className="absolute top-1.5 left-1.5 h-6 w-6 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
                        <CatIcon className="h-3 w-3 text-white" />
                      </div>
                      {post.solana_signature && (
                        <div className="absolute top-1.5 right-1.5">
                          <VerifiedIPBadge
                            signature={post.solana_signature}
                            size="xs"
                            showLabel={false}
                            className="shadow-sm"
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : isOwnProfile ? (
              <EmptyState
                icon={Sparkles}
                title="No posts yet"
                description="Use the post button on Discover to drop a work — it'll show up here."
                cta={{ label: "Open post", to: "/discover?post=1", prominent: true }}
                size="sm"
              />
            ) : (
              <p className="text-xs text-muted-foreground italic">No posts yet.</p>
            )}
          </TabsContent>
          {/* Building tab removed in v9 — projects live in the owner's private dashboard. */}

        </Tabs>

        {/* Invest & Unlock — Shares purchase sheet (Section 2: The Heart) */}
        {!isOwnProfile && id && (
          <InvestUnlockSheet
            open={investOpen}
            onOpenChange={setInvestOpen}
            artistId={id}
            artistName={p.display_name || p.username || null}
          />
        )}

        {/* Umbrella "Back this creator" sheet — funnels into Shares / Show up / Work / DM */}
        {!isOwnProfile && id && (
          <SupportCreatorSheet
            open={supportOpen}
            onOpenChange={setSupportOpen}
            artistName={p.display_name || p.username || "this artist"}
            hasShares={true}
            hasHappenings={(upcomingEvents?.length ?? 0) + (hostedSpaces?.length ?? 0) > 0}
            hasOfferings={(sellerListings ?? []).some((l: any) => l.listing_type !== "project_request")}
            isAvailableForBooking={!!profile?.available}
            onBackCareer={() => setInvestOpen(true)}
            onShowUp={() => {
              const first = upcomingEvents?.[0];
              if (first) navigate(`/events/${first.slug || first.id}`);
              else if (hostedSpaces?.[0]) navigate(`/studios/${hostedSpaces[0].id}`);
            }}
            onWorkWithThem={() => setBookingOpen(true)}
            onSendMessage={() => navigate(`/messages?to=${id}`)}
          />
        )}

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
