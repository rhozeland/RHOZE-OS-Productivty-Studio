import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { User, Globe, CheckCircle } from "lucide-react";

const ProfilesPage = () => {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Creator Profiles</h1>
        <p className="text-muted-foreground">Discover talented creators</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="surface-card h-64 animate-pulse" />)}
        </div>
      ) : profiles?.length === 0 ? (
        <p className="text-muted-foreground">No profiles yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles?.map((profile, i) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="surface-card overflow-hidden"
            >
              <div className="h-20 bg-gradient-to-r from-primary/30 to-accent/30" />
              <div className="p-5">
                <div className="-mt-12 mb-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-muted">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-display font-semibold text-foreground">{profile.display_name || "Creator"}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{profile.bio || "No bio yet"}</p>

                {profile.skills && profile.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {profile.skills.slice(0, 4).map((skill: string) => (
                      <span key={skill} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  {profile.available && (
                    <span className="flex items-center gap-1 text-accent">
                      <CheckCircle className="h-3 w-3" />Available
                    </span>
                  )}
                  {profile.portfolio_url && (
                    <a href={profile.portfolio_url} target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-primary">
                      <Globe className="h-3 w-3" />Portfolio
                    </a>
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
