/**
 * ProfileGemHeader — compact left-aligned identity header.
 * No cover banner. Avatar + name + @handle + verification/Spark badge,
 * followed by an inline metrics row with muted icons + values:
 *   Readiness · Verified IP · Contributions · Tenure
 */
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings, Sparkles, UserPlus, UserCheck, MessageSquare,
  MapPin, Star, Globe, ExternalLink, ShieldCheck, Activity, Clock,
  BadgeCheck, Loader2, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import ProfileBadges from "@/components/profile/ProfileBadges";
import VerifiedProBadge from "@/components/profile/VerifiedProBadge";
import ProfileTierBadge from "@/components/profile/ProfileTierBadge";
import ArchetypeChip from "@/components/profile/ArchetypeChip";
import NoteBubble from "@/components/notes/NoteBubble";
import SaveButton from "@/components/saved/SaveButton";
import { getRegion } from "@/lib/regions";
import { cn } from "@/lib/utils";

interface Props {
  profile: any;
  isOwnProfile: boolean;
  authedUser: { id: string } | null;
  profileNote?: { body: string } | null;
  isFollowing: boolean;
  onFollow: () => void;
  followPending?: boolean;
  onMessage: () => void;
  onSupport: () => void;
  onEditProfile: () => void;
  onBoost: () => void;
  onShareCard: () => void;
  reviewStats?: { avg: number; count: number } | null;
}

interface Signals {
  verifiedWorks: number;
  totalWorks: number;
  contributions: number;
  flowPosts30d: number;
  eventsHosted: number;
}

const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

export const ProfileGemHeader = ({
  profile, isOwnProfile, authedUser, profileNote,
  isFollowing, onFollow, followPending,
  onMessage, onSupport, onEditProfile, onBoost, onShareCard,
  reviewStats,
}: Props) => {
  const p = profile;
  const id = p.user_id;
  const initials = (p.display_name || p.username || "?")
    .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const { data: signals, isLoading: signalsLoading } = useQuery<Signals>({
    queryKey: ["profile-gem-signals", id],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [worksRes, verifiedRes, eventsRes, contribRes, flowRes] = await Promise.all([
        supabase.from("works").select("id", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("works").select("id", { count: "exact", head: true }).eq("user_id", id).not("solana_signature", "is", null),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("host_id", id),
        supabase.from("contribution_proofs").select("id", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("flow_items").select("id", { count: "exact", head: true }).eq("user_id", id).gte("created_at", since),
      ]);
      return {
        verifiedWorks: verifiedRes.count ?? 0,
        totalWorks: worksRes.count ?? 0,
        eventsHosted: eventsRes.count ?? 0,
        contributions: contribRes.count ?? 0,
        flowPosts30d: flowRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  const tenureMonths = p.created_at ? monthsBetween(new Date(p.created_at), new Date()) : 0;
  const tenureLabel = tenureMonths >= 12
    ? `${Math.floor(tenureMonths / 12)}y`
    : `${Math.max(tenureMonths, 0)}mo`;

  const score = signals
    ? Math.min(
        100,
        signals.verifiedWorks * 12 +
          signals.eventsHosted * 8 +
          Math.min(signals.contributions, 20) * 2 +
          Math.min(signals.flowPosts30d, 10) * 2 +
          Math.min(tenureMonths, 12) * 1,
      )
    : 0;
  const tierColor =
    score >= 70 ? "text-emerald-600 dark:text-emerald-400"
    : score >= 35 ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";

  const metrics = [
    { Icon: Gauge, label: "Readiness", value: `${score}`, accent: tierColor },
    { Icon: ShieldCheck, label: "Verified IP", value: `${signals?.verifiedWorks ?? 0}` },
    { Icon: Sparkles, label: "Contributions", value: `${signals?.contributions ?? 0}` },
    { Icon: Clock, label: "Tenure", value: tenureLabel },
  ];

  const region = getRegion(p.region_code);
  const cityPart = (p.location || "").trim();
  const locationLabel = cityPart && region
    ? `${cityPart}, ${region.code}`
    : cityPart || region?.label || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm px-5 sm:px-7 py-5 sm:py-6"
    >
      <div className="flex items-start gap-4 sm:gap-5">
        {/* Avatar */}
        <div className="relative shrink-0">
          {profileNote && (
            <div className="absolute left-1/2 -translate-x-1/2 -top-9 z-20">
              <NoteBubble body={profileNote.body} size="md" />
            </div>
          )}
          <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border border-border/50 bg-muted shadow-sm overflow-hidden">
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-2xl font-bold text-muted-foreground">{initials}</span>
            )}
          </div>
        </div>

        {/* Identity (left-aligned) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight break-words leading-tight">
              {p.display_name || p.username || "Creator"}
            </h1>
            {p.verified_pro_at && <VerifiedProBadge size="md" />}
            {p.verification_status === "verified" && (
              <HoverCard openDelay={120} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    aria-label="Verified Artist"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent align="start" className="w-64 text-xs">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <BadgeCheck className="h-3.5 w-3.5 text-sky-500" /> Verified Artist
                  </p>
                  <p className="mt-1 text-muted-foreground">Identity confirmed by Rhozeland.</p>
                </HoverCardContent>
              </HoverCard>
            )}
            <ProfileBadges userId={id} compact />
            <ProfileTierBadge userId={id} isOwnProfile={isOwnProfile} />
          </div>
          {p.username && (
            <p className="text-sm text-muted-foreground mt-1">@{p.username}</p>
          )}


          {/* Secondary chips */}
          {(locationLabel || p.archetype || (reviewStats && reviewStats.count > 0)) && (
            <div className="mt-3 flex items-center gap-x-2 gap-y-1.5 flex-wrap">
              {locationLabel && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 rounded-full px-2.5 py-0.5">
                  {region ? <span aria-hidden>{region.flag}</span> : <MapPin className="h-2.5 w-2.5" />}
                  {locationLabel}
                </span>
              )}
              {p.archetype && <ArchetypeChip archetype={p.archetype} size="xs" />}
              {reviewStats && reviewStats.count > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {reviewStats.avg} <span className="opacity-70">({reviewStats.count})</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action cluster (top-right) */}
        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
          {isOwnProfile ? (
            <>
              <Button size="sm" variant="outline" onClick={onEditProfile} className="gap-1.5 text-xs">
                <Settings className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                size="sm" onClick={onBoost}
                className="gap-1.5 bg-gradient-to-r from-amber-500 to-fuchsia-500 text-white hover:opacity-90 text-xs border-0"
              >
                <Sparkles className="h-3.5 w-3.5" /> Boost
              </Button>
            </>
          ) : authedUser ? (
            <>
              <Button
                size="sm" variant={isFollowing ? "outline" : "default"}
                onClick={onFollow} disabled={followPending}
                className="gap-1.5 text-xs"
              >
                {isFollowing ? <><UserCheck className="h-3.5 w-3.5" /> Following</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
              </Button>
              <Button size="sm" variant="outline" onClick={onMessage} className="gap-1.5 text-xs">
                <MessageSquare className="h-3.5 w-3.5" /> Message
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Mobile action row */}
      <div className="sm:hidden mt-4 flex items-center gap-2">
        {isOwnProfile ? (
          <>
            <Button size="sm" variant="outline" onClick={onEditProfile} className="flex-1 gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" onClick={onBoost} className="flex-1 gap-1.5 bg-gradient-to-r from-amber-500 to-fuchsia-500 text-white text-xs border-0">
              <Sparkles className="h-3.5 w-3.5" /> Boost
            </Button>
          </>
        ) : authedUser ? (
          <>
            <Button size="sm" variant={isFollowing ? "outline" : "default"} onClick={onFollow} disabled={followPending} className="flex-1 gap-1.5 text-xs">
              {isFollowing ? <><UserCheck className="h-3.5 w-3.5" /> Following</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
            </Button>
            <Button size="sm" variant="outline" onClick={onMessage} className="flex-1 gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </Button>
          </>
        ) : null}
      </div>

      {/* Bio + socials */}
      {p.bio && (
        <p className="mt-4 text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
          {p.bio}
        </p>
      )}
      {(p.portfolio_url || p.instagram_url || p.tiktok_url || p.twitter_url || p.youtube_url) && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {p.portfolio_url && (
            <a href={p.portfolio_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Globe className="h-3.5 w-3.5" /> Portfolio <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          )}
          <div className="flex items-center gap-1">
            {p.instagram_url && (
              <a href={p.instagram_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="Instagram">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            )}
            {p.twitter_url && (
              <a href={p.twitter_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="X">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            )}
            {p.tiktok_url && (
              <a href={p.tiktok_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="TikTok">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.8a8.23 8.23 0 004.77 1.52V6.85a4.86 4.86 0 01-1-.16z"/></svg>
              </a>
            )}
            {p.youtube_url && (
              <a href={p.youtube_url} target="_blank" rel="noopener" className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title="YouTube">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
            )}
          </div>
          {!isOwnProfile && (
            <Button variant="ghost" size="sm" onClick={onShareCard} className="ml-auto text-xs">
              Share card
            </Button>
          )}
        </div>
      )}

      {/* Reputation metrics — under bio + socials */}
      <div className="mt-5 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 via-background to-background p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Reputation signals</p>
          {signalsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="group relative rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm px-2 py-2.5 sm:px-3 sm:py-3 hover:border-foreground/30 hover:bg-card hover:shadow-md transition-all"
            >
              <m.Icon className={cn("h-3.5 w-3.5 mb-1.5", m.accent ?? "text-muted-foreground")} />
              <p className={cn("font-display text-xl sm:text-2xl font-bold tabular-nums leading-none", m.accent ?? "text-foreground")}>
                {m.value}
              </p>
              <p className="mt-1.5 text-[9px] sm:text-[10px] uppercase tracking-wider font-medium text-muted-foreground leading-tight">
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileGemHeader;
