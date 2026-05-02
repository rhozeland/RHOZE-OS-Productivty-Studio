/**
 * CreatorPassUpgradeCta — slim editorial CTA encouraging users to climb
 * their Creator Pass tier. Surfaced in Discover + Conversations.
 *
 * Hidden when the user is already at the top tier (Play) or signed-out.
 * Earned-only model: no pricing, no subscriptions — links into the
 * Creator Pass page where users can see hold/activity thresholds.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, ArrowRight } from "lucide-react";

const TIER_NEXT: Record<string, { next: string; hint: string }> = {
  spark: { next: "Bloom", hint: "Hold 1M+ $RHOZE or hit any single activity bar." },
  bloom: { next: "Glow", hint: "Hold 25M+ $RHOZE or scale your posts, projects, or events." },
  glow: { next: "Play", hint: "Hold 50M+ $RHOZE or push activity past Glow." },
};

type Props = { variant?: "wide" | "compact" };

const CreatorPassUpgradeCta = ({ variant = "wide" }: Props) => {
  const { user } = useAuth();

  const { data: tierRow } = useQuery({
    queryKey: ["creator-pass-cta-tier", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("subscription_tier")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  if (!user) return null;
  const currentTier = (tierRow?.subscription_tier ?? "spark").toLowerCase();
  if (currentTier === "play") return null;
  const target = TIER_NEXT[currentTier] ?? TIER_NEXT.spark;

  return (
    <Link
      to="/credits?tab=tiers"
      className={`group surface-card relative overflow-hidden flex items-start gap-4 p-4 hover:border-foreground/30 transition-colors ${
        variant === "compact" ? "" : "md:p-5"
      }`}
    >
      {/* aurora wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 bg-gradient-to-br from-primary/15 via-transparent to-amber-500/10"
      />
      <div className="relative shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-primary/30 to-amber-500/30 flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-foreground" />
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Creator Pass
          </span>
          <span className="text-[10px] uppercase tracking-wider text-foreground/60">
            · {currentTier}
          </span>
        </div>
        <h3 className="font-display text-base md:text-lg font-bold text-foreground leading-tight mt-0.5">
          Climb to {target.next} for bigger rewards
        </h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{target.hint}</p>
      </div>
      <ArrowRight className="relative h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition shrink-0 mt-1" />
    </Link>
  );
};

export default CreatorPassUpgradeCta;
