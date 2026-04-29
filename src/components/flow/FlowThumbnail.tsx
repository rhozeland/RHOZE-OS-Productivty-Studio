import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDirectThumbnail, needsRemoteThumbnail } from "@/lib/link-thumbnail";

interface Props {
  fileUrl?: string | null;
  linkUrl?: string | null;
  title: string;
  description?: string | null;
  className?: string;
}

/**
 * Renders the best available thumbnail for a flow item:
 * 1. Uploaded file_url (image)
 * 2. YouTube auto-thumbnail derived from link_url
 * 3. og:image fetched via fetch-link-metadata for Spotify/SoundCloud/etc.
 * 4. Gradient fallback with title text.
 */
export const FlowThumbnail = ({
  fileUrl,
  linkUrl,
  title,
  description,
  className = "",
}: Props) => {
  // Direct (sync) options first
  const direct = fileUrl || getDirectThumbnail(linkUrl);
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

  return (
    <div className="w-full h-full bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center p-4">
      <p className="text-xs text-center text-muted-foreground line-clamp-6 font-body">
        {description || title}
      </p>
    </div>
  );
};

export default FlowThumbnail;
