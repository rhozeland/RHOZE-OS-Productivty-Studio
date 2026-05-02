/**
 * ArtistSpotlightCard — bespoke editorial layout for the Featured Artist slot.
 *
 * Distinct from event/space cards (which lead with a wide banner). Here the
 * avatar is the hero — large, centered, surrounded by their identity tags
 * (roles, region, verified) and a stat strip (works · followers · joined).
 * Slogan reads as a pulled quote underneath. The whole card is editorial,
 * type-led, and never empty: even a brand-new artist gets a strong-looking
 * card via the avatar-derived gradient halo.
 */
import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, Hash, Users as UsersIcon, FileImage } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import RegionChip from "@/components/profile/RegionChip";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import { ROLE_BY_ID } from "@/lib/creator-roles";
import { avatarGradientFor } from "@/lib/avatar-gradient";

interface Props {
  id: string;
  href: string;
  title: string;
  subtitle?: string | null;
  avatar?: string | null;
  region_code?: string | null;
  creator_roles?: string[] | null;
  mediums?: string[] | null;
  verification_status?: string | null;
  works_count?: number;
  followers_count?: number;
}

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

const ArtistSpotlightCard = ({
  id,
  href,
  title,
  subtitle,
  avatar,
  region_code,
  creator_roles,
  mediums,
  verification_status,
  works_count = 0,
  followers_count = 0,
}: Props) => {
  const grad = avatarGradientFor(id);
  const roleLabels = (creator_roles ?? [])
    .slice(0, 3)
    .map((rid) => ROLE_BY_ID.get(rid))
    .filter(Boolean) as { label: string; emoji: string }[];

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-border/45 bg-card/75">
      {/* Header strip — flag, badge, kind chip */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-4">
        <span className="inline-flex items-center gap-1 rounded-full border border-border/45 bg-background/72 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-foreground backdrop-blur-md">
          <Sparkles className="h-3 w-3" /> Featured artist
        </span>
        {region_code && <RegionChip code={region_code} size="sm" showLabel />}
        {verification_status === "verified" && (
          <VerifiedArtistBadge status="verified" size="xs" showLabel={false} />
        )}
      </div>

      {/* Avatar hero — the gradient halo guarantees presence even with no banner */}
      <div className="relative px-4 pt-6 pb-5">
        <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-80"
            style={{ background: grad.background }}
            aria-hidden
          />
          <Avatar className="relative h-32 w-32 border-2 border-background shadow-[0_18px_48px_hsl(var(--background)/0.45)]">
            <AvatarImage src={avatar ?? undefined} className="object-cover" />
            <AvatarFallback className="text-3xl font-display">{initials(title)}</AvatarFallback>
          </Avatar>
        </div>

        <h3 className="mt-4 text-center font-display text-3xl leading-tight text-foreground">
          {title}
        </h3>

        {/* Roles row */}
        {roleLabels.length > 0 ? (
          <p className="mt-1.5 text-center text-[12px] font-medium text-foreground/80 line-clamp-1">
            {roleLabels.map((r) => `${r.emoji} ${r.label}`).join(" · ")}
          </p>
        ) : mediums?.length ? (
          <p className="mt-1.5 text-center text-xs text-muted-foreground line-clamp-1">
            {mediums.slice(0, 3).join(" · ")}
          </p>
        ) : null}

        {/* Slogan — only if present */}
        {subtitle && (
          <p className="mt-3 text-center text-sm italic leading-6 text-foreground/72 line-clamp-2 max-w-[28ch] mx-auto">
            “{subtitle}”
          </p>
        )}
      </div>

      {/* Stat strip — divider line, three columns */}
      <div className="grid grid-cols-3 divide-x divide-border/40 border-t border-border/40 bg-background/30">
        <Stat icon={<FileImage className="h-3.5 w-3.5" />} value={works_count} label={works_count === 1 ? "work" : "works"} />
        <Stat icon={<UsersIcon className="h-3.5 w-3.5" />} value={followers_count} label={followers_count === 1 ? "follower" : "followers"} />
        <Stat icon={<Hash className="h-3.5 w-3.5" />} value={(creator_roles?.length ?? 0)} label={(creator_roles?.length ?? 0) === 1 ? "role" : "roles"} />
      </div>

      <div className="border-t border-border/40 px-4 py-3">
        <Link
          to={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-transform hover:translate-x-0.5"
        >
          View profile <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};

const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) => (
  <div className="flex flex-col items-center justify-center py-3 text-center">
    <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      {icon}
      {label}
    </span>
    <span className="mt-0.5 font-display text-xl text-foreground">{value}</span>
  </div>
);

export default ArtistSpotlightCard;
