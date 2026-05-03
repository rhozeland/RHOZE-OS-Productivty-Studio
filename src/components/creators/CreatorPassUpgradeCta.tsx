/**
 * CreatorPassUpgradeCta — slim editorial CTA encouraging users to climb
 * their Creator Pass tier. Surfaced in Discover + Conversations.
 *
 * Hint is personalized: pulls the user's current $RHOZE balance and
 * activity counts (posts / projects / listings / events / interactions),
 * computes their effective tier, and surfaces whichever next-tier
 * threshold they're closest to unlocking.
 *
 * Hidden when the user is already at the top tier (Play), signed-out,
 * or has dismissed the card (persisted per user in localStorage).
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  TIERS,
  TIER_RANK,
  getHoldTier,
  getActivityTier,
  getEffectiveTier,
  type TierId,
} from "@/lib/tier-matrix";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const dismissKey = (userId: string) => `rhozeland.creator-pass-cta.dismissed.${userId}`;

const ACTIVITY_LABELS: Record<keyof NonNullable<typeof TIERS[number]["activity"]>, string> = {
  posts: "work post",
  projects: "completed project",
  listings: "listing",
  events: "event",
  interactions: "interaction",
};

const formatRhoze = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
};

type Props = { variant?: "wide" | "compact" };

const CreatorPassUpgradeCta = ({ variant = "wide" }: Props) => {
  const { user } = useAuth();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined" || !user) return false;
    return window.localStorage.getItem(dismissKey(user.id)) === "1";
  });

  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ["creator-pass-cta-credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("tier, balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["creator-pass-cta-activity", user?.id],
    queryFn: async () => {
      const sb = supabase as any;
      const [posts, projects, listings, events, interactions] = await Promise.all([
        sb.from("works").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        sb.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("status", "completed"),
        sb.from("listings").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        sb.from("events").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        sb.from("credit_transactions").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("type", "reward"),
      ]);
      return {
        posts: (posts?.count as number) ?? 0,
        projects: (projects?.count as number) ?? 0,
        listings: (listings?.count as number) ?? 0,
        events: (events?.count as number) ?? 0,
        interactions: (interactions?.count as number) ?? 0,
      };
    },
    enabled: !!user,
  });

  const personalized = useMemo(() => {
    if (!activity) return null;
    const balance = Number(credits?.balance ?? 0);

    const LEGACY_MAP: Record<string, TierId> = { bronze: "spark", gold: "bloom", diamond: "glow", prism: "play" };
    const subTier: TierId = credits?.tier ? ((LEGACY_MAP[credits.tier] || credits.tier) as TierId) : "spark";
    const holdTier: TierId = getHoldTier(balance);
    const effective = getEffectiveTier(subTier, holdTier);

    const nextTier = TIERS.find((t) => TIER_RANK[t.id] === TIER_RANK[effective] + 1);
    if (!nextTier) return { effective, next: null as null };

    const remaining = Math.max(0, nextTier.hold - balance);
    const hint = `${formatRhoze(balance)} / ${formatRhoze(nextTier.hold)} $RHOZE held — ${formatRhoze(remaining)} more to ${nextTier.label}.`;

    return { effective, next: nextTier, hint };
  }, [activity, credits]);

  if (!user) return null;
  if (dismissed) return null;

  const isLoading = creditsLoading || activityLoading;
  if (isLoading) {
    return (
      <div
        className={`surface-card relative overflow-hidden flex items-start gap-4 p-4 ${
          variant === "compact" ? "" : "md:p-5"
        }`}
        aria-hidden
      >
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    );
  }

  if (!personalized) return null;
  if (!personalized.next) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey(user.id), "1");
    }
    setDismissed(true);
  };

  return (
    <Link
      to="/credits?tab=tiers"
      className={`group surface-card relative overflow-hidden flex items-start gap-4 p-4 hover:border-foreground/30 transition-colors ${
        variant === "compact" ? "" : "md:p-5"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 bg-gradient-to-br from-primary/15 via-transparent to-amber-500/10"
      />
      <div className="relative shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-primary/30 to-amber-500/30 flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-foreground" />
      </div>
      <div className="relative flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Creator Pass
          </span>
          <span className="text-[10px] uppercase tracking-wider text-foreground/60">
            · {personalized.effective}
          </span>
        </div>
        <h3 className="font-display text-base md:text-lg font-bold text-foreground leading-tight mt-0.5">
          Climb to {personalized.next.label} for bigger rewards
        </h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{personalized.hint}</p>
        <ArrowRight className="inline-block ml-1 h-3.5 w-3.5 text-muted-foreground/70 align-[-2px] group-hover:text-foreground group-hover:translate-x-0.5 transition" />
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss Creator Pass nudge"
        className="absolute top-2 right-2 z-10 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </Link>
  );
};

export default CreatorPassUpgradeCta;
