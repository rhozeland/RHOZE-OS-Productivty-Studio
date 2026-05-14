import { useQuery } from "@tanstack/react-query";
import { Music, Palette, Camera, Video, PenLine, Sparkles, Headphones, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDirectThumbnail, needsRemoteThumbnail } from "@/lib/link-thumbnail";

interface Props {
  fileUrl?: string | null;
  linkUrl?: string | null;
  title: string;
  description?: string | null;
  /** Optional content category — drives the icon-hero fallback color/icon. */
  category?: string | null;
  className?: string;
}

const AUDIO_EXT = /\.(mp3|wav|flac|aac|m4a|ogg|opus|aiff)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg|tiff?)(\?|$)/i;

const AUDIO_HOSTS = /(spotify\.com|soundcloud\.com|music\.apple\.com|bandcamp\.com|tidal\.com|audius\.co|lnkfi\.re|linkfire\.com|songwhip\.com|distrokid\.com|orcd\.co)/i;
const VIDEO_HOSTS = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|loom\.com)/i;

interface HeroVisual {
  Icon: LucideIcon;
  /** Solid HSL accent (used for icon + radial wash). */
  accent: string;
  /** Soft secondary HSL hue for the background gradient. */
  accentSoft: string;
  label: string;
}

const CATEGORY_VISUAL: Record<string, HeroVisual> = {
  music:   { Icon: Music,    accent: "hsl(280 75% 60%)", accentSoft: "hsl(330 80% 65%)", label: "Music" },
  audio:   { Icon: Headphones, accent: "hsl(280 75% 60%)", accentSoft: "hsl(210 80% 60%)", label: "Audio" },
  design:  { Icon: Palette,  accent: "hsl(160 65% 50%)", accentSoft: "hsl(190 70% 55%)", label: "Design" },
  photo:   { Icon: Camera,   accent: "hsl(35 92% 58%)",  accentSoft: "hsl(15 85% 60%)",  label: "Photo" },
  video:   { Icon: Video,    accent: "hsl(340 80% 60%)", accentSoft: "hsl(15 80% 60%)",  label: "Video" },
  writing: { Icon: PenLine,  accent: "hsl(210 70% 58%)", accentSoft: "hsl(170 60% 55%)", label: "Writing" },
};

const FALLBACK_VISUAL: HeroVisual = {
  Icon: Sparkles,
  accent: "hsl(var(--primary))",
  accentSoft: "hsl(var(--accent))",
  label: "Drop",
};

/** Pick a hero visual from explicit category, then media-type heuristics. */
const pickVisual = (
  category?: string | null,
  fileUrl?: string | null,
  linkUrl?: string | null,
): HeroVisual => {
  const key = (category ?? "").toLowerCase().trim();
  if (key && CATEGORY_VISUAL[key]) return CATEGORY_VISUAL[key];

  if (fileUrl) {
    if (AUDIO_EXT.test(fileUrl)) return CATEGORY_VISUAL.audio;
    if (VIDEO_EXT.test(fileUrl)) return CATEGORY_VISUAL.video;
    if (IMAGE_EXT.test(fileUrl)) return CATEGORY_VISUAL.design;
  }
  if (linkUrl) {
    if (AUDIO_HOSTS.test(linkUrl)) return CATEGORY_VISUAL.audio;
    if (VIDEO_HOSTS.test(linkUrl)) return CATEGORY_VISUAL.video;
  }
  return FALLBACK_VISUAL;
};

/**
 * Renders the best available thumbnail for a flow item:
 * 1. Real image (fileUrl is an image, or YouTube/og:image fetched).
 * 2. Category- or media-aware icon hero (audio gets a music wash + headphones,
 *    design gets a palette wash, video gets a camera-roll wash, etc.).
 *
 * Audio/video file URLs are NEVER rendered inside `<img>` (that produced the
 * blank gray tiles in the Stream + profile Drops grid). Same for non-YouTube
 * links — we render an editorial hero with title overlay so every tile reads
 * as designed, not "missing image".
 */
export const FlowThumbnail = ({
  fileUrl,
  linkUrl,
  title,
  description,
  category,
  className = "",
}: Props) => {
  // Only treat fileUrl as a renderable image if its extension actually says so.
  // Everything else (audio, video, raw, design files) falls through to the
  // category hero instead of a broken <img> tag.
  const fileLooksLikeImage = !!fileUrl && IMAGE_EXT.test(fileUrl);
  const direct = fileLooksLikeImage ? fileUrl : getDirectThumbnail(linkUrl);
  const shouldFetch = !direct && needsRemoteThumbnail(linkUrl);

  const { data: meta } = useQuery({
    queryKey: ["link-meta", linkUrl],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-link-metadata", {
        body: { url: linkUrl },
      });
      if (error) throw error;
      return data as { image?: string | null };
    },
    enabled: shouldFetch && !!linkUrl,
    staleTime: 1000 * 60 * 60 * 24, // 24h
    retry: false,
  });

  const src = direct || meta?.image || null;

  if (src) {
    return (
      <img
        src={src}
        alt={title}
        className={className}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  // No image available — render a colorful, kind-aware hero. Big soft icon
  // floats off-axis behind the title so audio/video/design tiles all read
  // as intentional editorial cards.
  const v = pickVisual(category, fileUrl, linkUrl);

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex flex-col justify-end p-4 ${className}`}
      style={{
        background:
          `radial-gradient(circle at 20% 15%, ${v.accent}33, transparent 55%),` +
          `radial-gradient(circle at 85% 90%, ${v.accentSoft}33, transparent 55%),` +
          `linear-gradient(135deg, hsl(var(--card)), hsl(var(--muted)))`,
      }}
    >
      <v.Icon
        aria-hidden
        className="absolute -right-4 -bottom-6 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
        style={{ color: v.accent, opacity: 0.32, width: "8rem", height: "8rem" }}
        strokeWidth={1.25}
      />
      <div className="relative z-10 text-left">
        <p
          className="text-[9px] font-semibold uppercase tracking-[0.18em] mb-1.5"
          style={{ color: v.accent }}
        >
          {v.label}
        </p>
        <p className="font-display font-bold text-foreground/90 leading-tight line-clamp-3 text-sm">
          {title}
        </p>
        {description && (
          <p className="text-[10px] text-muted-foreground/80 line-clamp-2 mt-1.5 font-body">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default FlowThumbnail;
