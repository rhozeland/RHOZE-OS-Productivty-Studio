/**
 * Derive a thumbnail image URL from a media link.
 * Returns a direct URL synchronously when possible (YouTube),
 * otherwise null — caller should fall back to the link-metadata
 * edge function to fetch og:image.
 */
export function getDirectThumbnail(url?: string | null): string | null {
  if (!url) return null;
  // YouTube
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([A-Za-z0-9_-]{11})/,
  );
  if (yt?.[1]) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
  // Vimeo, Spotify, SoundCloud need an oEmbed/og:image lookup — handled by
  // the `fetch-link-metadata` edge function. Return null here.
  return null;
}

export function needsRemoteThumbnail(url?: string | null): boolean {
  if (!url) return false;
  if (getDirectThumbnail(url)) return false;
  return /spotify\.com|soundcloud\.com|vimeo\.com|bandcamp\.com|apple\.com\/music/.test(url);
}
