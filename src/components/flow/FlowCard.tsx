import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, FileText, Share2, ExternalLink, ChevronDown, Music, Palette, Camera, Video, PenTool, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AudioPreview from "@/components/marketplace/AudioPreview";

/* ─── Platform detection ─── */
const detectPlatform = (url?: string | null) => {
  if (!url) return null;
  if (url.includes("spotify.com") || url.includes("open.spotify")) return { name: "Spotify", color: "#1DB954", icon: "🎵" };
  if (url.includes("soundcloud.com")) return { name: "SoundCloud", color: "#FF5500", icon: "☁️" };
  if (url.includes("youtube.com") || url.includes("youtu.be")) return { name: "YouTube", color: "#FF0000", icon: "▶" };
  if (url.includes("vimeo.com")) return { name: "Vimeo", color: "#1AB7EA", icon: "▶" };
  if (url.includes("medium.com")) return { name: "Medium", color: "#000000", icon: "M" };
  if (url.includes("substack.com")) return { name: "Substack", color: "#FF6719", icon: "✉" };
  if (url.includes("behance.net")) return { name: "Behance", color: "#1769FF", icon: "Bē" };
  if (url.includes("dribbble.com")) return { name: "Dribbble", color: "#EA4C89", icon: "🏀" };
  if (url.includes("figma.com")) return { name: "Figma", color: "#A259FF", icon: "F" };
  if (url.includes("flickr.com")) return { name: "Flickr", color: "#0063DC", icon: "f" };
  if (url.includes("tiktok.com")) return { name: "TikTok", color: "#000000", icon: "♪" };
  if (url.includes("instagram.com")) return { name: "Instagram", color: "#E4405F", icon: "📷" };
  if (url.includes("twitter.com") || url.includes("x.com")) return { name: "X", color: "#000000", icon: "𝕏" };
  return { name: "Link", color: "hsl(var(--primary))", icon: "🔗" };
};

const getYouTubeId = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match?.[1] || null;
};

const getSpotifyEmbed = (url: string) => {
  // Convert open.spotify.com/track/xxx to embed
  const match = url.match(/spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
  if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  return null;
};

const getSoundCloudEmbed = (url: string) => {
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`;
};

const CATEGORY_ICONS: Record<string, any> = {
  music: Music,
  design: Palette,
  photo: Camera,
  video: Video,
  writing: PenTool,
};

interface FlowCardProps {
  item: {
    id: string;
    title: string;
    description?: string | null;
    category: string;
    content_type: string;
    file_url?: string | null;
    link_url?: string | null;
    tags?: string[] | null;
  };
  expanded: boolean;
  onToggleExpand: () => void;
  onSave: () => void;
  onShare: () => void;
}

const FlowCard = ({ item, expanded, onToggleExpand, onSave, onShare }: FlowCardProps) => {
  const platform = detectPlatform(item.link_url);
  const CatIcon = CATEGORY_ICONS[item.category] || Palette;
  const isImage = item.content_type === "image" || item.category === "photo" || item.category === "design";
  const isAudio = item.content_type === "audio" || item.category === "music";
  const isVideo = item.content_type === "video" || item.category === "video";
  const isWriting = item.content_type === "text" || item.content_type === "link" || item.category === "writing";

  // YouTube embed
  const youtubeId = item.link_url ? getYouTubeId(item.link_url) : null;
  // Spotify embed
  const spotifyEmbed = item.link_url ? getSpotifyEmbed(item.link_url) : null;
  // SoundCloud embed
  const isSoundCloud = item.link_url?.includes("soundcloud.com");

  return (
    <div className="rounded-[20px] bg-card shadow-2xl shadow-foreground/5 overflow-hidden border border-border/40 select-none">
      {/* ═══ PHOTO / DESIGN — Full bleed image ═══ */}
      {isImage && item.file_url && (
        <div className="relative">
          <div className="aspect-[4/5] overflow-hidden">
            <img
              src={item.file_url}
              alt={item.title}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* ═══ MUSIC — Artwork + embedded player ═══ */}
      {isAudio && (
        <div className="relative">
          {/* Spotify embed */}
          {spotifyEmbed && (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <iframe
                src={spotifyEmbed}
                width="100%"
                height="352"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-t-[20px]"
                style={{ borderRadius: "12px 12px 0 0" }}
              />
            </div>
          )}

          {/* SoundCloud embed */}
          {isSoundCloud && item.link_url && !spotifyEmbed && (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <iframe
                width="100%"
                height="300"
                scrolling="no"
                frameBorder="no"
                allow="autoplay"
                src={getSoundCloudEmbed(item.link_url)}
                className="rounded-t-[20px]"
              />
            </div>
          )}

          {/* Uploaded audio with artwork */}
          {item.file_url && !spotifyEmbed && !isSoundCloud && (
            <div className="relative">
              {/* Album art or gradient */}
              <div className="aspect-square overflow-hidden bg-gradient-to-br from-primary/20 via-accent/10 to-muted flex items-center justify-center">
                <div className="text-center">
                  <div className="h-20 w-20 mx-auto rounded-2xl bg-card/30 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg">
                    <Music className="h-10 w-10 text-foreground/60" />
                  </div>
                </div>
              </div>
              {/* Inline audio player */}
              <div className="border-t border-border" onClick={(e) => e.stopPropagation()}>
                <AudioPreview src={item.file_url} title={item.title} />
              </div>
            </div>
          )}

          {/* No file, no embed — just artwork placeholder */}
          {!item.file_url && !spotifyEmbed && !isSoundCloud && (
            <div className="aspect-[4/5] bg-gradient-to-br from-primary/15 via-accent/10 to-muted flex items-center justify-center">
              <div className="text-center p-6">
                <Music className="h-14 w-14 text-foreground/30 mx-auto mb-3" />
                <h2 className="font-display text-xl font-bold text-foreground leading-tight">
                  {item.title}
                </h2>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ VIDEO — YouTube/Vimeo embed or uploaded ═══ */}
      {isVideo && (
        <div className="relative">
          {youtubeId ? (
            <div className="aspect-video" onClick={(e) => e.stopPropagation()}>
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-t-[20px]"
              />
            </div>
          ) : item.file_url ? (
            <div className="aspect-video overflow-hidden bg-foreground/5" onClick={(e) => e.stopPropagation()}>
              <video
                src={item.file_url}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-accent/15 via-muted to-primary/10 flex items-center justify-center">
              <div className="text-center p-6">
                <div className="h-16 w-16 mx-auto rounded-full bg-card/60 backdrop-blur-sm flex items-center justify-center mb-3 shadow-lg">
                  <Play className="h-7 w-7 text-foreground ml-1" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">{item.title}</h2>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ WRITING — Article-style card ═══ */}
      {isWriting && !isAudio && !isVideo && !isImage && (
        <div className="relative">
          {item.file_url ? (
            <div className="aspect-[4/3] overflow-hidden">
              <img src={item.file_url} alt={item.title} className="w-full h-full object-cover" draggable={false} />
            </div>
          ) : (
            <div className="px-6 pt-8 pb-4 min-h-[280px] flex flex-col justify-center">
              <Badge variant="outline" className="w-fit mb-4 capitalize rounded-full text-[10px] tracking-wider">
                {item.category}
              </Badge>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight mb-3">
                {item.title}
              </h2>
              {item.description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                  {item.description}
                </p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {item.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ Fallback for design with no file ═══ */}
      {isImage && !item.file_url && (
        <div className="aspect-[4/5] bg-gradient-to-br from-primary/10 via-accent/5 to-muted flex items-center justify-center p-6">
          <div className="text-center">
            <CatIcon className="h-12 w-12 text-foreground/20 mx-auto mb-4" />
            <Badge variant="outline" className="mb-3 capitalize rounded-full text-[10px]">
              {item.category}
            </Badge>
            <h2 className="font-display text-xl font-bold text-foreground leading-tight">
              {item.title}
            </h2>
          </div>
        </div>
      )}

      {/* ═══ ACTION BAR — Save + Share (always visible) ═══ */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-5">
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Save to board"
        >
          <FileText className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Share"
        >
          <Share2 className="h-5 w-5" />
        </button>

        {/* External link */}
        {item.link_url && (
          <a
            href={item.link_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            title={`Open on ${platform?.name || "web"}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* ═══ TITLE + DESCRIPTION ═══ */}
      {/* For writing cards, title is already shown above; for others, show here */}
      {!(isWriting && !isAudio && !isVideo && !isImage && !item.file_url) && (
        <div className="px-4 pb-3">
          <h3 className="font-display font-bold text-foreground text-sm md:text-base leading-snug">
            {item.title}
          </h3>
          {item.description && (
            <p
              className={`text-sm text-muted-foreground leading-relaxed mt-1 cursor-pointer ${
                expanded ? "" : "line-clamp-2"
              }`}
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            >
              {item.description}
            </p>
          )}
          {item.description && !expanded && item.description.length > 80 && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="flex items-center gap-0.5 mt-1 text-[11px] text-primary hover:underline"
            >
              <ChevronDown className="h-3 w-3" /> more
            </button>
          )}
        </div>
      )}

      {/* ═══ PLATFORM BADGE ═══ */}
      {platform && platform.name !== "Link" && (
        <div className="px-4 pb-4 flex justify-center">
          <a
            href={item.link_url!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span
              className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{ backgroundColor: platform.color + "20", color: platform.color }}
            >
              {platform.icon}
            </span>
            <span className="text-[11px] font-medium">{platform.name}</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default FlowCard;
