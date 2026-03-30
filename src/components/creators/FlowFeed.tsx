import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Eye, Heart, MessageCircle, TrendingUp, Clock, Sparkles, Play } from "lucide-react";

const getYouTubeId = (url?: string | null) => {
  if (!url) return null;
  try {
    const cleaned = decodeURIComponent(url);
    const match = cleaned.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([A-Za-z0-9_-]{11})/);
    return match?.[1] || null;
  } catch {
    return null;
  }
};

const FlowFeed = () => {
  const navigate = useNavigate();

  const { data: flowItems, isLoading } = useQuery({
    queryKey: ["flow-feed-hub"],
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("flow_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      if (!items?.length) return [];

      // Get interaction counts per item
      const itemIds = items.map((i) => i.id);
      const { data: interactions } = await supabase
        .from("flow_interactions")
        .select("flow_item_id, action")
        .in("flow_item_id", itemIds);

      // Get creator profiles
      const userIds = [...new Set(items.map((i) => i.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      return items.map((item) => {
        const itemInteractions = interactions?.filter((ix) => ix.flow_item_id === item.id) ?? [];
        return {
          ...item,
          profile: profiles?.find((p) => p.user_id === item.user_id),
          likes: itemInteractions.filter((ix) => ix.action === "like").length,
          views: itemInteractions.filter((ix) => ix.action === "view").length,
          saves: itemInteractions.filter((ix) => ix.action === "save").length,
          totalEngagement: itemInteractions.length,
        };
      });
    },
  });

  const sorted = flowItems?.sort((a, b) => b.totalEngagement - a.totalEngagement);

  const initials = (name: string | null) =>
    (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-card border border-border animate-pulse rounded-xl h-64" />
        ))}
      </div>
    );
  }

  if (!sorted?.length) {
    return (
      <div className="card-dashed flex flex-col items-center justify-center py-16">
        <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/30" />
        <p className="text-foreground font-medium font-body">No flow content yet</p>
        <p className="text-xs text-muted-foreground mt-1 font-body">
          Post in Flow Mode to see content here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
        <TrendingUp className="h-4 w-4" />
        Sorted by engagement
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => navigate("/flow")}
            className="group relative rounded-xl bg-card border border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            {/* Cover / media */}
            {(() => {
              const ytId = getYouTubeId(item.link_url);
              if (item.file_url) {
                return (
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    {item.content_type === "image" ? (
                      <img
                        src={item.file_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <Sparkles className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                );
              }
              if (ytId) {
                return (
                  <div className="aspect-[16/10] overflow-hidden bg-muted relative">
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-foreground/70 flex items-center justify-center">
                        <Play className="h-5 w-5 text-background fill-background ml-0.5" />
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="aspect-[16/10] flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <Sparkles className="h-10 w-10 text-muted-foreground/20" />
                </div>
              );
            })()}

            <div className="p-4 space-y-2.5">
              {/* Creator */}
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {item.profile?.avatar_url ? (
                    <img src={item.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[8px] font-bold text-muted-foreground">
                      {initials(item.profile?.display_name ?? null)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate font-body">
                  {item.profile?.display_name || "Creator"}
                </span>
                {item.category && (
                  <span className="ml-auto text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground capitalize">
                    {item.category}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="font-display font-semibold text-foreground text-sm leading-snug line-clamp-2">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              )}

              {/* Engagement metrics */}
              <div className="flex items-center gap-4 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {item.views}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {item.likes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> {item.saves}
                </span>
                {item.totalEngagement > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-primary font-medium">
                    <TrendingUp className="h-3 w-3" /> {item.totalEngagement}
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

export default FlowFeed;
