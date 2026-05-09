/**
 * topup-rhoze — buy $RHOZE with a card via Square.
 *
 * Flow:
 *  1. Verify caller's JWT.
 *  2. Charge the supplied Square `source_id` for amount_cents.
 *  3. On success, call `record_rhoze_topup` (SECURITY DEFINER) which
 *     atomically credits user_credits.balance and writes a credit_transactions row.
 *
 * Conversion: 100 $RHOZE = $1 USD.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const Schema = z.object({
  amount_cents: z.number().int().min(100).max(500000), // $1 - $5,000
  source_id: z.string().min(1).max(500),
  location_id: z.string().min(1).max(100),
});

const RHOZE_PER_USD = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

    const SQUARE_ACCESS_TOKEN = Deno.env.get("SQUARE_ACCESS_TOKEN");
    if (!SQUARE_ACCESS_TOKEN) throw new Error("SQUARE_ACCESS_TOKEN not configured");

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ success: false, error: parsed.error.issues.map(i => i.message).join(", ") }, 400);
    }
    const { amount_cents, source_id, location_id } = parsed.data;
    const credits = (amount_cents / 100) * RHOZE_PER_USD;

    // 1) Charge card
    const sqRes = await fetch("https://connect.squareup.com/v2/payments", {
      method: "POST",
      headers: {
        "Square-Version": "2024-01-18",
        Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        amount_money: { amount: amount_cents, currency: "USD" },
        source_id,
        location_id,
        note: `$RHOZE top-up for ${user.id}`,
        autocomplete: true,
      }),
    });
    const sqData = await sqRes.json();
    if (!sqRes.ok) {
      const detail = sqData?.errors?.[0]?.detail || "Payment failed";
      return json({ success: false, error: detail }, 400);
    }
    const paymentId: string = sqData.payment?.id ?? "unknown";

    // 2) Credit balance + ledger via SECURITY DEFINER RPC (service role)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: rpcErr } = await admin.rpc("record_rhoze_topup", {
      p_user_id: user.id,
      p_credits: credits,
      p_amount_cents: amount_cents,
      p_payment_reference: paymentId,
    });
    if (rpcErr) {
      console.error("record_rhoze_topup failed", rpcErr, "payment", paymentId);
      // Card was charged; surface a clear message so support can reconcile.
      return json({
        success: false,
        error: `Payment captured (${paymentId}) but credit ledger update failed. Contact support.`,
      }, 500);
    }

    return json({ success: true, payment_id: paymentId, credits });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("topup-rhoze error:", msg);
    return json({ success: false, error: msg }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
