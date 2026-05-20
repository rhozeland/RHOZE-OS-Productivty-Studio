// Creates a Stripe Embedded Checkout session for subscribing to a creator.
// Body: { creatorId, tier ('basic'|'standard'|'premium'), userId, email, returnUrl, environment }
// Returns: { clientSecret }
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_BY_TIER: Record<string, { priceId: string; amount: number }> = {
  basic:    { priceId: "creator_sub_basic_monthly",    amount: 500 },
  standard: { priceId: "creator_sub_standard_monthly", amount: 1000 },
  premium:  { priceId: "creator_sub_premium_monthly",  amount: 2500 },
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
    const { creatorId, tier, userId, email, returnUrl, environment } = body ?? {};

    if (!creatorId || !/^[0-9a-f-]{36}$/i.test(creatorId)) throw new Error("Invalid creatorId");
    if (!PRICE_BY_TIER[tier]) throw new Error("Invalid tier");
    if (!userId) throw new Error("Must be signed in to subscribe");
    if (!returnUrl) throw new Error("Missing returnUrl");
    if (environment !== "sandbox" && environment !== "live") throw new Error("Invalid environment");

    // Prevent self-subscription.
    if (userId === creatorId) throw new Error("You cannot subscribe to yourself");

    // Verify auth via the Supabase user (defense in depth).
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

    const env: StripeEnv = environment;
    const stripe = createStripeClient(env);

    const { priceId } = PRICE_BY_TIER[tier];
    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) throw new Error(`Price not found: ${priceId}`);
    const stripePrice = prices.data[0];

    const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      automatic_tax: { enabled: true },
      customer_update: { address: "auto" },
      metadata: {
        userId,
        creator_id: creatorId,
        tier,
      },
      subscription_data: {
        metadata: {
          userId,
          creator_id: creatorId,
          tier,
        },
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-subscription-checkout error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
