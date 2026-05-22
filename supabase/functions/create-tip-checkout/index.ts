// Creates a Stripe Embedded Checkout session for a one-off tip to a creator.
// Body: { creatorId, amountCents, userId, email, message?, returnUrl, environment }
// Returns: { clientSecret }
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { creatorId, amountCents, userId, email, message, returnUrl, environment } = body ?? {};

    if (!creatorId || !/^[0-9a-f-]{36}$/i.test(creatorId)) throw new Error("Invalid creatorId");
    if (!userId) throw new Error("Must be signed in to tip");
    if (!returnUrl) throw new Error("Missing returnUrl");
    if (environment !== "sandbox" && environment !== "live") throw new Error("Invalid environment");
    const amt = Number(amountCents);
    if (!Number.isFinite(amt) || amt < 100 || amt > 50000) {
      throw new Error("Tip must be between $1 and $500");
    }
    if (message && typeof message === "string" && message.length > 200) {
      throw new Error("Message too long");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user && user.id !== userId) throw new Error("Auth mismatch");
    }

    // Look up creator's display name for the receipt line item.
    const { data: creator } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, username")
      .eq("id", creatorId)
      .maybeSingle();
    if (!creator) throw new Error("Creator not found");
    if (creator.user_id === userId) throw new Error("You cannot tip yourself");
    const creatorLabel = creator.display_name || creator.username || "creator";

    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);

    const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Tip for ${creatorLabel}` },
            unit_amount: Math.round(amt),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      payment_intent_data: { description: `Rhozeland tip → ${creatorLabel}` },
      metadata: {
        kind: "creator_tip",
        userId,
        creator_id: creatorId,
        amount_cents: String(Math.round(amt)),
        message: message ? String(message).slice(0, 200) : "",
      },
    });

    // Record the pending tip so the webhook can promote it on success.
    await supabase.from("creator_tips").insert({
      tipper_id: userId,
      creator_id: creatorId,
      amount_cents: Math.round(amt),
      currency: "usd",
      message: message ? String(message).slice(0, 200) : null,
      stripe_session_id: session.id,
      status: "pending",
      environment: env,
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-tip-checkout error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
