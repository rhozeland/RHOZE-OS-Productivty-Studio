/**
 * ProfileTierBadge — gym-style Creator Pass badge embedded in the profile
 * header. Compact, glowy, hoverable. Shows the profile owner's tier (Spark →
 * Bloom → Glow → Play) based on their in-app $RHOZE balance.
 *
 * If `user_credits` RLS hides another user's balance, the badge gracefully
 * falls back to "Spark" rather than disappearing — every creator has a pass.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TIERS, getHoldTier, TierId } from "@/lib/tier-matrix";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  userId: string;
  isOwnProfile?: boolean;
}

const ProfileTierBadge = ({ userId, isOwnProfile }: Props) => {
  const { data } = useQuery({
    queryKey: ["profile-tier", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance, reward_streak")
        .eq("user_id", userId)
        .maybeSingle();
      return data ?? { balance: 0, reward_streak: 0 };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const balance = Number(data?.balance ?? 0);
  const tierId: TierId = getHoldTier(balance);
  const tier = TIERS.find((t) => t.id === tierId)!;
  const nextTier = TIERS[TIERS.findIndex((t) => t.id === tierId) + 1];
  const toNext = nextTier ? Math.max(0, nextTier.hold - balance) : 0;
  const pct = nextTier
    ? Math.min(100, Math.round(((balance - tier.hold) / (nextTier.hold - tier.hold)) * 100))
    : 100;
  const streak = Number(data?.reward_streak ?? 0);

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Link
          to={isOwnProfile ? "/credits" : "/credits?tab=how"}
          className="group relative inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-[11px] font-semibold text-white shadow-lg transition-transform hover:scale-[1.03]"
          style={{
            background: tier.gradient,
            boxShadow: `0 0 18px -2px ${tier.glowColor}`,
          }}
          aria-label={`Creator Pass · ${tier.label} tier`}
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 backdrop-blur"
          >
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="font-display tracking-wide uppercase">{tier.label}</span>
          {nextTier && (
            <span className="relative ml-0.5 h-1 w-8 overflow-hidden rounded-full bg-white/25">
              <span
                className="absolute inset-y-0 left-0 bg-white/90"
                style={{ width: `${pct}%` }}
              />
            </span>
          )}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 p-0 overflow-hidden">
        <div
          className="px-4 py-3 text-white"
          style={{ background: tier.gradient }}
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-xs uppercase tracking-[0.18em] opacity-90">
              Creator Pass
            </p>
            <Sparkles className="h-3.5 w-3.5 opacity-90" />
          </div>
          <p className="font-display text-2xl font-bold leading-tight mt-0.5">
            {tier.label}
          </p>
          <p className="text-[11px] opacity-90 mt-0.5">
            Holding {balance.toLocaleString()} $RHOZE
          </p>
        </div>
        <div className="p-4 space-y-3">
          {nextTier ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Next · {nextTier.label}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, background: nextTier.gradient }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {toNext.toLocaleString()} $RHOZE to unlock {nextTier.label}.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Top tier — every perk unlocked.
            </p>
          )}
          <ul className="space-y-1 text-[11px] text-foreground/80">
            {tier.benefits.slice(0, 3).map((b) => (
              <li key={b} className="flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                {b}
              </li>
            ))}
          </ul>
          {streak > 0 && (
            <p className="text-[10px] text-muted-foreground">
              🔥 {streak}-day reward streak
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/80 pt-1 border-t border-border/60">
            Earned by holding $RHOZE. Lower platform fees as you climb.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ProfileTierBadge;
