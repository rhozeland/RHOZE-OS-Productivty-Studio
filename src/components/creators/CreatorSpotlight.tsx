import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, MapPin, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CreatorSpotlight = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profiles } = useQuery({
    queryKey: ["creator-spotlight"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const initials = (name: string | null) =>
    (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  if (!profiles?.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-foreground text-lg">Creators</h2>
        <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => {}}>
          View all <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {profiles.map((profile, i) => (
          <motion.div
            key={profile.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => navigate(`/profiles/${profile.user_id}`)}
            className="surface-card overflow-hidden cursor-pointer hover:shadow-md transition-all group rounded-2xl"
          >
            <div
              className="h-16 transition-colors"
              style={{ background: profile.banner_gradient || "var(--gradient-hero)" }}
            />
            <div className="p-4 -mt-8">
              <div className="mb-2 flex items-center justify-center rounded-full border-3 border-card bg-muted shadow-sm overflow-hidden" style={{ width: 56, height: 56 }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="font-display text-sm font-bold text-muted-foreground">{initials(profile.display_name)}</span>
                )}
              </div>
              <h3 className="font-display font-semibold text-foreground text-sm truncate">
                {profile.display_name || "Creator"}
              </h3>
              {profile.headline && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{profile.headline}</p>
              )}
              {profile.skills?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {profile.skills.slice(0, 2).map((s: string) => (
                    <span key={s} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{s}</span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                {profile.available && (
                  <span className="flex items-center gap-0.5 text-primary">
                    <CheckCircle className="h-2.5 w-2.5" /> Available
                  </span>
                )}
                {profile.location && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" /> {profile.location}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CreatorSpotlight;
