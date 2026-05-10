/**
 * ArtistSpotlightCard — featured artist spotlight on Discover.
 *
 * Designed around the v8.9 thesis: the artist is the atomic unit, and this
 * card's job is to surface the *concrete ways someone can back them right
 * now*. Avatar + identity stays editorial, but the bottom half is a tight
 * "Ways to support" action menu — Buy $TICKER, Get tickets, Book, Shop
 * offerings, Message — only the ones that actually exist for this artist.
 */
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Sparkles,
  MessageCircle,
  Coins,
  Ticket,
  Calendar,
  ShoppingBag,
  Heart,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import RegionChip from "@/components/profile/RegionChip";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import { ROLE_BY_ID } from "@/lib/creator-roles";
import { avatarGradientFor } from "@/lib/avatar-gradient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  next_event?: { id: string; slug: string | null; title: string; starts_at: string } | null;
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

interface SupportAction {
  key: string;
  label: string;
  sub?: string;
  icon: typeof Coins;
  href: string;
  primary?: boolean;
  external?: boolean; // navigate via JS, stop card-link bubble
}

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
  offerings_count = 0,
}: Props) => {
  const navigate = useNavigate();
  const grad = avatarGradientFor(id);
  const roleLabels = (creator_roles ?? [])
    .slice(0, 3)
    .map((rid) => ROLE_BY_ID.get(rid))
    .filter(Boolean) as { label: string; emoji: string }[];

  // Build the support actions list — only show what actually exists.
  const actions: SupportAction[] = [];
  if (coin) {
    actions.push({
      key: "coin",
      label: `Buy $${coin.ticker}`,
      sub: "Coin",
      icon: Coins,
      href: `/coin/${coin.ticker}`,
      primary: true,
      external: true,
    });
  }
  if (next_event) {
    actions.push({
      key: "event",
      label: "Get tickets",
      sub: format(new Date(next_event.starts_at), "MMM d"),
      icon: Ticket,
      href: next_event.slug ? `/events/${next_event.slug}` : `/events/${next_event.id}`,
      primary: !coin,
      external: true,
    });
  }
  actions.push({
    key: "book",
    label: "Book a session",
    icon: Calendar,
    href: `${href}?tab=support`,
    external: true,
  });
  if (offerings_count > 0) {
    actions.push({
      key: "offerings",
      label: `Shop · ${offerings_count}`,
      icon: ShoppingBag,
      href: `${href}?tab=support`,
      external: true,
    });
  }
  actions.push({
    key: "message",
    label: "Message",
    icon: MessageCircle,
    href: `/messages?to=${id}`,
    external: true,
  });

  const handleAction = (e: React.MouseEvent, target: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(target);
  };

  return (
    <Link
      to={href}
      className="group block overflow-hidden rounded-[1.5rem] border border-border/45 bg-card/75 transition-all hover:border-foreground/40 hover:shadow-[0_18px_48px_hsl(var(--background)/0.45)] focus:outline-none focus:ring-2 focus:ring-primary/40"
      aria-label={`View ${title}'s profile`}
    >
      {/* Header strip — featured chip + region */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-background">
          <Sparkles className="h-3 w-3" /> Featured creator
        </span>
        {region_code && <RegionChip code={region_code} size="sm" showLabel />}
      </div>

      {/* Avatar hero */}
      <div className="relative px-4 pt-5 pb-4">
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

        <div className="mt-3 flex items-center justify-center gap-1.5">
          <h3 className="font-display text-2xl leading-tight text-foreground line-clamp-1">
            {title}
          </h3>
          {verification_status === "verified" && (
            <VerifiedArtistBadge status="verified" size="xs" showLabel={false} />
          )}
        </div>

        {roleLabels.length > 0 ? (
          <p className="mt-1 text-center text-[12px] font-medium text-foreground/80 line-clamp-1">
            {roleLabels.map((r) => `${r.emoji} ${r.label}`).join(" · ")}
          </p>
        ) : mediums?.length ? (
          <p className="mt-1 text-center text-xs text-muted-foreground line-clamp-1">
            {mediums.slice(0, 3).join(" · ")}
          </p>
        ) : null}

        {subtitle && (
          <p className="mt-2 text-center text-[12px] italic text-muted-foreground line-clamp-2">
            "{subtitle}"
          </p>
        )}

        {/* Compact stats strip */}
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-foreground">{works_count}</span> works
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" />
            <span className="font-semibold text-foreground">{followers_count}</span>
          </span>
        </div>
      </div>

      {/* Ways to support — the heart of the card */}
      <div className="border-t border-border/40 bg-background/40 px-4 pt-3 pb-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
          Ways to support
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                onClick={(e) => handleAction(e, a.href)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
                  a.primary
                    ? "border-foreground bg-foreground text-background hover:opacity-90"
                    : "border-border/60 bg-card/60 hover:border-foreground/40 hover:bg-card",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-semibold leading-tight truncate">
                    {a.label}
                  </span>
                  {a.sub && (
                    <span
                      className={cn(
                        "block text-[10px] leading-tight truncate",
                        a.primary ? "text-background/70" : "text-muted-foreground",
                      )}
                    >
                      {a.sub}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <span className="mt-3 flex items-center justify-end gap-1 text-[11px] font-medium text-foreground/80 transition-transform group-hover:translate-x-0.5">
          View profile <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
};

export default ArtistSpotlightCard;
