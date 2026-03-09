import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Find subscriptions where subscription_end has passed and tier is not 'none'
    const { data: expiredSubs, error: fetchErr } = await supabase
      .from("user_credits")
      .select("*")
      .neq("tier", "none")
      .lte("subscription_end", now);

    if (fetchErr) {
      throw new Error(`Failed to fetch subscriptions: ${fetchErr.message}`);
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, renewed: 0, message: "No subscriptions due for renewal" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let renewed = 0;
    const errors: string[] = [];

    for (const sub of expiredSubs) {
      try {
        // Calculate new subscription period (1 month from current end)
        const currentEnd = new Date(sub.subscription_end);
        const newStart = new Date(currentEnd);
        const newEnd = new Date(currentEnd);
        newEnd.setMonth(newEnd.getMonth() + 1);

        // Add monthly credits to balance
        const newBalance = Number(sub.balance) + Number(sub.tier_credits_monthly);

        // Update the subscription
        const { error: updateErr } = await supabase
          .from("user_credits")
          .update({
            balance: newBalance,
            subscription_start: newStart.toISOString().split("T")[0],
            subscription_end: newEnd.toISOString().split("T")[0],
          })
          .eq("id", sub.id);

        if (updateErr) {
          errors.push(`User ${sub.user_id}: ${updateErr.message}`);
          continue;
        }

        // Log the renewal transaction
        const { error: txErr } = await supabase
          .from("credit_transactions")
          .insert({
            user_id: sub.user_id,
            amount: sub.tier_credits_monthly,
            type: "renewal",
            description: `${sub.tier} tier monthly renewal — ${sub.tier_credits_monthly} credits`,
            payment_method: "subscription",
          });

        if (txErr) {
          errors.push(`Transaction log for ${sub.user_id}: ${txErr.message}`);
        }

        renewed++;
      } catch (e) {
        errors.push(`User ${sub.user_id}: ${e.message}`);
      }
    }

    console.log(`Subscription renewal complete: ${renewed} renewed, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ success: true, renewed, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Subscription renewal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
