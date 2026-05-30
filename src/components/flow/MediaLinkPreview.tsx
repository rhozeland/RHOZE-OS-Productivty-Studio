import LinkPreviewCard from "@/components/flow/LinkPreviewCard";

/**
 * MediaLinkPreview — Instagram/Twitter-style live embed preview for the Flow composer.
 * Supports: YouTube, Vimeo, Spotify, SoundCloud, Apple Music, raw images.
 * Falls back to <LinkPreviewCard /> for generic URLs.
 */
export default function MediaLinkPreview({ url }: { url: string }) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const isImage = /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(trimmed);
  const yt = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  const vimeo = trimmed.match(/vimeo\.com\/(\d+)/);
  const spotify = trimmed.match(/open\.spotify\.com\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
  const soundcloud = /soundcloud\.com\//i.test(trimmed);
  const apple = trimmed.match(/^https?:\/\/(?:music|embed\.music)\.apple\.com\/(.+)$/i);

  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
      {isImage && (
        <img
          src={trimmed}
          alt="link preview"
          className="w-full max-h-72 object-contain bg-background"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {!isImage && yt && (
        <div className="aspect-video bg-background">
          <iframe
            src={`https://www.youtube.com/embed/${yt[1]}`}
            title="YouTube preview"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {!isImage && !yt && vimeo && (
        <div className="aspect-video bg-background">
          <iframe
            src={`https://player.vimeo.com/video/${vimeo[1]}`}
            title="Vimeo preview"
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {!isImage && !yt && !vimeo && spotify && (
        <iframe
          src={`https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`}
          title="Spotify preview"
          className="w-full"
          style={{ height: spotify[1] === "track" || spotify[1] === "episode" ? 152 : 380 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}
      {!isImage && !yt && !vimeo && !spotify && soundcloud && (
        <iframe
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&visual=true`}
          title="SoundCloud preview"
          className="w-full"
          style={{ height: 166 }}
          allow="autoplay"
          loading="lazy"
        />
      )}
      {!isImage && !yt && !vimeo && !spotify && !soundcloud && apple && (
        <iframe
          src={`https://embed.music.apple.com/${apple[1]}`}
          title="Apple Music preview"
          className="w-full"
          style={{ height: 175 }}
          allow="autoplay *; encrypted-media *; clipboard-write"
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          loading="lazy"
        />
      )}
      {!isImage && !yt && !vimeo && !spotify && !soundcloud && !apple && (
        <LinkPreviewCard url={trimmed} />
      )}
    </div>
  );
}
