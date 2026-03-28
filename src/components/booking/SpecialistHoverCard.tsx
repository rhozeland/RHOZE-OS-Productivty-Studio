import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Globe, ExternalLink } from "lucide-react";

interface SpecialistHoverCardProps {
  userId: string;
  children: React.ReactNode;
}

const SpecialistHoverCard = ({ userId, children }: SpecialistHoverCardProps) => {
  const { data: profile } = useQuery({
    queryKey: ["specialist-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio, headline, location, skills, portfolio_url, instagram_url, tiktok_url, twitter_url, youtube_url")
        .eq("user_id", userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: reviewStats } = useQuery({
    queryKey: ["specialist-reviews", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating")
        .eq("seller_id", userId);
      if (!data || data.length === 0) return { avg: 0, count: 0 };
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
    enabled: !!userId,
  });

  const { data: flowPosts } = useQuery({
    queryKey: ["specialist-flow-preview", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("flow_items")
        .select("id, file_url, title, category")
        .eq("user_id", userId)
        .not("file_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
    enabled: !!userId,
  });

  if (!profile) return <>{children}</>;

  const initials = (profile.display_name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasSocials = profile.instagram_url || profile.tiktok_url || profile.twitter_url || profile.youtube_url;
  const imageFlowPosts = flowPosts?.filter((p) =>
    p.file_url && (p.category === "Photo" || p.category === "Video")
  ) ?? [];

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80 p-0 overflow-hidden" side="top" align="start">
        {/* Mini banner */}
        <div className="h-12 bg-gradient-to-r from-primary/20 via-accent/15 to-primary/10" />

        <div className="px-4 pb-4 -mt-5">
          <div className="flex items-end gap-3">
            <Avatar className="h-12 w-12 border-2 border-card shadow-md">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-0.5">
              <p className="text-sm font-semibold text-foreground truncate">{profile.display_name}</p>
              {profile.headline && (
                <p className="text-[11px] text-muted-foreground truncate">{profile.headline}</p>
              )}
            </div>
            {reviewStats && reviewStats.count > 0 && (
              <Badge variant="outline" className="text-[9px] gap-0.5 shrink-0">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                {reviewStats.avg} ({reviewStats.count})
              </Badge>
            )}
          </div>

          {profile.location && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-2">
              <MapPin className="h-2.5 w-2.5" /> {profile.location}
            </p>
          )}

          {profile.bio && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">{profile.bio}</p>
          )}

          {profile.skills && profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.skills.slice(0, 5).map((skill: string) => (
                <Badge key={skill} variant="secondary" className="text-[9px] px-1.5 py-0">{skill}</Badge>
              ))}
              {profile.skills.length > 5 && (
                <span className="text-[9px] text-muted-foreground">+{profile.skills.length - 5}</span>
              )}
            </div>
          )}

          {/* Portfolio thumbnails */}
          {imageFlowPosts.length > 0 && (
            <div className="mt-3">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Recent Work</p>
              <div className="grid grid-cols-4 gap-1 rounded-lg overflow-hidden">
                {imageFlowPosts.slice(0, 4).map((post) => (
                  <div key={post.id} className="aspect-square bg-muted overflow-hidden">
                    <img src={post.file_url!} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Social links + portfolio */}
          {(hasSocials || profile.portfolio_url) && (
            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/50">
              {profile.portfolio_url && (
                <a href={profile.portfolio_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="Portfolio">
                  <Globe className="h-3.5 w-3.5" />
                </a>
              )}
              {profile.instagram_url && (
                <a href={profile.instagram_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="Instagram">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              )}
              {profile.twitter_url && (
                <a href={profile.twitter_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="X">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              )}
              {profile.youtube_url && (
                <a href={profile.youtube_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground" title="YouTube">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default SpecialistHoverCard;
