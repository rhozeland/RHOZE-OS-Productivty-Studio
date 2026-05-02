/**
 * FeaturedCarousel — auto-advancing hero shuffle for Discover.
 *
 * Pulls one featured Artist + featured Event + featured Space and cycles
 * through them every 6 seconds. Pauses on hover. Each slide is fully
 * clickable and styled per type; region pin via the active globe selection
 * passes through here so an artist slide can show a region chip.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Calendar, MapPin, Sparkles, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import RegionChip from "@/components/profile/RegionChip";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { FeaturedSlide } from "./useDiscoverFeatured";
import { ROLE_BY_ID } from "@/lib/creator-roles";
import { avatarGradientFor } from "@/lib/avatar-gradient";

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "·";

interface FeaturedCarouselProps {
  slides: FeaturedSlide[];
}

const FeaturedCarousel = ({ slides }: FeaturedCarouselProps) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearTimeout(t);
  }, [index, paused, slides.length]);

  // Keep index in bounds when slides change.
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  if (slides.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 bg-card/40 p-8 text-center h-[360px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Featured slots filling up — check back soon.</p>
      </div>
    );
  }

  const current = slides[index];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative h-[360px] rounded-3xl overflow-hidden border border-border/60 bg-card group"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.kind}-${current.id}`}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {current.banner ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${current.banner})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-accent/10 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />

          <Link to={current.href} className="relative h-full flex flex-col justify-end p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-background/60 backdrop-blur">
                {current.kind === "artist" && <><Sparkles className="h-2.5 w-2.5 mr-1" /> Featured artist</>}
                {current.kind === "event" && <><Calendar className="h-2.5 w-2.5 mr-1" /> Featured event</>}
                {current.kind === "space" && <><Users className="h-2.5 w-2.5 mr-1" /> Featured space</>}
              </Badge>
              {current.kind === "artist" && current.region_code && (
                <RegionChip code={current.region_code} size="sm" showLabel />
              )}
              {current.kind === "event" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-foreground/80 bg-background/60 backdrop-blur px-2 py-0.5 rounded-full">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(current.starts_at), "MMM d · h:mm a")}
                </span>
              )}
              {current.kind === "space" && current.location && (
                <span className="inline-flex items-center gap-1 text-[11px] text-foreground/80 bg-background/60 backdrop-blur px-2 py-0.5 rounded-full">
                  <MapPin className="h-3 w-3" /> {current.location}
                </span>
              )}
            </div>

            <div className="flex items-end gap-4">
              {current.kind === "artist" && (
                <Avatar className="h-16 w-16 border-2 border-background shadow-lg shrink-0">
                  <AvatarImage src={current.avatar ?? undefined} />
                  <AvatarFallback className="text-lg font-bold">
                    {initials(current.title)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-2xl sm:text-3xl font-semibold text-foreground line-clamp-1">
                  {current.title}
                </h3>
                {current.kind === "artist" && current.creator_roles?.length ? (
                  <p className="text-[11px] font-medium text-foreground/80 mt-0.5 line-clamp-1">
                    {current.creator_roles.slice(0, 2).map((id) => {
                      const role = ROLE_BY_ID.get(id);
                      return role ? `${role.emoji} ${role.label}` : id;
                    }).join(" · ")}
                  </p>
                ) : null}
                {current.subtitle && (
                  <p className="text-sm text-foreground/80 line-clamp-2 mt-1 max-w-2xl italic">
                    {current.kind === "artist" ? `"${current.subtitle}"` : current.subtitle}
                  </p>
                )}
                <span className="mt-3 inline-flex items-center text-xs font-medium text-foreground gap-1 group-hover:gap-2 transition-all">
                  Open <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-foreground" : "w-1.5 bg-foreground/40 hover:bg-foreground/70",
              )}
              aria-label={`Show slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeaturedCarousel;
