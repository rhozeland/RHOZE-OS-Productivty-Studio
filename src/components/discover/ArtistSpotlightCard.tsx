/**
 * ArtistSpotlightCard — featured artist spotlight on Discover (v9).
 *
 * Mirrors the v9 profile thesis: one primary "Back {name}" CTA that routes
 * to the profile's Support tab (where SupportCreatorSheet handles every
 * backing path), plus quiet signal chips telling fans what's *actually*
 * happening with this artist right now:
 *
 *   - Event on Fri    (upcoming event hosted by them)
 *   - Hosts: Studio 7 (an active space they own)
 *   - Shares live     (active artist coin)
 *   - N works
 *
 * No more stacked Book/Message/Shop buttons — that lived in v8.9 and was
 * the exact clutter the creator-first refocus is fixing.
 */
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Sparkles,
  TrendingUp,
  Library,
} from "lucide-react";
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
  coin?: { id: string; ticker: string; name: string | null; image_url: string | null } | null;
  next_event?: { id: string; slug: string | null; title: string; starts_at: string; cover_url: string | null } | null;
  hosted_space?: { id: string; name: string; cover_image_url: string | null } | null;
  offerings_count?: number;
}

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

const firstName = (name: string) => name.split(/\s+/)[0] || name;

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
  coin,
  next_event,
  hosted_space,
}: Props) => {
  const navigate = useNavigate();
  const grad = avatarGradientFor(id);
  const roleLabels = (creator_roles ?? [])
    .slice(0, 3)
    .map((rid) => ROLE_BY_ID.get(rid))
    .filter(Boolean) as { label: string; emoji: string }[];

  // Secondary signal chips (no event/space — those get their own visual tiles below)
  const signals: { key: string; icon: typeof Calendar; label: string }[] = [];
  if (coin) {
    signals.push({ key: "shares", icon: TrendingUp, label: "Shares live" });
  }
  if (works_count > 0) {
    signals.push({
      key: "works",
      icon: Library,
      label: `${works_count} ${works_count === 1 ? "work" : "works"}`,
    });
  }

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Land on the profile Support tab — SupportCreatorSheet auto-opens via ?back=1
    navigate(`${href}?tab=support&back=1`);
  };

  return (
    <Link
      to={href}
      className="group block overflow-hidden rounded-[1.5rem] border border-border/45 bg-card/75 transition-all hover:border-foreground/40 hover:shadow-[0_18px_48px_hsl(var(--background)/0.45)] focus:outline-none focus:ring-2 focus:ring-primary/40"
      aria-label={`View ${title}'s profile`}
    >
      {/* Header strip — featured chip + region */}
      <div className="flex flex-wrap items-center gap-1.5 px-5 pt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-background">
          <Sparkles className="h-3 w-3" /> Featured creator
        </span>
        {region_code && <RegionChip code={region_code} size="sm" showLabel />}
      </div>

      {/* Avatar hero */}
      <div className="px-5 pt-6 pb-5">
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-80"
            style={{ background: grad.background }}
            aria-hidden
          />
          <Avatar className="relative h-28 w-28 border-2 border-background shadow-[0_18px_48px_hsl(var(--background)/0.45)]">
            <AvatarImage src={avatar ?? undefined} className="object-cover" />
            <AvatarFallback className="text-3xl font-display">{initials(title)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          <h3 className="font-display text-2xl leading-tight text-foreground line-clamp-1">
            {title}
          </h3>
          {verification_status === "verified" && (
            <VerifiedArtistBadge status="verified" size="xs" showLabel={false} />
          )}
        </div>

        {roleLabels.length > 0 ? (
          <p className="mt-1.5 text-center text-[12px] font-medium text-foreground/80 line-clamp-1">
            {roleLabels.map((r) => `${r.emoji} ${r.label}`).join(" · ")}
          </p>
        ) : mediums?.length ? (
          <p className="mt-1.5 text-center text-xs text-muted-foreground line-clamp-1">
            {mediums.slice(0, 3).join(" · ")}
          </p>
        ) : null}

        {subtitle && (
          <p className="mt-2 text-center text-[12px] italic text-muted-foreground line-clamp-2">
            "{subtitle}"
          </p>
        )}

        {/* Signal chips — only render what's real */}
        {signals.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {signals.map((s) => {
              const Icon = s.icon;
              return (
                <span
                  key={s.key}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] text-foreground/85"
                >
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  {s.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Primary CTA */}
      <div className="border-t border-border/40 bg-background/40 px-5 py-4">
        <button
          type="button"
          onClick={handleBack}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          Back {firstName(title)}
          <ArrowUpRight className="h-4 w-4" />
        </button>
        <span className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          or tap card to view profile
        </span>
      </div>
    </Link>
  );
};

export default ArtistSpotlightCard;
