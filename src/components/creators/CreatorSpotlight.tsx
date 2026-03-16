import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CreatorSpotlight = () => {
  const navigate = useNavigate();

  const { data: profiles } = useQuery({
    queryKey: ["creator-spotlight"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const initials = (name: string | null) =>
    (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  if (!profiles?.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-foreground text-lg">Creators</h2>
        <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => navigate("/profiles")}>
          View all <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {profiles.map((profile, i) => (
          <motion.div
            key={profile.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => navigate(`/profiles/${profile.user_id}`)}
            className="surface-card overflow-hidden cursor-pointer hover:shadow-md transition-all group rounded-2xl shrink-0 w-[140px]"
          >
            <div
              className="h-12 transition-colors"
              style={{ background: profile.banner_gradient || "var(--gradient-hero)" }}
            />
            <div className="p-3 -mt-6">
              <div className="mb-1.5 flex items-center justify-center rounded-full border-2 border-card bg-muted shadow-sm overflow-hidden" style={{ width: 40, height: 40 }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span className="font-display text-xs font-bold text-muted-foreground">{initials(profile.display_name)}</span>
                )}
              </div>
              <h3 className="font-display font-semibold text-foreground text-xs truncate">
                {profile.display_name || "Creator"}
              </h3>
              {profile.headline && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{profile.headline}</p>
              )}
              {profile.available && (
                <span className="flex items-center gap-0.5 text-[10px] text-primary mt-1">
                  <CheckCircle className="h-2.5 w-2.5" /> Available
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CreatorSpotlight;
