import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  CheckCircle,
  UserPlus,
  UserCheck,
  MessageSquare,
  MapPin,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Palette,
  FolderOpen,
  Settings,
  Store,
  Star,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import ProfileSellerStats from "@/components/profile/ProfileSellerStats";

const ProfileDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isOwnProfile = user?.id === id;

  // Fetch profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch connection status
  const { data: connectionStatus } = useQuery({
    queryKey: ["connection-status", user?.id, id],
    queryFn: async () => {
      const { data } = await supabase
        .from("connections")
        .select("*")
        .or(`and(follower_id.eq.${user!.id},following_id.eq.${id}),and(follower_id.eq.${id},following_id.eq.${user!.id})`);
      return data ?? [];
    },
    enabled: !!user && !!id && !isOwnProfile,
  });

  // Fetch public smartboards
  const { data: publicSmartboards } = useQuery({
    queryKey: ["public-smartboards", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("smartboards")
        .select("id, title, description, cover_color, created_at")
        .eq("user_id", id!)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Fetch public projects (own profile only)
  const { data: publicProjects } = useQuery({
    queryKey: ["user-projects", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, status, cover_color, created_at")
        .eq("user_id", id!)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!id && isOwnProfile,
  });

  // Fetch seller listings
  const { data: sellerListings } = useQuery({
    queryKey: ["seller-listings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("id, title, category, listing_type, price, currency, credits_price, cover_url, image_url, tags")
        .eq("user_id", id!)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
    enabled: !!id,
  });

  // Fetch seller reviews summary
  const { data: reviewStats } = useQuery({
    queryKey: ["seller-review-stats", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating")
        .eq("seller_id", id!);
      if (!data || data.length === 0) return { avg: 0, count: 0 };
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!id,
  });

  // Follower/following counts
  const { data: followerCount } = useQuery({
    queryKey: ["followers-count", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("connections")
        .select("*", { count: "exact", head: true })
        .eq("following_id", id!)
        .eq("type", "follow")
        .eq("status", "active");
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: followingCount } = useQuery({
    queryKey: ["following-count", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("connections")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", id!)
        .eq("type", "follow")
        .eq("status", "active");
      return count ?? 0;
    },
    enabled: !!id,
  });

  const isFollowing = connectionStatus?.some(
    (c: any) => c.follower_id === user?.id && c.following_id === id && c.type === "follow" && c.status === "active"
  );
  const connectRequest = connectionStatus?.find(
    (c: any) => c.type === "connect"
  );
  const isConnected = connectRequest?.status === "active" && 
    ((connectRequest?.follower_id === user?.id) || (connectRequest?.following_id === user?.id));
  const hasPendingConnect = connectRequest?.status === "pending";
  const receivedConnectRequest = hasPendingConnect && connectRequest?.following_id === user?.id;

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from("connections").delete()
          .eq("follower_id", user!.id).eq("following_id", id!).eq("type", "follow");
      } else {
        await supabase.from("connections").insert({
          follower_id: user!.id,
          following_id: id!,
          type: "follow",
          status: "active",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["followers-count"] });
      toast.success(isFollowing ? "Unfollowed" : "Following!");
    },
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (isConnected) {
        await supabase.from("connections").delete()
          .eq("id", connectRequest!.id);
      } else {
        await supabase.from("connections").insert({
          follower_id: user!.id,
          following_id: id!,
          type: "connect",
          status: "pending",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      toast.success(isConnected ? "Disconnected" : "Connection request sent!");
    },
  });

  // Accept connect request
  const acceptConnectMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("connections").update({ status: "active" }).eq("id", connectRequest!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      toast.success("Connected!");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Profile not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
    );
  }

  // Check visibility
  if (!isOwnProfile && profile.is_public === false) {
    return (
      <div className="text-center py-20">
        <EyeOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-display text-xl font-semibold text-foreground">Private Profile</h2>
        <p className="text-muted-foreground mt-2">This creator's profile is set to private.</p>
      </div>
    );
  }

  const initials = (profile.display_name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const profileBg = (profile as any).profile_background;
  const bannerGradient = (profile as any).banner_gradient || "linear-gradient(135deg, hsl(220,15%,40%), hsl(220,10%,55%), hsl(175,30%,65%))";

  const hasSellerContent = (sellerListings?.length ?? 0) > 0;

  // Section visibility preferences
  const showSellerStats = (profile as any).show_seller_stats !== false;
  const showOfferings = (profile as any).show_offerings !== false;
  const showPublicBoards = (profile as any).show_public_boards !== false;

  // Toggle section visibility mutation
  const toggleSectionMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", id] });
    },
    onError: () => {
      toast.error("Failed to update section visibility");
    },
  });

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] -m-4 md:-m-8 p-4 md:p-8 transition-colors duration-500"
      style={{
        background: profileBg || undefined,
      }}
    >
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg"
        >
          {/* Banner */}
          <div
            className="h-36 sm:h-44 relative rounded-t-2xl overflow-hidden"
            style={{ background: bannerGradient }}
          >
            {/* Edit button for own profile */}
            {isOwnProfile && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/settings")}
                className="absolute top-3 right-3 gap-1.5 bg-card/80 backdrop-blur-sm hover:bg-card/95 shadow-md text-xs"
              >
                <Settings className="h-3.5 w-3.5" /> Edit Profile
              </Button>
            )}
          </div>

          <div className="px-5 sm:px-8 pb-6">
            <div className="-mt-14 sm:-mt-16 flex flex-col sm:flex-row sm:items-end gap-4 relative z-10">
              {/* Avatar */}
              <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-4 border-card bg-muted shadow-xl overflow-hidden shrink-0 ring-2 ring-background/50">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-2xl font-bold text-muted-foreground">{initials}</span>
                )}
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    {profile.display_name || "Creator"}
                  </h1>
                  {profile.available && (
                    <Badge variant="secondary" className="text-[10px] gap-1 font-medium">
                      <CheckCircle className="h-3 w-3 text-emerald-500" /> Available
                    </Badge>
                  )}
                  {reviewStats && reviewStats.count > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 font-medium">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {reviewStats.avg} ({reviewStats.count})
                    </Badge>
                  )}
                </div>
                {(profile as any).headline && (
                  <p className="text-sm text-muted-foreground mt-0.5">{(profile as any).headline}</p>
                )}
                {(profile as any).location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" /> {(profile as any).location}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {!isOwnProfile && user && (
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending}
                  >
                    {isFollowing ? (
                      <><UserCheck className="mr-1.5 h-4 w-4" /> Following</>
                    ) : (
                      <><UserPlus className="mr-1.5 h-4 w-4" /> Follow</>
                    )}
                  </Button>

                  {receivedConnectRequest ? (
                    <Button
                      size="sm"
                      onClick={() => acceptConnectMutation.mutate()}
                      disabled={acceptConnectMutation.isPending}
                    >
                      <UserCheck className="mr-1.5 h-4 w-4" /> Accept
                    </Button>
                  ) : (
                    <Button
                      variant={isConnected ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending || (hasPendingConnect && !receivedConnectRequest)}
                    >
                      {isConnected ? "Connected" : hasPendingConnect ? "Pending…" : "Connect"}
                    </Button>
                  )}

                  {isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/messages?to=${id}`)}
                    >
                      <MessageSquare className="mr-1.5 h-4 w-4" /> Message
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Stats row */}
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

        {/* Bio + Details */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="md:col-span-2 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5 space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">About</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {profile.bio || "This creator hasn't added a bio yet."}
            </p>

            {profile.skills && profile.skills.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            {(profile as any).mediums && (profile as any).mediums.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Palette className="h-3 w-3" /> Mediums
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(profile as any).mediums.map((medium: string) => (
                    <Badge key={medium} variant="outline" className="text-xs">{medium}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 p-5 space-y-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Details</h2>
            {profile.portfolio_url && (
              <a
                href={profile.portfolio_url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Globe className="h-4 w-4" /> Portfolio <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Joined {format(new Date(profile.created_at), "MMMM yyyy")}
            </div>
            {hasSellerContent && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="h-4 w-4" />
                Active seller
              </div>
            )}
          </div>
        </motion.div>

        {/* Seller Stats — public stats for everyone, private analytics for owner */}
        {(showSellerStats || isOwnProfile) && (
          <div className="relative">
            {isOwnProfile && (
              <button
                onClick={() => toggleSectionMutation.mutate({ field: "show_seller_stats", value: !showSellerStats })}
                className="absolute -top-1 right-0 z-10 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title={showSellerStats ? "Hide from public" : "Show to public"}
              >
                {showSellerStats ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            )}
            {!showSellerStats && isOwnProfile && (
              <div className="absolute inset-0 rounded-xl border-2 border-dashed border-muted-foreground/20 pointer-events-none z-0" />
            )}
            <div className={!showSellerStats && isOwnProfile ? "opacity-50" : ""}>
              <ProfileSellerStats userId={id!} isOwnProfile={isOwnProfile} />
            </div>
          </div>
        )}

        {/* Seller Listings — subtle section */}
        {hasSellerContent && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-3"
          >
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" /> Offerings
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sellerListings!.map((listing: any) => (
                <div
                  key={listing.id}
                  onClick={() => navigate(`/creators/${listing.id}`)}
                  className="group rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
                >
                  {(listing.cover_url || listing.image_url) ? (
                    <div className="aspect-[4/3] overflow-hidden bg-muted">
                      <img
                        src={listing.cover_url || listing.image_url}
                        alt=""
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div
                      className="aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10"
                    >
                      <Store className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate">{listing.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="outline" className="text-[9px] capitalize">{listing.category}</Badge>
                      {listing.credits_price && (
                        <span className="text-[10px] font-semibold text-primary">{listing.credits_price} cr</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Public Smartboards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="space-y-3"
        >
          <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Public Boards
          </h2>
          {publicSmartboards && publicSmartboards.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {publicSmartboards.map((board: any) => (
                <div
                  key={board.id}
                  onClick={() => navigate(`/smartboards/${board.id}`)}
                  className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
                >
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
              {isOwnProfile && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/smartboards")}>
                  Manage Boards
                </Button>
              )}
            </div>
          )}
        </motion.div>

        {/* Projects — own profile only */}
        {isOwnProfile && publicProjects && publicProjects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="space-y-3"
          >
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" /> Projects
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {publicProjects.map((project: any) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
                >
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

export default ProfileDetailPage;
