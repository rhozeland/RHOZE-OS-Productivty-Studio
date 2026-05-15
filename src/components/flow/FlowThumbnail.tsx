import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Palette, Camera, Video, PenLine, Sparkles, AudioLines, Music2, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDirectThumbnail, needsRemoteThumbnail } from "@/lib/link-thumbnail";
import { cn } from "@/lib/utils";

interface Props {
  fileUrl?: string | null;
  linkUrl?: string | null;
  title: string;
  description?: string | null;
  /** Optional content category — drives the icon-hero fallback color/icon. */
  category?: string | null;
  className?: string;
  /** When true, hide the built-in label/title/description footer.
   *  Use when the parent tile already renders its own caption (e.g. mosaic). */
  hideCaption?: boolean;
}

const AUDIO_EXT = /\.(mp3|wav|flac|aac|m4a|ogg|opus|aiff)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg|tiff?)(\?|$)/i;

const AUDIO_HOSTS = /(spotify\.com|soundcloud\.com|music\.apple\.com|bandcamp\.com|tidal\.com|audius\.co|lnkfi\.re|linkfire\.com|songwhip\.com|distrokid\.com|orcd\.co)/i;
const VIDEO_HOSTS = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|loom\.com)/i;

interface HeroVisual {
  Icon: LucideIcon;
  /** Bold gradient stops (full-bleed, saturated). */
  from: string;
  via: string;
  to: string;
  /** Tint for the giant background glyph. */
  glyph: string;
  label: string;
  /** Optional decorative pattern hint. */
  pattern?: "waves" | "dots" | "grid";
}

const CATEGORY_VISUAL: Record<string, HeroVisual> = {
  // High-contrast "album cover" palette: deep plum → hot magenta → tangerine.
  // Reads instantly as music even at 120px tile size.
  music:   { Icon: Music2,      from: "hsl(282 70% 14%)", via: "hsl(330 90% 48%)", to: "hsl(18 100% 58%)",   glyph: "hsl(48 100% 88%)", label: "Music", pattern: "waves" },
  audio:   { Icon: AudioLines,  from: "hsl(282 70% 14%)", via: "hsl(330 90% 48%)", to: "hsl(18 100% 58%)",   glyph: "hsl(48 100% 88%)", label: "Audio", pattern: "waves" },
  design:  { Icon: Palette,     from: "hsl(165 85% 25%)", via: "hsl(180 90% 45%)", to: "hsl(140 90% 55%)",  glyph: "hsl(60 100% 80%)",  label: "Design", pattern: "grid" },
  photo:   { Icon: Camera,      from: "hsl(15 90% 35%)",  via: "hsl(35 95% 55%)",  to: "hsl(50 100% 65%)",  glyph: "hsl(0 0% 100%)",    label: "Photo", pattern: "dots" },
  video:   { Icon: Video,       from: "hsl(340 90% 30%)", via: "hsl(355 90% 55%)", to: "hsl(25 95% 60%)",   glyph: "hsl(45 100% 75%)",  label: "Video", pattern: "dots" },
  writing: { Icon: PenLine,     from: "hsl(220 80% 25%)", via: "hsl(200 85% 45%)", to: "hsl(170 80% 55%)",  glyph: "hsl(60 80% 85%)",   label: "Writing", pattern: "grid" },
};

const FALLBACK_VISUAL: HeroVisual = {
  Icon: Sparkles,
  from: "hsl(260 80% 25%)",
  via: "hsl(300 85% 50%)",
  to: "hsl(340 90% 60%)",
  glyph: "hsl(50 100% 80%)",
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
 * 2. Category-aware editorial hero — bold saturated gradient, oversized
 *    glyph icon, optional pattern (waveform for audio, dots for photo/video,
 *    grid for design/writing). NO washed-out gray fallbacks anymore.
 */
export const FlowThumbnail = ({
  fileUrl,
  linkUrl,
  title,
  description,
  category,
  className = "",
  hideCaption = false,
}: Props) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
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
      return data as { image?: string | null; favicon?: string | null };
    },
    enabled: shouldFetch && !!linkUrl,
    staleTime: 1000 * 60 * 60 * 24,
    retry: false,
  });

  const src = useMemo(() => {
    const candidates = [direct, meta?.image, meta?.favicon].filter(Boolean) as string[];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (/favicon\.ico($|\?)/i.test(candidate)) continue;
      return candidate;
    }
    return null;
  }, [direct, meta?.image, meta?.favicon]);

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
  }, [src]);

  const v = pickVisual(category, fileUrl, linkUrl);
  const normalizedCategory = (category ?? "").toLowerCase().trim();
  const isAudioVisual = normalizedCategory === "music" || normalizedCategory === "audio";
  const showImage = !!src && !imageFailed;

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden flex flex-col justify-end p-4",
        className,
      )}
      style={{
        backgroundImage:
          `radial-gradient(ellipse at 80% 0%, ${v.glyph}40, transparent 50%),` +
          `radial-gradient(ellipse at 0% 100%, ${v.from} 0%, transparent 60%),` +
          `linear-gradient(135deg, ${v.from} 0%, ${v.via} 55%, ${v.to} 100%)`,
      }}
    >
      {showImage && (
        <img
          src={src}
          alt={title}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
        />
      )}

      {/* (Audio scrim removed — vinyl block below provides its own contrast.) */}


      {/* Decorative pattern layer */}
      {v.pattern === "waves" && !isAudioVisual && (
        <svg
          className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300 ${imageLoaded ? "opacity-0" : "opacity-25 mix-blend-screen"}`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {Array.from({ length: 14 }).map((_, i) => {
            const x = 6 + i * 6.5;
            const h = 18 + ((i * 37) % 55);
            return (
              <rect
                key={i}
                x={x}
                y={50 - h / 2}
                width={3}
                height={h}
                rx={1.5}
                fill={v.glyph}
              />
            );
          })}
        </svg>
      )}
      {v.pattern === "dots" && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${imageLoaded ? "opacity-0" : "opacity-20 mix-blend-screen"}`}
          style={{
            backgroundImage: `radial-gradient(${v.glyph} 1px, transparent 1.5px)`,
            backgroundSize: "14px 14px",
          }}
          aria-hidden
        />
      )}
      {v.pattern === "grid" && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${imageLoaded ? "opacity-0" : "opacity-15 mix-blend-screen"}`}
          style={{
            backgroundImage:
              `linear-gradient(${v.glyph}66 1px, transparent 1px),` +
              `linear-gradient(90deg, ${v.glyph}66 1px, transparent 1px)`,
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />
      )}

      {isAudioVisual && !showImage && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${imageLoaded ? "opacity-0" : "opacity-100"}`}
          aria-hidden
        >
          {/* Bold dark wash so the disc + glyph pop */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 25% 20%, hsl(48 100% 70% / 0.22), transparent 55%), radial-gradient(ellipse at 80% 90%, hsl(0 0% 0% / 0.55), transparent 60%)",
            }}
          />
          {/* Centered vinyl/disc — full-bleed, high contrast */}
          <div className="absolute inset-0 grid place-items-center">
            <div
              className="relative aspect-square w-[78%] rounded-full shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)]"
              style={{
                background:
                  "repeating-radial-gradient(circle at 50% 50%, hsl(0 0% 0% / 0.92) 0 6px, hsl(0 0% 0% / 0.78) 6px 7px), radial-gradient(circle at 35% 30%, hsl(0 0% 100% / 0.18), transparent 55%)",
              }}
            >
              {/* Center label */}
              <div
                className="absolute inset-[34%] rounded-full flex items-center justify-center"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, hsl(48 100% 75%), hsl(18 100% 58%) 60%, hsl(330 90% 48%))",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.4) inset",
                }}
              >
                <div className="h-[18%] w-[18%] rounded-full bg-black/80" />
              </div>
              {/* Specular sheen */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(0 0% 100% / 0.18) 0%, transparent 35%, transparent 65%, hsl(0 0% 100% / 0.08) 100%)",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Oversized glyph — hidden for audio (vinyl is the hero) */}
      {!isAudioVisual && (
        <v.Icon
          aria-hidden
          className="absolute -right-6 -top-6 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 mix-blend-overlay"
          style={{ color: v.glyph, opacity: imageLoaded ? 0.16 : 0.78, width: "10rem", height: "10rem" }}
          strokeWidth={1.5}
        />
      )}
      {!hideCaption && (
        <>
          {/* Bottom gradient scrim for legibility */}
          <div className={`absolute inset-x-0 bottom-0 h-2/3 pointer-events-none transition-opacity duration-300 ${imageLoaded ? "bg-gradient-to-t from-black/70 via-black/25 to-transparent opacity-100" : "bg-gradient-to-t from-black/55 via-black/15 to-transparent opacity-100"}`} />

          <div className="relative z-10 text-left">
            <p className="font-display font-bold text-white leading-tight line-clamp-3 text-sm drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              {title}
            </p>
            {description && (
              <p className="text-[10px] text-white/75 line-clamp-2 mt-1.5 font-body drop-shadow">
                {description}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FlowThumbnail;
