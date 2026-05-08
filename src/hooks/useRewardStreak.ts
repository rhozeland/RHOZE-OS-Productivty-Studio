import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * On app load, advances the user's daily login streak via the
 * `tick_reward_streak` RPC (SECURITY DEFINER — bypasses the read-only
 * RLS on `user_credits`). The RPC handles the 20h debounce, the 48h
 * reset window, and signals when a 7-day milestone bonus is owed.
 */
export const useRewardStreak = () => {
  const { user } = useAuth();
  const checked = useRef(false);

  useEffect(() => {
    if (!user || checked.current) return;
    checked.current = true;

    (async () => {
      const { data, error } = await supabase.rpc("tick_reward_streak");
      if (error) {
        console.error("tick_reward_streak failed:", error);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.awarded_bonus) {
        await supabase.rpc("adjust_user_credits", {
          _user_id: user.id,
          _amount: 5,
          _type: "reward",
          _description: `${row.reward_streak}-day login streak bonus! 🔥`,
        });
      }
    })().catch(console.error);
  }, [user]);
};
