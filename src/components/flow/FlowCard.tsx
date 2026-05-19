import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Play, FileText, ExternalLink, ChevronDown, Music, Palette, Camera, Video, PenTool, Heart, MessageCircle, Send, Maximize2, X, Trash2, Fingerprint } from "lucide-react";
import AudioPreview from "@/components/marketplace/AudioPreview";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useFlowCardPrefs } from "@/hooks/useFlowCardPrefs";
import VerifyWorkDialog from "@/components/works/VerifyWorkDialog";
import FlowUnlockGate from "@/components/flow/FlowUnlockGate";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import { ShieldCheck } from "lucide-react";

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

// Stronger contrast than the previous /15 alpha tints so the genre badge
// stays legible even when the card sits on a colored swipe background.
const CATEGORY_COLORS: Record<string, string> = {
  music: "bg-pink/90 text-white",
  design: "bg-teal/90 text-white",
  photo: "bg-warm/90 text-white",
  video: "bg-accent/90 text-white",
  writing: "bg-foreground/85 text-background",
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
    // Verified-IP lifecycle (Phase 1+ of the Works/Flow bridge). Optional
    // so tests and seed data without these columns still render cleanly.
    content_hash?: string | null;
    solana_signature?: string | null;
    verification_status?:
      | "none"
      | "pending"
      | "verified"
      | "rejected"
      | "changes_requested"
      | null;
    work_id?: string | null;
  };
  expanded: boolean;
  onToggleExpand: () => void;
  /** Up-swipe / heart button. Toggles like state on the item. */
  onLike: () => void;
  /** Down-swipe / message button. Opens the comment thread sheet. */
  onComment: () => void;
  /** Send-icon button (no longer a swipe). Opens the share-to-DM dialog. */
  onShare: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
  isAdmin?: boolean;
  /** Whether the current user has liked this item (drives heart fill). */
  liked?: boolean;
  /** Cached counts for like/comment buttons. */
  likeCount?: number;
  commentCount?: number;
  /**
   * True while uploader profile attribution (`profiles_public`) is still
   * being resolved. When true and no profile is attached yet, the card
   * renders a skeleton placeholder instead of a flash of "Unknown".
   */
  profilesLoading?: boolean;
  /**
   * If a coin already exists for this Flow item's underlying Verified IP
   * work, pass it in to render the "$TICKER → speculate" pill. Lookup is
   * batched at the page level via `useFlowCoinsByWork` so cards stay cheap.
   */
  coin?: { id: string; ticker: string } | null;
}

const FlowCard = ({ item, expanded, onToggleExpand, onLike, onComment, onShare, onDelete, isOwner, isAdmin, liked, likeCount, commentCount, profilesLoading, coin }: FlowCardProps) => {
  const navigate = useNavigate();
  const [imageEnlarged, setImageEnlarged] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  // Per-card click cooldowns prevent like/unlike or send-spam mashing.
  // Cheap client-side rate limit on top of the server-side reward cap.
  const lastLikeAt = useRef(0);
  const lastShareAt = useRef(0);
  const [likePulse, setLikePulse] = useState(0);
  // Visual cooldown after a tap so users immediately see the action registered
  // and can't second-guess whether their tap landed. Mirrors the 400ms
  // server/throttle window in onLike() below.
  const [likeCooling, setLikeCooling] = useState(false);
  // Respect the OS-level "Reduce Motion" preference. When true we collapse
  // expressive scale/translate keyframes down to simple opacity changes so
  // vestibular-sensitive users get the same affordances without the bounce.
  const prefersReducedMotion = useReducedMotion();
  const canApplyForVerification =
    !!isOwner &&
    item.verification_status !== "verified" &&
    item.verification_status !== "pending" &&
    (!!item.file_url || !!(item as any).work_id);
  const cardPrefs = useFlowCardPrefs();
  const platform = detectPlatform(item.link_url);
  const CatIcon = CATEGORY_ICONS[item.category] || Palette;
  const youtubeId = item.link_url ? getYouTubeId(item.link_url) : null;
  const spotifyEmbed = item.link_url ? getSpotifyEmbed(item.link_url) : null;
  const isSoundCloud = item.link_url?.includes("soundcloud.com");
  // A link to a known audio/video platform should always render its embed,
  // regardless of how the uploader tagged the category (e.g. a SoundCloud
  // track mistakenly filed under "design").
  const hasMediaEmbed = !!(youtubeId || spotifyEmbed || isSoundCloud);
  const isAudioPlatform = !!(spotifyEmbed || isSoundCloud) || (!!youtubeId && item.category === "music");

  const isImage =
    (item.content_type === "image" || item.category === "photo" || item.category === "design") &&
    !!item.file_url &&
    !hasMediaEmbed;
  const isAudio =
    item.content_type === "audio" || item.category === "music" || isAudioPlatform;
  const isVideo =
    item.content_type === "video" ||
    item.category === "video" ||
    (!!youtubeId && !isAudioPlatform);
  const isWriting = item.content_type === "text" || item.content_type === "link" || item.category === "writing";

  const showCategoryChip = cardPrefs.badgeVisible && cardPrefs.badgePlacement === "inline";


  return (
    <>
      <motion.div
        // Subtle card entrance — fades + lifts a touch on mount. Reduced
        // motion users get an instant opacity-only fade so nothing slides.
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.18, ease: "linear" }
            : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
        }
        whileHover={prefersReducedMotion ? undefined : { y: -2 }}
        className="relative rounded-[32px] bg-card shadow-2xl shadow-foreground/10 overflow-hidden border border-border/30 select-none"
      >
        <FlowUnlockGate
          artistId={item.user_id}
          artistName={(item as any).profiles?.display_name ?? item.creator_name ?? null}
        >
        {/* Verified-IP watermark — when an asset is anchored on Solana,
            we stamp a translucent fingerprint onto the artwork itself. The
            mark IS the verification signal; no chip / "Verified" text needed
            in the action bar below. mix-blend-overlay keeps it legible on
            both bright and dark imagery. */}
        {item.verification_status === "verified" && (
          <div
            className={cn(
              "pointer-events-none absolute z-10",
              // Responsive offset — hugs the corner tighter on small cards,
              // breathes more on large desktop tiles. Avoids colliding with
              // the Maximize2 enlarge button which sits at top-3/right-3.
              "top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4",
              // For image-led cards (photo / design), nudge the watermark
              // down-left so it stamps onto the artwork rather than the
              // empty corner. For media-embed cards (YouTube/Spotify) the
              // top-right corner is fine since iframes own that area.
              isImage && "sm:top-4 sm:right-4",
            )}
            title="Verified IP — fingerprinted & anchored on Solana"
            aria-label="Verified IP"
          >
            <Fingerprint
              className={cn(
                // Scales with the card: snug on phones, prominent on desktop.
                "h-7 w-7 sm:h-9 sm:w-9 md:h-11 md:w-11 lg:h-12 lg:w-12",
                "text-white/80 mix-blend-overlay",
                "drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]",
              )}
              strokeWidth={1.5}
            />
          </div>
        )}
        {/* ═══ PHOTO / DESIGN — Full image with click to enlarge ═══ */}
        {isImage && item.file_url && (
          <div className="relative group">
            <div className="aspect-[4/5] overflow-hidden bg-muted/20 flex items-center justify-center">
              <img
                src={item.file_url}
                alt={item.title}
                className="h-full w-full object-cover"
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
              <div className="aspect-[4/5] overflow-hidden">
                <div className="h-full w-full">
                  <FlowThumbnail
                    fileUrl={item.file_url}
                    linkUrl={item.link_url}
                    title={item.title}
                    description={item.description}
                    category={item.category}
                    className="h-full w-full p-0"
                    hideCaption
                  />
                </div>
              </div>
                <div className="border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <AudioPreview src={item.file_url} title={item.title} />
                </div>
              </div>
            )}

            {!item.file_url && !spotifyEmbed && !isSoundCloud && !youtubeId && (
              <div className="aspect-[4/5] overflow-hidden">
                <FlowThumbnail
                  linkUrl={item.link_url}
                  title={item.title}
                  description={item.description}
                  category={item.category}
                  className="h-full w-full p-0"
                  hideCaption
                />
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
              <div className="aspect-[4/5] overflow-hidden bg-muted/20 flex items-center justify-center">
                      <img src={item.file_url} alt={item.title} className="h-full w-full object-cover" draggable={false}
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
        </FlowUnlockGate>

        {/* ═══ ACTION BAR ═══
            Minimal: category as icon (text on hover), owner-only Verify icon
            (when eligible), and the like/send cluster. Provenance is now
            communicated by the watermark stamped on the artwork itself, so
            no chip lives here. The $TICKER speculate pill was removed —
            users get to coins via the creator's profile. */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-2 flex-wrap">
          {showCategoryChip && (
            <span
              className="group/cat inline-flex items-center gap-1 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-default"
              title={item.category}
            >
              <CatIcon className="h-3.5 w-3.5" />
              <span className="capitalize max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover/cat:max-w-[80px] group-hover/cat:opacity-100 transition-all duration-200">
                {item.category}
              </span>
            </span>
          )}

          {canApplyForVerification && (
            <button
              onClick={(e) => { e.stopPropagation(); setVerifyOpen(true); }}
              className="group/verify inline-flex items-center gap-1 rounded-full text-emerald-600 dark:text-emerald-400 hover:opacity-80 transition-opacity"
              title="Apply for the Verified IP badge"
              aria-label="Verify this work"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover/verify:max-w-[60px] group-hover/verify:opacity-100 transition-all duration-200">
                Verify
              </span>
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <motion.button
              type="button"
              aria-pressed={!!liked}
              aria-label={liked ? "Unlike this post" : "Like this post"}
              disabled={likeCooling}
              onClick={(e) => {
                e.stopPropagation();
                // 400ms cooldown — blocks rapid like/unlike toggling that
                // would hammer the DB and game the engagement rewards.
                const now = Date.now();
                if (now - lastLikeAt.current < 400) return;
                lastLikeAt.current = now;
                setLikePulse((n) => n + 1);
                setLikeCooling(true);
                window.setTimeout(() => setLikeCooling(false), 400);
                onLike();
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-1 -mx-2 transition-all",
                liked
                  ? "text-rose-500 bg-rose-500/10"
                  : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5",
                likeCooling && "opacity-70 cursor-not-allowed",
              )}
              title={
                likeCooling
                  ? liked
                    ? "Liked — tap again in a moment to unlike"
                    : "Saving like…"
                  : liked
                    ? "Tap to unlike"
                    : "Like"
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
            >
              <motion.span
                key={likePulse}
                initial={{ scale: 1 }}
                animate={
                  prefersReducedMotion
                    ? { scale: 1 }
                    : { scale: liked ? [1, 1.45, 0.92, 1.12, 1] : [1, 1.2, 1] }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: liked ? 0.55 : 0.3, ease: "easeOut" }
                }
                className="inline-flex relative"
              >
                <Heart
                  className={cn(
                    "h-[18px] w-[18px] transition-all",
                    liked && "fill-current drop-shadow-[0_0_6px_rgba(244,63,94,0.55)]",
                  )}
                />
                {/* Tiny floating "+1" confetti — only when transitioning into liked
                    state, and never under reduced motion. Subtle by design. */}
                <AnimatePresence>
                  {liked && !prefersReducedMotion && (
                    <motion.span
                      key={`burst-${likePulse}`}
                      initial={{ opacity: 0, y: 0, scale: 0.6 }}
                      animate={{ opacity: [0, 1, 0], y: -18, scale: 1 }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-rose-500"
                      aria-hidden="true"
                    >
                      ♥
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              <span className="text-[11px] font-semibold tabular-nums">
                {liked
                  ? likeCount && likeCount > 0
                    ? `${likeCount} · Liked`
                    : "Liked"
                  : likeCount && likeCount > 0
                    ? likeCount
                    : "Like"}
              </span>
            </motion.button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // 600ms cooldown so users can't spam the share dialog open.
                const now = Date.now();
                if (now - lastShareAt.current < 600) return;
                lastShareAt.current = now;
                onShare();
              }}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
              title="Send to someone"
            >
              <Send className="h-[18px] w-[18px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              <span className="text-[11px] font-medium">Send</span>
            </button>
            {item.id && (
              <SaveButton type="work" id={item.id} variant="icon" size="sm" />
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
              <span className="text-[11px] font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                {(item as any).profiles?.display_name || "Unknown"}
              </span>
            </button>
          ) : profilesLoading ? (
            // Skeleton placeholder while `profiles_public` is being fetched.
            <div
              className="flex items-center gap-2"
              aria-hidden="true"
              data-testid="flow-card-uploader-skeleton"
            >
              <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-20 rounded-full bg-muted animate-pulse" />
            </div>
          ) : item.user_id ? (
            // Profile genuinely missing (RLS hidden / deleted account, etc.).
            // Still let users tap through to the profile page where the full
            // resolver will surface whatever exists — better than rendering
            // a permanently-empty row that looks like a layout bug.
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/profiles/${item.user_id}`); }}
              className="flex items-center gap-2 group"
              title="View creator"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[8px] bg-muted">
                  {(item.creator_name || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] font-medium text-foreground/70 group-hover:text-foreground transition-colors">
                {item.creator_name || "Unknown creator"}
              </span>
            </button>
          ) : null}
          {item.creator_name && (item as any).profiles && (
            <span className="text-[11px] text-muted-foreground">
              · by <span className="font-medium text-foreground/80">{item.creator_name}</span>
            </span>
          )}
        </div>

        {/* ═══ TITLE + DESCRIPTION ═══ */}
        {!(isWriting && !isAudio && !isVideo && !isImage && !item.file_url && !item.link_url) && (
          <div className="px-5 pb-5">
            <h3 className="font-display font-bold text-foreground text-sm md:text-base leading-snug">{item.title}</h3>
            {item.description && (
              <p
                className={`text-[13px] text-foreground/75 leading-relaxed mt-1 cursor-pointer ${expanded ? "" : "line-clamp-2"}`}
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
      </motion.div>

      {/* ═══ VERIFY-IP DIALOG (owner only) ═══ */}
      {isOwner && (
        <VerifyWorkDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          flowItem={{
            id: item.id,
            user_id: item.user_id,
            title: item.title,
            description: item.description,
            file_url: item.file_url,
            content_hash: item.content_hash,
            work_id: (item as any).work_id ?? null,
          }}
        />
      )}

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
