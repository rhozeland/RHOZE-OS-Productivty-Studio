/**
 * PinnedAnnouncementCard — highlighted pinned update on a profile.
 * Renders above Reputation signals. Returns null if no announcement is pinned.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, ExternalLink, Pin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

const PinnedAnnouncementCard = ({ userId }: { userId: string }) => {
  const { data } = useQuery({
    queryKey: ["pinned-announcement", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_announcements" as any)
        .select("id, body, image_url, link_url, published_at, pinned_at")
        .eq("user_id", userId)
        .eq("is_pinned", true)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  if (!data) return null;

  return (
    <div className="mt-4 rounded-2xl border border-foreground/15 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-fuchsia-500/10 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          <Pin className="h-3 w-3" />
          Pinned update
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(data.published_at), { addSuffix: true })}
        </span>
      </div>
      <p className="text-[15px] leading-snug font-medium text-foreground whitespace-pre-wrap">
        {data.body}
      </p>
      {data.link_url && (
        <a
          href={data.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          <span className="truncate max-w-[280px]">{data.link_url}</span>
        </a>
      )}
      {data.image_url && (
        <img
          src={data.image_url}
          alt=""
          className="mt-3 w-full max-h-72 object-cover rounded-xl border border-border"
        />
      )}
      <Link
        to={`/profiles/${userId}?tab=updates`}
        className="mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <Megaphone className="h-3 w-3" /> All updates
      </Link>
    </div>
  );
};

export default PinnedAnnouncementCard;
