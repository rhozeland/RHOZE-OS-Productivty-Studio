import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * On app load, checks if 24h+ since last_reward_login.
 * If so, increments streak (resets if >48h gap) and awards bonus at 7-day milestones.
 */
export const useRewardStreak = () => {
  const { user } = useAuth();
  const checked = useRef(false);

  useEffect(() => {
    if (!user || checked.current) return;
    checked.current = true;

    const checkStreak = async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("last_reward_login, reward_streak")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data) return;

      const now = new Date();
      const last = data.last_reward_login ? new Date(data.last_reward_login) : null;

      if (!last) {
        // First ever login — start streak
        await supabase
          .from("user_credits")
          .update({ last_reward_login: now.toISOString(), reward_streak: 1 })
          .eq("user_id", user.id);
        return;
      }

      const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);

      if (hoursSince < 20) return; // Already logged in today (allow some buffer)

      let newStreak: number;
      if (hoursSince > 48) {
        // Streak broken
        newStreak = 1;
      } else {
        newStreak = (data.reward_streak ?? 0) + 1;
      }

      await supabase
        .from("user_credits")
        .update({
          last_reward_login: now.toISOString(),
          reward_streak: newStreak,
        })
        .eq("user_id", user.id);

      // Award bonus at every 7-day milestone
      if (newStreak > 0 && newStreak % 7 === 0) {
        // Use the award_rhoze function via edge or direct insert
        // Since award_rhoze is SECURITY DEFINER, we can't call it from client.
        // Instead, use adjust_user_credits RPC which the user can call for themselves.
        await supabase.rpc("adjust_user_credits", {
          _user_id: user.id,
          _amount: 5,
          _type: "reward",
          _description: `${newStreak}-day login streak bonus! 🔥`,
        });
      }
    };

    checkStreak().catch(console.error);
  }, [user]);
};
