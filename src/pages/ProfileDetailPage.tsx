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
  Heart, ArrowRight, Search, Building2, BadgeCheck, ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import ProfileBadges from "@/components/profile/ProfileBadges";
import VerifiedProBadge from "@/components/profile/VerifiedProBadge";
import ProfileTierBadge from "@/components/profile/ProfileTierBadge";
import ArchetypeChip from "@/components/profile/ArchetypeChip";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import CreatorAvailabilityCalendar from "@/components/profile/CreatorAvailabilityCalendar";
import SupportSheet from "@/components/profile/SupportSheet";
import StartCoinCta from "@/components/profile/StartCoinCta";
import TokenDiscoveryChip from "@/components/profile/TokenDiscoveryChip";
import CreatorActivityCard from "@/components/profile/CreatorActivityCard";
import ProfileCatalogCard from "@/components/profile/ProfileCatalogCard";
import InvestorSignalStrip from "@/components/profile/InvestorSignalStrip";
import CreatorActivityTicker from "@/components/profile/CreatorActivityTicker";
import CreatorCoinsGallery from "@/components/profile/coins/CreatorCoinsGallery";
import { getRegion } from "@/lib/regions";
import { BoostProfileSheet } from "@/components/profile/BoostProfileSheet";
import SaveButton from "@/components/saved/SaveButton";
import { cn } from "@/lib/utils";
import { archetypeBannerGradient } from "@/lib/archetypes";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import FlowPostOwnerMenu from "@/components/profile/FlowPostOwnerMenu";
import NoteBubble from "@/components/notes/NoteBubble";
import { useUserNote } from "@/hooks/useNotes";

import { EmptyState } from "@/components/ui/empty-state";
import { Plus } from "lucide-react";
import ShareCardModal from "@/components/share/ShareCardModal";



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
  

  const [bookingOpen, setBookingOpen] = useState(false);
  const [reputationOpen, setReputationOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  // v10: `?back=1` legacy deeplinks redirect to the Subscribe sheet.
  const [subscribeOpen, setSubscribeOpen] = useState(
    searchParams.get("subscribe") === "1" || searchParams.get("back") === "1",
  );

  // Strip legacy `?back=1` / `?subscribe=1` from the URL once consumed.
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
  // NOTE: retry kept low so a missing/private profile or a transient RLS
  // error surfaces the "not found" UI in ~2 seconds instead of stalling on a
  // spinner for up to a minute (React Query's default 3-retry, exponential
  // backoff). `maybeSingle` makes a 0-row result resolve to `null` instead
  // of throwing PGRST116 / 406, which would otherwise trigger retries.
  const { data: profile, isLoading, error: profileError } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      // Always go through get_public_profile — column-level grants on the
      // profiles table block direct `select *` (even for own row) since the
      // PII lockdown migration. Private fields (shipping/wallet/etc.) are
      // fetched separately via get_my_private_profile_fields.
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
        .select("id, title, file_url, link_url, category, content_type, description, solana_signature, anchored_at, archived_at, created_at")
        .eq("user_id", id!).order("created_at", { ascending: false }).limit(24);
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
      <div className="space-y-5 max-w-6xl mx-auto">

        {/* ─── Hero Header ─── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg overflow-hidden">
          {/* Banner */}
          <div className="h-36 sm:h-44 relative" style={{ background: bannerGradient }}>
            {bannerImageUrl && <img src={bannerImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            {isOwnProfile ? (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setBoostOpen(true)}
                  className="gap-1.5 bg-gradient-to-r from-amber-500 to-fuchsia-500 text-white hover:opacity-90 shadow-md text-xs border-0">
                  <Sparkles className="h-3.5 w-3.5" /> Boost
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate("/settings")}
                  className="gap-1.5 bg-card/80 backdrop-blur-sm hover:bg-card/95 shadow-md text-xs">
                  <Settings className="h-3.5 w-3.5" /> Edit Profile
                </Button>
              </div>
            ) : user ? (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  className="gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 hover:opacity-90 text-primary-foreground shadow-md text-xs"
                >
                  {isFollowing ? <><UserCheck className="h-3.5 w-3.5" /> Following</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/messages?to=${id}`)}
                  className="gap-1.5 bg-card/80 backdrop-blur-sm hover:bg-card/95 shadow-md text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Message
                </Button>
              </div>
            ) : null}
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
                  {p.verified_pro_at && <VerifiedProBadge size="md" />}
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

              {/* Structural metadata — single combined location chip + archetype.
                  Creator-role labels and skill hashtags retired (v10.4) — they
                  cluttered the header without adding signal. */}
              {(() => {
                const region = getRegion(p.region_code);
                const cityPart = (p.location || "").trim();
                const locationLabel = cityPart && region
                  ? `${cityPart}, ${region.code}`
                  : cityPart || region?.label || null;
                if (!locationLabel && !p.archetype) return null;
                return (
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    {locationLabel && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 rounded-full px-2.5 py-0.5">
                        {region ? (
                          <span aria-hidden>{region.flag}</span>
                        ) : (
                          <MapPin className="h-2.5 w-2.5" />
                        )}
                        {locationLabel}
                      </span>
                    )}
                    {p.archetype && <ArchetypeChip archetype={p.archetype} size="xs" />}
                  </div>
                );
              })()}
            </div>
          </div>

            {/* Compact meta — pass badge + location + rating only */}
            <div className="mt-4 flex items-center gap-x-3 gap-y-2 flex-wrap">
              <ProfileTierBadge userId={id!} isOwnProfile={isOwnProfile} />
              {reviewStats && reviewStats.count > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {reviewStats.avg} <span className="opacity-70">({reviewStats.count})</span>
                </span>
              )}
              {!isOwnProfile && id && (
                <SaveButton type="creator" id={id} variant="chip" />
              )}
              {/* v11 Tier 2 — promote token discovery above the fold.
                  Returns null if creator hasn't linked a pump.fun token. */}
              {id && <TokenDiscoveryChip creatorId={id} />}
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
                {/* Primary CTA — Subscribe (v10) */}
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="lg"
                    onClick={() => user ? setSubscribeOpen(true) : navigate("/auth")}
                    className="self-start gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 hover:opacity-90 text-primary-foreground shadow-lg"
                  >
                    <Heart className="h-4 w-4" />
                    Support {p.display_name || p.username || "creator"}
                  </Button>
                  <span className="text-[11px] text-muted-foreground max-w-[280px] leading-snug">
                    Subscribe, tip, or trade their token — all in one place.
                    <br />
                    All payments settle instantly.
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
                  <Button variant="outline" size="sm" onClick={() => setShareCardOpen(true)}>
                    Share your card
                  </Button>
                </div>
              </div>
            )}
{/* buddy-removed */}
          </div>
        </motion.div>


        {/* ─── Investor signal + activity ticker — header-anchored, condensed ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <InvestorSignalStrip
              creatorId={p.user_id}
              memberSince={p.created_at}
              isOwnProfile={isOwnProfile}
            />
          </div>
          {p?.id && p?.user_id && (
            <CreatorActivityTicker
              creatorProfileId={p.id}
              creatorUserId={p.user_id}
              creatorName={p.display_name || p.username || "this creator"}
              tokenTicker={(p as any).token_ticker}
            />
          )}
        </div>

        {/* ─── Tabs: Overview · Works · Verified · Projects ─── */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-card/60 backdrop-blur-sm border border-border/50">
            <TabsTrigger value="overview" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="works" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Works</TabsTrigger>
            <TabsTrigger value="verified" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Verified</TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5"><FolderKanban className="h-3.5 w-3.5" /> Projects</TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW ─── */}
          <TabsContent value="overview" className="mt-5 space-y-4">
            {!isOwnProfile && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="rounded-2xl bg-gradient-to-br from-primary/10 via-card/80 to-accent/5 border border-border/60 p-5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Heart className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold text-foreground truncate">
                      Subscribe to {p.display_name || p.username || "this artist"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Unlock their private feed, DMs, and behind-the-scenes from $5/mo.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => user ? setSubscribeOpen(true) : navigate("/auth")}
                  size="lg"
                  className="gap-1.5 w-full mt-4"
                >
                  <Heart className="h-4 w-4" /> Support {p.display_name || p.username || "creator"}
                </Button>
                <p className="mt-3 text-[11px] text-muted-foreground text-center">
                  Cancel anytime. {p.display_name || "Creator"} keeps 85%.
                </p>
              </motion.div>
            )}

            {/* Coins gallery — multiple pump.fun tokens; empty state = StartCoinCta for owner */}
            <CreatorCoinsGallery
              userId={p.user_id}
              creatorName={p.display_name || p.username}
              isOwner={isOwnProfile}
              fallbackWallet={(p as any).solana_wallet ?? null}
            />

            {/* Creator Activity (full card) */}
            {p?.id && p?.user_id && (
              <CreatorActivityCard
                creatorProfileId={p.id}
                creatorUserId={p.user_id}
                creatorName={p.display_name || p.username || "this creator"}
                tokenTicker={(p as any).token_ticker}
              />
            )}

            {/* Unified Catalog */}
            <ProfileCatalogCard
              listings={sellerListings ?? []}
              events={allHostedEvents ?? []}
              spaces={hostedSpaces ?? []}
            />

            {/* Verify creator — keep collapsible for proof anchoring */}
            <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5">
              <Collapsible open={reputationOpen} onOpenChange={setReputationOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Award className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">Proof of work</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          On-chain anchors for every contribution.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {anchoredCount}/{Math.max(50, totalProofs)}
                      </Badge>
                      <ArrowRight className={cn("h-4 w-4 text-muted-foreground transition-transform", reputationOpen && "rotate-90")} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3">
                  {isOwnProfile && totalProofs > 0 && anchoredCount < totalProofs && (
                    <div className="flex justify-end">
                      <AnchorButton proofs={proofs!} />
                    </div>
                  )}
                  {isOwnProfile && (totalProofs === 0 || anchoredCount >= totalProofs) && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => navigate("/settings/verification")}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        {totalProofs === 0 ? "Start verifying" : `Verify (${totalProofs})`}
                      </Button>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </TabsContent>

          {/* ─── WORKS ─── */}
          <TabsContent value="works" className="mt-5">
            <PostsGrid posts={flowPosts ?? []} isOwnProfile={isOwnProfile} navigate={navigate} />
          </TabsContent>

          {/* ─── VERIFIED ─── */}
          <TabsContent value="verified" className="mt-5">
            <PostsGrid
              posts={(flowPosts ?? []).filter((p: any) => !!p.solana_signature)}
              isOwnProfile={isOwnProfile}
              navigate={navigate}
              emptyTitle="No verified works yet"
              emptyDescription="Anchored works (Verified IP) show up here."
            />
          </TabsContent>

          {/* ─── PROJECTS ─── */}
          <TabsContent value="projects" className="mt-5">
            {(buildingProjects?.length ?? 0) > 0 ? (
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
            ) : (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description={isOwnProfile ? "Releases and collaborations live here. Start one from a listing or proposal." : "This creator hasn't shipped any public projects yet."}
                size="sm"
              />
            )}
          </TabsContent>
        </Tabs>



        {/* v10.3 — unified Support sheet (Subscribe / Tip / Trade) */}
        {!isOwnProfile && id && (
          <SupportSheet
            open={subscribeOpen}
            onOpenChange={setSubscribeOpen}
            creatorId={id}
            creatorName={p.display_name || p.username || "this artist"}
          />
        )}

        {/* Backed by Rhozeland — shareable creator card */}
        {id && (
          <ShareCardModal
            open={shareCardOpen}
            onOpenChange={setShareCardOpen}
            creatorId={id}
          />
        )}


        {/* Phase B2 — self-serve profile boost (owner only) */}
        {isOwnProfile && (
          <BoostProfileSheet open={boostOpen} onOpenChange={setBoostOpen} />
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
