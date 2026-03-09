import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  User,
  Globe,
  CheckCircle,
  Search,
  Palette,
  MapPin,
} from "lucide-react";

const ProfilesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredProfiles = profiles?.filter((p) => {
    // Show all public profiles + own profile even if private
    const isOwn = p.user_id === user?.id;
    const isPublic = (p as any).is_public !== false;
    if (!isOwn && !isPublic) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q) ||
      p.skills?.some((s: string) => s.toLowerCase().includes(q)) ||
      (p as any).mediums?.some((m: string) => m.toLowerCase().includes(q)) ||
      (p as any).location?.toLowerCase().includes(q)
    );
  });

  const initials = (name: string | null) =>
    (name || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Creator Profiles</h1>
          <p className="text-muted-foreground">Discover and connect with talented creators</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, skill, medium..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="surface-card h-64 animate-pulse" />
          ))}
        </div>
      ) : filteredProfiles?.length === 0 ? (
        <div className="text-center py-16">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">No profiles found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Try a different search term" : "No creators have signed up yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProfiles?.map((profile, i) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/profiles/${profile.user_id}`)}
              className="surface-card overflow-hidden cursor-pointer hover:shadow-md transition-all group"
            >
              <div className="h-20 transition-colors" style={{ background: profile.banner_gradient || 'linear-gradient(135deg, hsl(175 50% 85%), hsl(310 50% 90%), hsl(280 40% 92%))' }} />
              <div className="p-5">
                <div className="-mt-14 mb-3 flex h-18 w-18 items-center justify-center rounded-full border-4 border-card bg-muted shadow-sm overflow-hidden" style={{ width: 72, height: 72 }}>
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-lg font-bold text-muted-foreground">
                      {initials(profile.display_name)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <h3 className="font-display font-semibold text-foreground truncate">
                    {profile.display_name || "Creator"}
                  </h3>
                  {profile.user_id === user?.id && (
                    <Badge variant="outline" className="text-[10px] shrink-0">You</Badge>
                  )}
                </div>

                {(profile as any).headline && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{(profile as any).headline}</p>
                )}

                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                  {profile.bio || "No bio yet"}
                </p>

                {/* Skills */}
                {profile.skills && profile.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {profile.skills.slice(0, 3).map((skill: string) => (
                      <span
                        key={skill}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        {skill}
                      </span>
                    ))}
                    {profile.skills.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{profile.skills.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Mediums */}
                {(profile as any).mediums && (profile as any).mediums.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(profile as any).mediums.slice(0, 3).map((medium: string) => (
                      <span
                        key={medium}
                        className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-foreground flex items-center gap-1"
                      >
                        <Palette className="h-2.5 w-2.5" /> {medium}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  {profile.available && (
                    <span className="flex items-center gap-1 text-primary">
                      <CheckCircle className="h-3 w-3" /> Available
                    </span>
                  )}
                  {(profile as any).location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {(profile as any).location}
                    </span>
                  )}
                  {profile.portfolio_url && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Portfolio
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfilesPage;
