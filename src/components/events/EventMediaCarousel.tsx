/**
 * EventMediaCarousel — public swipeable gallery shown on the event detail
 * page below "Going". Renders images and videos uploaded via Manage → Media.
 */
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  eventId: string;
}

const EventMediaCarousel = ({ eventId }: Props) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: media = [] } = useQuery({
    queryKey: ["event-media", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("event_media")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!media.length) return null;

  const scrollBy = (dx: number) => scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Gallery
        </h2>
        {media.length > 2 && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => scrollBy(-320)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(320)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {media.map((m: any) => (
          <div
            key={m.id}
            className="relative h-56 w-72 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-muted"
          >
            {m.media_type === "video" ? (
              <video
                src={m.url}
                poster={m.thumbnail_url ?? undefined}
                controls
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={m.url}
                alt={m.caption ?? "Event media"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
            {m.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white">
                {m.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default EventMediaCarousel;
