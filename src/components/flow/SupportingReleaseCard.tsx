/**
 * BuildingReleaseCard (file kept as SupportingReleaseCard for import stability)
 *
 * Renders a flow tile for a public project / release that a musician is
 * building in public. Reframed away from "Supporting X" → toward the artist
 * and the work itself: avatar, artist name, release title, cheer count,
 * progress vibe. Compact editorial — no oversized colored block.
 */
import { useQuery } from "@tanstack/react-query";
import { Hammer, Heart, ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  linkUrl: string;
  title: string;
  description?: string | null;
  knownCoverUrl?: string | null;
}

const extractSlug = (url: string): string | null => {
  const m = url.match(/\/release\/([^/?#]+)/);
  return m ? m[1] : null;
};

const hashHue = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
};

const SupportingReleaseCard = ({ linkUrl, title, description, knownCoverUrl }: Props) => {
  const slug = extractSlug(linkUrl);
  const sb: any = supabase;

  const { data: project } = useQuery({
    queryKey: ["release-project-by-slug-v2", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: p } = await sb
        .from("projects")
        .select("id, title, vision, cover_image_url, cover_color, cheer_count, user_id")
        .eq("public_slug", slug!)
        .maybeSingle();
      if (!p) return null;
      const { data: owner } = await sb
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", p.user_id)
        .maybeSingle();
      return { ...p, owner };
    },
    staleTime: 5 * 60 * 1000,
  });

  const cover = project?.cover_image_url || knownCoverUrl || null;
  const accent = project?.cover_color || `hsl(${hashHue(slug ?? title)} 72% 56%)`;
  const releaseTitle =
    project?.title || title.replace(/^Supporting:\s*/i, "") || "Release";
  const blurb = project?.vision || description || null;
  const ownerName =
    project?.owner?.display_name || project?.owner?.username || "Artist";
  const ownerInitial = ownerName.charAt(0).toUpperCase();
  const cheerCount = project?.cheer_count ?? 0;

  return (
    <a
      href={linkUrl}
      className="block group px-4 py-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative rounded-2xl overflow-hidden border border-foreground/10 bg-card shadow-sm transition-shadow group-hover:shadow-md">
        {/* Cover strip — image if available, else color accent */}
        <div
          className="relative h-28 w-full overflow-hidden"
          style={cover ? undefined : { background: accent }}
        >
          {cover && (
            <img
              src={cover}
              alt={releaseTitle}
              className="h-full w-full object-cover"
              draggable={false}
            />
          )}
          {/* Building pill */}
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white font-semibold">
            <Hammer className="h-3 w-3" />
            Building
          </div>
          {cheerCount > 0 && (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold text-white">
              <Heart className="h-3 w-3 fill-current" />
              {cheerCount}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="h-6 w-6">
              {project?.owner?.avatar_url && (
                <AvatarImage src={project.owner.avatar_url} alt={ownerName} />
              )}
              <AvatarFallback className="text-[10px]">{ownerInitial}</AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-muted-foreground truncate">
              {ownerName}
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 ml-auto">
              Release
            </span>
          </div>

          <h3 className={cn(
            "font-display font-bold leading-tight text-foreground line-clamp-2",
            releaseTitle.length > 28 ? "text-base" : "text-lg",
          )}>
            {releaseTitle}
          </h3>

          {blurb && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-snug">
              {blurb}
            </p>
          )}

          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/80 group-hover:text-foreground">
            Follow the roadmap
            <ArrowUpRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </a>
  );
};

export default SupportingReleaseCard;
