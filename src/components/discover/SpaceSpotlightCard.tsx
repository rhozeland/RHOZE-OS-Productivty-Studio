/**
 * SpaceSpotlightCard — info-rich layout for the Featured Space slot.
 *
 * Distinct from artist (avatar-led) and event (date-led) cards. Leads with
 * a small banner ribbon and emphasises what people book on: location,
 * hourly rate, capacity, days available per week, and key amenities.
 */
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Mic2,
  MapPin,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import RegionChip from "@/components/profile/RegionChip";
import { avatarGradientFor } from "@/lib/avatar-gradient";

interface Props {
  id: string;
  href: string;
  title: string;
  subtitle?: string | null;
  banner?: string | null;
  location?: string | null;
  region_code?: string | null;
  category?: string | null;
  hourly_rate?: number | null;
  currency?: string | null;
  max_guests?: number | null;
  amenities?: string[] | null;
  rating_avg?: number | null;
  review_count?: number | null;
  available_days?: number | null;
}

const formatRate = (rate?: number | null, cur?: string | null) => {
  if (rate == null) return null;
  const code = (cur ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(Number(rate));
  } catch {
    return `$${rate}`;
  }
};

const SpaceSpotlightCard = ({
  id,
  href,
  title,
  subtitle,
  banner,
  location,
  region_code,
  category,
  hourly_rate,
  currency,
  max_guests,
  amenities,
  rating_avg,
  review_count,
  available_days,
}: Props) => {
  const grad = avatarGradientFor(id);
  const rate = formatRate(hourly_rate, currency);
  const topAmenities = (amenities ?? []).filter(Boolean).slice(0, 3);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/45 bg-card/75">
      {/* Header chips */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-background">
          <Sparkles className="h-3 w-3" /> Featured space
        </span>
        {region_code && <RegionChip code={region_code} size="sm" showLabel />}
        {category && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/45 bg-background/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/80 backdrop-blur-md">
            <Mic2 className="h-3 w-3" /> {category}
          </span>
        )}
      </div>

      {/* Body — portrait photo on the LEFT, info on the RIGHT */}
      <div className="grid grid-cols-[auto_1fr] gap-4 px-4 pt-4 pb-4 items-start">
        {/* Portrait photo (9:16) */}
        <div className="relative w-[120px] sm:w-[140px] aspect-[9/16] shrink-0 overflow-hidden rounded-2xl border border-border/45 bg-muted">
          {banner ? (
            <img
              src={banner}
              alt={title}
              className="h-full w-full object-cover"
              style={{ objectPosition: "center" }}
            />
          ) : (
            <div className="absolute inset-0" style={{ background: grad.background }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent pointer-events-none" />
          {rate && (
            <div className="absolute bottom-2 left-2 right-2 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-center text-[11px] font-semibold backdrop-blur-md">
              {rate}<span className="text-muted-foreground font-normal"> /hr</span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="font-display text-xl md:text-2xl leading-tight text-foreground line-clamp-2">
              {title}
            </h3>
            {location && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium line-clamp-1">{location}</span>
              </div>
            )}
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 divide-x divide-border/40 rounded-2xl border border-border/40 bg-background/40">
            <div className="flex flex-col items-center justify-center py-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                Days/wk
              </span>
              <span className="text-sm font-semibold text-foreground">
                {available_days ?? 0}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                Capacity
              </span>
              <span className="text-sm font-semibold text-foreground">
                {max_guests ?? "—"}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center py-2">
              <Star className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                Rating
              </span>
              <span className="text-sm font-semibold text-foreground">
                {rating_avg && Number(rating_avg) > 0
                  ? `${Number(rating_avg).toFixed(1)}${review_count ? ` (${review_count})` : ""}`
                  : "New"}
              </span>
            </div>
          </div>

          {topAmenities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {topAmenities.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center rounded-full border border-border/45 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {a}
                </span>
              ))}
            </div>
          )}

          {subtitle && (
            <p className="text-xs leading-5 text-muted-foreground line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-border/40 px-4 py-3 text-center">
        <Link
          to={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-transform hover:translate-x-0.5"
        >
          View space <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

export default SpaceSpotlightCard;
