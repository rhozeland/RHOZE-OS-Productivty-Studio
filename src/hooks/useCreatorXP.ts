import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Canonical XP + level model — shared by HUD dock, Creator Pass, profile.
 * Mirrors the ladder defined in CreatorJourney so a single hook backs the
 * gamification surface.
 */
export const LEVEL_XP = [0, 20, 50, 100, 200, 350, 500, 750, 1000, 1500];

export const TIER_TITLES = [
  { title: "Newcomer", levels: [1], color: "210 60% 55%" },
  { title: "Contributor", levels: [2, 3], color: "175 70% 50%" },
  { title: "Creator", levels: [4, 5, 6], color: "40 80% 50%" },
  { title: "Builder", levels: [7, 8], color: "280 60% 60%" },
  { title: "Pro", levels: [9, 10], color: "350 60% 55%" },
];

export function getLevelFromXP(xp: number) {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
  }
  return level;
}

export function getTitleForLevel(level: number) {
  return TIER_TITLES.find((t) => t.levels.includes(level)) ?? TIER_TITLES[0];
}

export interface CreatorXP {
  totalXP: number;
  level: number;
  title: string;
  titleColor: string; // raw HSL values (no `hsl()` wrapper) to match index.css tokens
  prevLevelXP: number;
  nextLevelXP: number;
  progressPct: number;
  streak: number;
  rhozeBalance: number;
}

export const useCreatorXP = () => {
  const { user } = useAuth();

  const query = useQuery<CreatorXP>({
    queryKey: ["creator-xp-hud", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [proofs, rewards, credits] = await Promise.all([
        supabase
          .from("contribution_proofs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),
        supabase
          .from("credit_transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("type", "reward"),
        supabase
          .from("user_credits" as any)
          .select("balance, reward_streak")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);

      const totalXP = (proofs.count ?? 0) + (rewards.count ?? 0) * 2;
      const level = getLevelFromXP(totalXP);
      const title = getTitleForLevel(level);
      const prevLevelXP = LEVEL_XP[level - 1];
      const nextLevelXP = level < 10 ? LEVEL_XP[level] : LEVEL_XP[9];
      const progressPct =
        level >= 10
          ? 100
          : Math.min(
              100,
              ((totalXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100,
            );

      return {
        totalXP,
        level,
        title: title.title,
        titleColor: title.color,
        prevLevelXP,
        nextLevelXP,
        progressPct,
        streak: (credits?.data as any)?.reward_streak ?? 0,
        rhozeBalance: Number((credits?.data as any)?.balance ?? 0),
      };
    },
  });

  // Live refresh when rewards land — keeps HUD in sync without polling.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`creator-xp-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => query.refetch(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${user.id}`,
        },
        () => query.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, query]);

  return query;
};
