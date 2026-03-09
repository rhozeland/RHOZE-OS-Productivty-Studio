import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PaymentSchema = z.object({
  amount_cents: z.number().int().positive().max(10000000),
  currency: z.string().length(3),
  description: z.string().max(500).optional(),
  source_id: z.string().min(1).max(500),
  location_id: z.string().min(1).max(100),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SQUARE_ACCESS_TOKEN = Deno.env.get("SQUARE_ACCESS_TOKEN");
    if (!SQUARE_ACCESS_TOKEN) {
      throw new Error("SQUARE_ACCESS_TOKEN is not configured");
    }

    const body = await req.json();
    const parsed = PaymentSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ success: false, error: parsed.error.issues.map(i => i.message).join(", ") }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amount_cents, currency, description, source_id, location_id } = parsed.data;

    const idempotencyKey = crypto.randomUUID();

    const squareResponse = await fetch("https://connect.squareup.com/v2/payments", {
      method: "POST",
      headers: {
        "Square-Version": "2024-01-18",
        Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: amount_cents,
          currency: currency,
        },
        source_id: source_id,
        location_id: location_id,
        note: description || "Rhozeland Studio Booking",
        autocomplete: true,
      }),
    });

    const squareData = await squareResponse.json();

    if (!squareResponse.ok) {
      console.error("Square API error:", JSON.stringify(squareData));
      const errorDetail = squareData?.errors?.[0]?.detail || "Payment processing failed";
      throw new Error(errorDetail);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: squareData.payment?.id,
        status: squareData.payment?.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Square payment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
