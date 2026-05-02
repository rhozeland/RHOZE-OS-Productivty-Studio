/**
 * Engagement-reward client helper.
 *
 * Wraps the `award_engagement_reward` Postgres RPC, which atomically queues
 * a `pending_rewards` row only if the caller is under that day's
 * per-action cap (configured in `reward_daily_caps`). The RPC returns a
 * structured envelope so callers can quietly ignore caps without spamming
 * users — engagement rewards are a "nice surprise", not a transaction.
 *
 * Wire this up from like / follow / comment handlers AFTER the underlying
 * write succeeds:
 *
 *   await supabase.from("work_likes").insert({ ... });
 *   await awardEngagementReward({
 *     userId: user.id,
 *     action: "like_work",
 *     referenceId: workId,
 *   });
 *
 * The function is SECURITY DEFINER, so the user_id we pass is trusted as
 * the recipient; always pass the authenticated user's id (never client
 * input). Server-side / edge contexts should use the service role and may
 * pass any user_id they're awarding for.
 */
import { supabase } from "@/integrations/supabase/client";

export type EngagementAction =
  | "like_work"
  | "comment_work"
  | "follow_artist"
  // Allow forward-compatible action types without losing autocomplete on
  // the canonical three.
  | (string & {});

export type AwardEngagementResult =
  | { status: "awarded"; pendingRewardId: string; amount: number; remainingToday: number }
  | { status: "capped"; reason: "count_cap" | "amount_cap"; cap: number; used: number }
  | { status: "disabled" }
  | { status: "rejected"; reason: "unknown_action" | "missing_user" | "rpc_error"; message?: string };

export async function awardEngagementReward(args: {
  userId: string;
  action: EngagementAction;
  referenceId?: string | null;
  description?: string | null;
}): Promise<AwardEngagementResult> {
  const { data, error } = await supabase.rpc("award_engagement_reward" as any, {
    _user_id: args.userId,
    _action_type: args.action,
    _reference_id: args.referenceId ?? null,
    _description: args.description ?? null,
  });

  if (error) {
    return { status: "rejected", reason: "rpc_error", message: error.message };
  }

  const r = (data ?? {}) as Record<string, unknown>;
  const status = r.status as string | undefined;

  switch (status) {
    case "awarded":
      return {
        status: "awarded",
        pendingRewardId: String(r.pending_reward_id),
        amount: Number(r.amount),
        remainingToday: Number(r.remaining_today),
      };
    case "capped":
      return {
        status: "capped",
        reason: (r.reason === "amount_cap" ? "amount_cap" : "count_cap"),
        cap: Number(r.cap),
        used: Number(r.used),
      };
    case "disabled":
      return { status: "disabled" };
    default:
      return {
        status: "rejected",
        reason: r.reason === "missing_user" ? "missing_user" : "unknown_action",
      };
  }
}
