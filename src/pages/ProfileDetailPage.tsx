import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Globe,
  CheckCircle,
  UserPlus,
  UserCheck,
  MessageSquare,
  ArrowLeft,
  MapPin,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Users,
  Palette,
  FolderOpen,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

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

  // Fetch public projects
  const { data: publicProjects } = useQuery({
    queryKey: ["user-projects", id],
    queryFn: async () => {
      // For own profile show all, for others only if connected
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, status, cover_color, created_at")
        .eq("user_id", id!)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!id && (isOwnProfile || true), // projects visible to connected users
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
        <Button variant="outline" className="mt-4" onClick={() => navigate("/profiles")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Profiles
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
        <Button variant="outline" className="mt-4" onClick={() => navigate("/profiles")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Profiles
        </Button>
      </div>
    );
  }

  const initials = (profile.display_name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/profiles")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> All Profiles
      </Button>

      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-card overflow-hidden"
      >
        <div
          className="h-32"
          style={{
            background: (profile as any).banner_gradient || "linear-gradient(135deg, hsl(175,60%,80%), hsl(200,40%,90%), hsl(330,30%,92%))",
          }}
        />
        <div className="px-6 pb-6">
          <div className="-mt-16 flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-card bg-muted shadow-lg overflow-hidden shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-2xl font-bold text-muted-foreground">{initials}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {profile.display_name || "Creator"}
                </h1>
                {profile.available && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <CheckCircle className="h-3 w-3" /> Available
                  </Badge>
                )}
                {profile.is_public === false && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <EyeOff className="h-3 w-3" /> Private
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
            {isOwnProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/settings")}
                className="shrink-0 gap-1.5"
              >
                <Settings className="h-4 w-4" /> Edit Profile
              </Button>
            )}
            {!isOwnProfile && user && (
              <div className="flex gap-2 shrink-0">
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
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div className="text-center">
              <p className="font-bold text-foreground">{followerCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">{followingCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">{publicSmartboards?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Boards</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">{publicProjects?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Projects</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bio + Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 surface-card p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">About</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {profile.bio || "This creator hasn't added a bio yet."}
          </p>

          {profile.skills && profile.skills.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill: string) => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {(profile as any).mediums && (profile as any).mediums.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
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

        <div className="surface-card p-5 space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">Details</h2>
          {profile.portfolio_url && (
            <a
              href={profile.portfolio_url}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Globe className="h-4 w-4" /> Portfolio
            </a>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Joined {format(new Date(profile.created_at), "MMMM yyyy")}
          </div>
        </div>
      </div>

      {/* Public Smartboards */}
      {publicSmartboards && publicSmartboards.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Public Smartboards
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {publicSmartboards.map((board: any) => (
              <div
                key={board.id}
                onClick={() => navigate(`/smartboards/${board.id}`)}
                className="surface-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="h-16" style={{ backgroundColor: board.cover_color || "hsl(175,60%,55%)" }} />
                <div className="p-4">
                  <h3 className="font-medium text-foreground text-sm truncate">{board.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{board.description || "No description"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {isOwnProfile && publicProjects && publicProjects.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" /> Projects
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {publicProjects.map((project: any) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="surface-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="h-12" style={{ backgroundColor: project.cover_color || "#7c3aed" }} />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground text-sm truncate flex-1">{project.title}</h3>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">{project.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{project.description || "No description"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDetailPage;
