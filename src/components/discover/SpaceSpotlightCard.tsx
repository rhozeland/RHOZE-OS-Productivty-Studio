/**
 * SpaceSpotlightCard — compact spotlight layout sized to match artist/event.
 *
 * Keeps a wide 16:9 hero, but condenses the body so the overall card height
 * sits closer to the other featured spotlight cards.
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
      {/* Wide 16:9 hero photo */}
      <div
        className="relative w-full aspect-[16/9] overflow-hidden"
        style={{ background: grad.background }}
      >
        {banner ? (
          <img
            src={banner}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        {/* Top chips overlay */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-background">
            <Sparkles className="h-3 w-3" /> Featured space
          </span>
          {region_code && <RegionChip code={region_code} size="sm" showLabel />}
          {category && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/80 backdrop-blur-md">
              <Mic2 className="h-3 w-3" /> {category}
            </span>
          )}
        </div>

        {/* Price pill bottom-right */}
        {rate && (
          <div className="absolute bottom-3 right-3 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-semibold backdrop-blur-md shadow-sm">
            {rate}<span className="text-muted-foreground font-normal"> /hr</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-3 space-y-2.5">
        <div>
          <h3 className="font-display text-lg md:text-xl leading-tight text-foreground line-clamp-2">
            {title}
          </h3>
          {location && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium line-clamp-1">{location}</span>
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 divide-x divide-border/40 rounded-2xl border border-border/40 bg-background/40">
          <div className="flex flex-col items-center justify-center py-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              Days/wk
            </span>
            <span className="text-sm font-semibold text-foreground">
              {available_days ?? 0}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              Capacity
            </span>
            <span className="text-sm font-semibold text-foreground">
              {max_guests ?? "—"}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-1.5">
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
          <p className="text-[11px] leading-5 text-muted-foreground line-clamp-2">
            {subtitle}
          </p>
        )}
      </div>

      <div className="border-t border-border/40 px-4 py-2.5 text-center">
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
