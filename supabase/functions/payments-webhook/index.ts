// Stripe webhook handler. Writes creator subscription rows.
// URL: /payments-webhook?env=sandbox|live  (registered automatically by Lovable)
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

function tsToIso(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

async function upsertCreatorSubscription(sub: any) {
  const meta = sub.metadata || {};
  const userId = meta.userId;
  const creatorId = meta.creator_id;
  const tier = meta.tier;
  if (!userId || !creatorId || !tier) {
    console.error("Missing metadata on subscription", sub.id, meta);
    return;
  }
  const item = sub.items?.data?.[0];
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd   = item?.current_period_end   ?? sub.current_period_end;
  const amount = item?.price?.unit_amount ?? 0;

  // Map Stripe status to our status enum.
  let status = sub.status as string;
  if (sub.cancel_at_period_end && status === "active") {
    // Stay 'active' until period end; we flip to canceled on the deleted event.
  }
  if (!["active", "past_due", "canceled", "trialing", "incomplete", "unpaid"].includes(status)) {
    status = "pending";
  } else if (status === "trialing" || status === "incomplete") {
    status = "active"; // treat trial / incomplete-paid as active for gating
  }

  await getSupabase().from("creator_subscriptions").upsert(
    {
      subscriber_id: userId,
      creator_id: creatorId,
      tier,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      status,
      monthly_price_usd: Math.round(amount / 100),
      current_period_start: tsToIso(periodStart),
      current_period_end:   tsToIso(periodEnd),
      canceled_at: sub.canceled_at ? tsToIso(sub.canceled_at) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "subscriber_id,creator_id" },
  );
}

async function markCanceled(sub: any) {
  await getSupabase()
    .from("creator_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  console.log("webhook:", event.type, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertCreatorSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await markCanceled(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Invalid env query param:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
