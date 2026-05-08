/**
 * EventSpotlightCard — date-led layout for the Featured Event slot.
 *
 * Distinct from the artist card (avatar-led) and space card (location-led).
 * The thumbnail is small and decorative — the date block, time, and venue
 * carry the visual weight, since that's what people actually decide on.
 */
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, Globe2, MapPin, Sparkles, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import RegionChip from "@/components/profile/RegionChip";
import { avatarGradientFor } from "@/lib/avatar-gradient";
import { useEventsCta } from "@/hooks/useEventsCta";

interface Props {
  id: string;
  href: string;
  title: string;
  subtitle?: string | null;
  banner?: string | null;
  starts_at: string;
  venue?: string | null;
  is_online?: boolean;
  region_code?: string | null;
}

const EventSpotlightCard = ({
  id,
  href,
  title,
  subtitle,
  banner,
  starts_at,
  venue,
  is_online,
  region_code,
}: Props) => {
  const grad = avatarGradientFor(id);
  const start = new Date(starts_at);
  const { data: ctaMap } = useEventsCta([id]);
  const cta = ctaMap?.get(id);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/45 bg-card/75">
      {/* Header chips */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-background">
          <Sparkles className="h-3 w-3" /> Featured event
        </span>
        {region_code && <RegionChip code={region_code} size="sm" showLabel />}
      </div>

      {/* Body — content on the LEFT, portrait poster on the RIGHT */}
      <div className="grid grid-cols-[1fr_auto] gap-4 px-4 pt-4 pb-4 items-start">
        <div className="min-w-0 space-y-3">
          {/* Date hero tile */}
          <div className="inline-flex h-[72px] w-[72px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-background to-background/40 shadow-sm">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {format(start, "MMM")}
            </span>
            <span className="mt-0.5 font-display text-2xl font-bold leading-none text-foreground">
              {format(start, "d")}
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
              {format(start, "EEE")}
            </span>
          </div>

          <h3 className="font-display text-xl md:text-2xl leading-tight text-foreground line-clamp-2">
            {title}
          </h3>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium">{format(start, "h:mm a")}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{format(start, "EEEE")}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-foreground">
              {is_online ? (
                <Globe2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              ) : (
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <span className="font-medium line-clamp-1">
                {is_online ? "Online event" : (venue || "Venue TBA")}
              </span>
            </div>
          </div>

          {subtitle && (
            <p className="text-xs leading-5 text-muted-foreground line-clamp-3">
              {subtitle}
            </p>
          )}
        </div>

        {/* Portrait poster — 9:16 frame, image rendered with object-contain
            so the full uploaded composition is visible (no crop/zoom-fill).
            Background uses the avatar gradient as a passe-partout. */}
        <div
          className="relative w-[120px] sm:w-[140px] aspect-[9/16] shrink-0 overflow-hidden rounded-2xl border border-border/45"
          style={{ background: grad.background }}
        >
          {banner ? (
            <img
              src={banner}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </div>
      </div>

      <div className="border-t border-border/40 px-4 py-3 text-center">
        <Link
          to={href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-transform hover:translate-x-0.5"
        >
          {cta?.kind === "registered" ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Registered ✓
            </>
          ) : (
            <>
              {cta?.label ?? "View event"} <ArrowUpRight className="h-4 w-4" />
            </>
          )}
        </Link>
      </div>
    </div>
  );
};

export default EventSpotlightCard;
