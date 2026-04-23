import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, FileText, ExternalLink, ChevronDown, Music, Palette, Camera, Video, PenTool, Bookmark, Send, Maximize2, X, Trash2 } from "lucide-react";
import AudioPreview from "@/components/marketplace/AudioPreview";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useFlowCardPrefs } from "@/hooks/useFlowCardPrefs";
import {
  badgeColorClassFor,
  badgePlacementClassFor,
} from "@/lib/flow-card-prefs";

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
  try {
    const cleaned = decodeURIComponent(url);
    const match = cleaned.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([A-Za-z0-9_-]{11})/);
    return match?.[1] || null;
  } catch {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([A-Za-z0-9_-]{11})/);
    return match?.[1] || null;
  }
};

const getSpotifyEmbed = (url: string) => {
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

const CATEGORY_COLORS: Record<string, string> = {
  music: "bg-pink/15 text-pink",
  design: "bg-teal/15 text-teal",
  photo: "bg-warm/15 text-warm",
  video: "bg-accent/15 text-accent",
  writing: "bg-muted text-muted-foreground",
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
    user_id?: string;
    creator_name?: string | null;
    profiles?: { display_name?: string | null; avatar_url?: string | null } | null;
  };
  expanded: boolean;
  onToggleExpand: () => void;
  onSave: () => void;
  onShare: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
  isAdmin?: boolean;
  /**
   * True while uploader profile attribution (`profiles_public`) is still
   * being resolved. When true and no profile is attached yet, the card
   * renders a skeleton placeholder instead of a flash of "Unknown".
   */
  profilesLoading?: boolean;
}

const FlowCard = ({ item, expanded, onToggleExpand, onSave, onShare, onDelete, isOwner, isAdmin, profilesLoading }: FlowCardProps) => {
  const navigate = useNavigate();
  const [imageEnlarged, setImageEnlarged] = useState(false);
  const platform = detectPlatform(item.link_url);
  const CatIcon = CATEGORY_ICONS[item.category] || Palette;
  const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.writing;
  const isImage = item.content_type === "image" || item.category === "photo" || item.category === "design";
  const isAudio = item.content_type === "audio" || item.category === "music";
  const isVideo = item.content_type === "video" || item.category === "video";
  const isWriting = item.content_type === "text" || item.content_type === "link" || item.category === "writing";

  const youtubeId = item.link_url ? getYouTubeId(item.link_url) : null;
  const spotifyEmbed = item.link_url ? getSpotifyEmbed(item.link_url) : null;
  const isSoundCloud = item.link_url?.includes("soundcloud.com");

  return (
    <>
      <div className="relative rounded-[32px] bg-card/50 backdrop-blur-2xl shadow-2xl shadow-foreground/5 overflow-hidden border border-border/15 select-none">

        {/* ═══ PHOTO / DESIGN — Full image with click to enlarge ═══ */}
        {isImage && item.file_url && (
          <div className="relative group">
            <div className="overflow-hidden bg-muted/20 flex items-center justify-center">
              <img
                src={item.file_url}
                alt={item.title}
                className="w-full max-h-[70vh] object-contain"
                draggable={false}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setImageEnlarged(true); }}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-card/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-border/30"
              title="Enlarge"
            >
              <Maximize2 className="h-3.5 w-3.5 text-foreground" />
            </button>
          </div>
        )}

        {/* ═══ MUSIC — Artwork + embedded player ═══ */}
        {isAudio && (
          <div className="relative">
            {youtubeId && (
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
            )}

            {spotifyEmbed && !youtubeId && (
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

            {isSoundCloud && item.link_url && !spotifyEmbed && !youtubeId && (
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

            {item.file_url && !spotifyEmbed && !isSoundCloud && !youtubeId && (
              <div className="relative">
                <div className="overflow-hidden bg-gradient-to-br from-pink/20 via-accent/10 to-muted flex items-center justify-center min-h-[200px]">
                  <div className="text-center">
                    <div className="h-24 w-24 mx-auto rounded-3xl bg-card/40 backdrop-blur-md flex items-center justify-center mb-4 shadow-2xl border border-border/20">
                      <Music className="h-12 w-12 text-foreground/50" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground px-6">{item.title}</h3>
                  </div>
                </div>
                <div className="border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <AudioPreview src={item.file_url} title={item.title} />
                </div>
              </div>
            )}

            {!item.file_url && !spotifyEmbed && !isSoundCloud && !youtubeId && (
              <div className="min-h-[280px] bg-gradient-to-br from-pink/15 via-accent/10 to-muted flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="h-20 w-20 mx-auto rounded-2xl bg-card/40 backdrop-blur-md flex items-center justify-center mb-4 shadow-xl border border-border/20">
                    <Music className="h-10 w-10 text-foreground/40" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-foreground leading-tight mb-2">{item.title}</h2>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
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
                <video src={item.file_url} controls playsInline preload="metadata" className="w-full h-full object-cover" />
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

        {/* ═══ WRITING — Embedded link preview or rich text card ═══ */}
        {isWriting && !isAudio && !isVideo && !isImage && (
          <div className="relative">
            {item.link_url ? (
              <div className="min-h-[200px] flex flex-col overflow-hidden">
                {/* Embedded article preview */}
                <div className="flex-1 overflow-hidden rounded-t-[20px]" onClick={(e) => e.stopPropagation()}>
                  <iframe
                    src={item.link_url}
                    title={item.title}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    loading="lazy"
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
              </div>
            ) : item.file_url ? (
              <div className="relative group">
              <div className="overflow-hidden bg-muted/20 flex items-center justify-center">
                      <img src={item.file_url} alt={item.title} className="w-full max-h-[60vh] object-contain" draggable={false}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setImageEnlarged(true); }}
                  className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-card/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-border/30"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-foreground" />
                </button>
              </div>
            ) : (
              <div className="px-6 pt-12 pb-4 min-h-[280px] flex flex-col justify-center">
                <div className="mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground/40 mb-3" />
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground leading-tight mb-3">{item.title}</h2>
                {item.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.description}</p>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {item.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Fallback for design with no file ═══ */}
        {isImage && !item.file_url && (
          <div className="min-h-[280px] bg-gradient-to-br from-teal/10 via-accent/5 to-muted flex items-center justify-center p-6">
            <div className="text-center">
              <div className="h-20 w-20 mx-auto rounded-2xl bg-card/40 backdrop-blur-md flex items-center justify-center mb-4 shadow-xl border border-border/20">
                <CatIcon className="h-10 w-10 text-foreground/40" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground leading-tight">{item.title}</h2>
            </div>
          </div>
        )}

        {/* ═══ Category badge + ACTION BAR ═══ */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-3">
          <Badge className={`${catColor} border-0 rounded-full text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 flex items-center gap-1`}>
            <CatIcon className="h-3 w-3" />
            {item.category}
          </Badge>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); onSave(); }}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
              title="Save to board"
            >
              <Bookmark className="h-[18px] w-[18px] group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-medium">Save</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
              title="Send to someone"
            >
              <Send className="h-[18px] w-[18px] group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-medium">Send</span>
            </button>

            {(isOwner || isAdmin) && onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive transition-colors group"
                title={isAdmin && !isOwner ? "Remove (Admin)" : "Delete"}
              >
                <Trash2 className="h-[18px] w-[18px] group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">{isAdmin && !isOwner ? "Remove" : "Delete"}</span>
              </button>
            )}

            {item.link_url && (
              <a
                href={item.link_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                title={`Open on ${platform?.name || "web"}`}
              >
                <ExternalLink className="h-4 w-4" />
                {platform && platform.name !== "Link" && (
                  <span className="text-[11px] font-medium">{platform.name}</span>
                )}
              </a>
            )}
          </div>
        </div>

        {/* ═══ POSTER INFO ═══ */}
        <div className="px-5 pb-1.5 flex items-center gap-2 min-h-[20px]">
          {(item as any).profiles ? (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/profiles/${item.user_id}`); }}
              className="flex items-center gap-2 group"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={(item as any).profiles?.avatar_url || ""} />
                <AvatarFallback className="text-[8px] bg-muted">
                  {((item as any).profiles?.display_name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                {(item as any).profiles?.display_name || "Unknown"}
              </span>
            </button>
          ) : profilesLoading ? (
            // Skeleton placeholder while `profiles_public` is being fetched.
            // Prevents a flash of "Unknown" / blank space before attribution
            // resolves on the next render.
            <div
              className="flex items-center gap-2"
              aria-hidden="true"
              data-testid="flow-card-uploader-skeleton"
            >
              <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-20 rounded-full bg-muted animate-pulse" />
            </div>
          ) : null}
          {item.creator_name && (
            <span className="text-[11px] text-muted-foreground">
              {(item as any).profiles ? "·" : ""} by <span className="font-medium text-foreground/80">{item.creator_name}</span>
            </span>
          )}
        </div>

        {/* ═══ TITLE + DESCRIPTION ═══ */}
        {!(isWriting && !isAudio && !isVideo && !isImage && !item.file_url && !item.link_url) && (
          <div className="px-5 pb-5">
            <h3 className="font-display font-bold text-foreground text-sm md:text-base leading-snug">{item.title}</h3>
            {item.description && (
              <p
                className={`text-sm text-muted-foreground leading-relaxed mt-1 cursor-pointer ${expanded ? "" : "line-clamp-2"}`}
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
      </div>

      {/* ═══ ENLARGED IMAGE DIALOG ═══ */}
      <Dialog open={imageEnlarged} onOpenChange={setImageEnlarged}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-0 shadow-none [&>button]:hidden">
          <div className="relative flex items-center justify-center" onClick={() => setImageEnlarged(false)}>
            <button
              onClick={() => setImageEnlarged(false)}
              className="absolute top-2 right-2 z-20 h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center border border-border/30 hover:bg-card transition-colors"
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
            <img
              src={item.file_url || ""}
              alt={item.title}
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FlowCard;
