/**
 * create-event-ticket-checkout — Stripe Embedded Checkout for paid event tickets.
 *
 * Body: { event_id, tier_id, name, email, returnUrl, environment, userId? }
 * Returns: { clientSecret }
 *
 * The session metadata carries event_id, tier_id, buyer_name, buyer_email so
 * payments-webhook can issue the ticket via claim-event-ticket on
 * checkout.session.completed.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { event_id, tier_id, name, email, returnUrl, environment, userId } =
      (await req.json()) ?? {};
    if (!event_id || !/^[0-9a-f-]{36}$/i.test(event_id)) throw new Error("Invalid event_id");
    if (!tier_id || !/^[0-9a-f-]{36}$/i.test(tier_id)) throw new Error("Invalid tier_id");
    if (!name || !email) throw new Error("Name and email required");
    if (!returnUrl) throw new Error("Missing returnUrl");
    if (environment !== "sandbox" && environment !== "live") throw new Error("Invalid environment");

    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Invalid email");
    const cleanName = String(name).trim().slice(0, 80);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tier, error: tierErr } = await supabase
      .from("event_ticket_tiers")
      .select("id, event_id, name, price_usd, currency_code, tier_kind, is_active, quantity_total, quantity_sold")
      .eq("id", tier_id)
      .maybeSingle();
    if (tierErr || !tier) throw new Error("Tier not found");
    if (tier.event_id !== event_id) throw new Error("Tier/event mismatch");
    if (!tier.is_active) throw new Error("Tier closed");
    if ((tier.tier_kind ?? "paid") !== "paid") throw new Error("Tier is not paid");
    const priceCents = Math.round((Number(tier.price_usd) || 0) * 100);
    if (priceCents < 50) throw new Error("Tier price too low for card checkout");
    if (tier.quantity_total != null && tier.quantity_sold >= tier.quantity_total) {
      throw new Error("Sold out");
    }

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id, title")
      .eq("id", event_id)
      .maybeSingle();
    if (evErr || !ev) throw new Error("Event not found");

    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      line_items: [
        {
          price_data: {
            currency: (tier.currency_code || "USD").toLowerCase(),
            unit_amount: priceCents,
            product_data: {
              name: `${ev.title} — ${tier.name}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: cleanEmail,
      payment_intent_data: {
        description: `Rhozeland Event: ${ev.title} — ${tier.name}`,
      },
      metadata: {
        kind: "event_ticket",
        event_id,
        tier_id,
        buyer_name: cleanName,
        buyer_email: cleanEmail,
        ...(userId && { userId }),
      },
    });

    return json({ clientSecret: session.client_secret });
  } catch (e) {
    console.error("create-event-ticket-checkout error", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      400,
    );
  }
});
