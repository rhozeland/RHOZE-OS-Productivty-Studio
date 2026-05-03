/**
 * CreatorPassUpgradeCta — slim editorial CTA encouraging users to climb
 * their Creator Pass tier. Surfaced in Discover + Conversations.
 *
 * Hidden when the user is already at the top tier (Play), signed-out,
 * or has dismissed the card (persisted per user in localStorage).
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, ArrowRight, X } from "lucide-react";

const TIER_NEXT: Record<string, { next: string; hint: string }> = {
  spark: { next: "Bloom", hint: "Hold 1M+ $RHOZE or hit any single activity bar." },
  bloom: { next: "Glow", hint: "Hold 25M+ $RHOZE or scale your posts, projects, or events." },
  glow: { next: "Play", hint: "Hold 50M+ $RHOZE or push activity past Glow." },
};

const dismissKey = (userId: string) => `rhozeland.creator-pass-cta.dismissed.${userId}`;

type Props = { variant?: "wide" | "compact" };

const CreatorPassUpgradeCta = ({ variant = "wide" }: Props) => {
  const { user } = useAuth();

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined" || !user) return false;
    return window.localStorage.getItem(dismissKey(user.id)) === "1";
  });

  const { data: tierRow } = useQuery({
    queryKey: ["creator-pass-cta-tier", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("tier")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  if (!user) return null;
  if (dismissed) return null;
  const currentTier = (tierRow?.tier ?? "spark").toLowerCase();
  if (currentTier === "play") return null;
  const target = TIER_NEXT[currentTier] ?? TIER_NEXT.spark;

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
