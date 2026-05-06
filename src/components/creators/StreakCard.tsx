import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StreakRow {
  current_streak: number;
  longest_streak: number;
  last_active_at: string | null;
}

export function StreakCard() {
  const { user } = useAuth();
  const [row, setRow] = useState<StreakRow | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_streaks")
        .select("current_streak, longest_streak, last_active_at")
        .eq("user_id", user.id)
        .maybeSingle();
      setRow(data ?? { current_streak: 0, longest_streak: 0, last_active_at: null });
    })();
  }, [user]);

  if (!user) return null;

  const current = row?.current_streak ?? 0;
  const longest = row?.longest_streak ?? 0;
  const toNext = current === 0 ? 7 : 7 - (current % 7 || 7);

  // Past 7 days mini calendar — fill the most-recent N circles based on streak.
  const days = Array.from({ length: 7 }, (_, i) => 6 - i); // 6..0 (oldest left)
  const filledFromRight = Math.min(7, current);

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
        <Flame className="h-5 w-5 text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">
          {current === 0 ? (
            "Start your streak today"
          ) : (
            <>
              {current}-day streak
              <span className="text-muted-foreground font-normal"> · longest {longest}</span>
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {current === 0 ? (
            <>
              Sign in +{" "}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="underline decoration-dotted underline-offset-2 cursor-help">interact</span>
                </TooltipTrigger>
                <TooltipContent className="text-xs font-body">
                  Drop a note, message a creator, or attend an event
                </TooltipContent>
              </Tooltip>{" "}
              today to start. Every 7 days = 5 $RHOZE.
            </>
          ) : (
            `${toNext} day${toNext === 1 ? "" : "s"} until your next 5 $RHOZE drop.`
          )}
        </div>
        {/* 7-day mini calendar */}
        <div className="mt-2 flex items-center gap-1.5">
          {days.map((d, idx) => {
            const filled = idx >= 7 - filledFromRight;
            return (
              <span
                key={d}
                className={`h-2.5 w-2.5 rounded-full border ${
                  filled ? "bg-amber-500 border-amber-500" : "bg-transparent border-border"
                }`}
                aria-label={filled ? "active day" : "inactive day"}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
