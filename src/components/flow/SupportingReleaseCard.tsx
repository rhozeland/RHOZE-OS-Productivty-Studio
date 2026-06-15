/**
 * SupportingReleaseCard — feed tile rendered when a user shares a
 * "Supporting" post about a project release (link_url = /release/:slug).
 *
 * Visual: the project's real cover image when available. Otherwise a
 * clean, modern minimal card built from `cover_color`. No auto-generated
 * link-preview thumbnails (those were rendering unrelated trippy art).
 */
import { useQuery } from "@tanstack/react-query";
import { Heart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  /** Full release URL — slug is parsed from the trailing segment. */
  linkUrl: string;
  title: string;
  description?: string | null;
  /** Already-known cover (passed by FlowCard.item.file_url). Skips the lookup when present. */
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

  const { data: project } = useQuery({
    queryKey: ["release-project-by-slug", slug],
    enabled: !!slug && !knownCoverUrl,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("title, cover_image_url, cover_color")
        .eq("public_slug", slug!)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const cover = knownCoverUrl || project?.cover_image_url || null;
  const accent = project?.cover_color || `hsl(${hashHue(slug ?? title)} 70% 55%)`;
  const releaseTitle = title.replace(/^Supporting:\s*/i, "") || project?.title || "Release";

  // ─── Has a real cover image ───
  if (cover) {
    return (
      <a
        href={linkUrl}
        className="block relative group"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-[4/5] overflow-hidden bg-muted">
          <img
            src={cover}
            alt={releaseTitle}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            draggable={false}
          />
        </div>
        {/* Floating "Supporting" pill */}
        <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white font-semibold">
          <Heart className="h-3 w-3 fill-current" />
          Supporting
        </div>
        {/* Bottom gradient + title */}
        <div className="absolute inset-x-0 bottom-0 p-5 pt-16 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Release</p>
          <h3 className="font-display text-xl font-bold text-white leading-tight mt-1 line-clamp-2">
            {releaseTitle}
          </h3>
        </div>
      </a>
    );
  }

  // ─── No cover image — clean minimal card built from cover_color ───
  return (
    <a
      href={linkUrl}
      className="block relative group"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="aspect-[4/5] relative overflow-hidden flex flex-col justify-between p-6"
        style={{ background: accent }}
      >
        {/* Subtle texture: faint diagonal sheen */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.4) 100%)",
          }}
        />
        {/* Top label */}
        <div className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white font-semibold self-start">
          <Heart className="h-3 w-3 fill-current" />
          Supporting
        </div>

        {/* Centered minimal mark */}
        <div className="relative flex-1 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center ring-1 ring-white/25">
            <Sparkles className="h-7 w-7 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Bottom title block */}
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/70">Release</p>
          <h3 className={cn(
            "font-display font-bold text-white leading-tight mt-1.5 line-clamp-2",
            releaseTitle.length > 24 ? "text-xl" : "text-2xl",
          )}>
            {releaseTitle}
          </h3>
          {description && (
            <p className="text-xs text-white/75 mt-2 line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
};

export default SupportingReleaseCard;
