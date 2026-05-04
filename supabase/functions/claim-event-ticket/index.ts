/**
 * claim-event-ticket — guest-or-user ticket issuance.
 *
 * Body: { event_id, tier_id, name, email, payment?: { currency, reference, amount } }
 *
 * 1. Look up auth user by email; if missing, create one (no password)
 *    and a matching profile. Send a magic-link so they can sign in.
 * 2. Issue an event_tickets row owned by that user.
 *    - tier_kind=paid    → status='issued', requires payment
 *    - tier_kind=free_rsvp → status='issued'
 *    - tier_kind=request → status='pending_approval'
 * 3. Insert settlement row for paid tickets (tier-based platform fee).
 * 4. Send confirmation email via send-transactional-email.
 *
 * Returns: { ticket_id, status, account_created }
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const platformFeeBps = (balance: number): number => {
  // Mirror src/lib/platform-fee.ts: Spark/Bloom 1500, Glow 1000, Play 700
  if (balance >= 1_000_000) return 700;
  if (balance >= 100_000) return 1000;
  return 1500;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json();
    const { event_id, tier_id, name, email, payment } = body ?? {};
    if (!event_id || !tier_id || !email || !name) {
      return json({ error: "Missing required fields" }, 400);
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return json({ error: "Invalid email" }, 400);
    }
    const cleanName = String(name).trim().slice(0, 80);
    if (cleanName.length < 1) return json({ error: "Name required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Load tier + event, validate availability
    const { data: tier, error: tierErr } = await admin
      .from("event_ticket_tiers")
      .select("id, event_id, name, tier_kind, price_usd, price_rhoze, currency_code, quantity_total, quantity_sold, is_active")
      .eq("id", tier_id)
      .maybeSingle();
    if (tierErr || !tier) return json({ error: "Tier not found" }, 404);
    if (!tier.is_active) return json({ error: "Tier closed" }, 400);
    if (tier.event_id !== event_id) return json({ error: "Tier/event mismatch" }, 400);
    if (tier.quantity_total != null && tier.quantity_sold >= tier.quantity_total) {
      return json({ error: "Sold out" }, 409);
    }

    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("id, title, host_id, starts_at, ends_at, venue_name, venue_address, is_online, cover_url")
      .eq("id", event_id)
      .maybeSingle();
    if (evErr || !ev) return json({ error: "Event not found" }, 404);

    const tierKind = tier.tier_kind || "paid";
    const isPaid = tierKind === "paid";
    if (isPaid && !payment?.reference) {
      return json({ error: "Payment required for paid tier" }, 400);
    }

    // 2. Find or create user
    let userId: string | null = null;
    let accountCreated = false;

    // Try via admin: list users filtered by email (page through if needed)
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail,
    );
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true, // pre-verify so magic links work without bounce
        user_metadata: { full_name: cleanName, source: "event_checkout" },
      });
      if (createErr || !created.user) {
        return json({ error: createErr?.message ?? "Could not create account" }, 500);
      }
      userId = created.user.id;
      accountCreated = true;
      // Create matching profile row
      await admin.from("profiles").insert({
        user_id: userId,
        display_name: cleanName,
        username: `u_${userId.slice(0, 8)}`,
      } as any);
    }

    // 3. Issue ticket
    const qrToken = `tk_${crypto.randomUUID().replace(/-/g, "")}`;
    const status = tierKind === "request" ? "pending_approval" : "issued";
    const purchaseCurrency: "free" | "usd" | "rhoze" =
      isPaid ? (payment.currency === "rhoze" ? "rhoze" : "usd") : "free";
    const amountPaid = isPaid ? Number(payment.amount) || 0 : 0;

    const { data: ticket, error: ticketErr } = await admin
      .from("event_tickets")
      .insert({
        event_id,
        tier_id,
        holder_id: userId,
        guest_name: accountCreated ? cleanName : null,
        guest_email: accountCreated ? cleanEmail : null,
        qr_token: qrToken,
        purchase_currency: purchaseCurrency,
        amount_paid: amountPaid,
        payment_reference: isPaid ? payment.reference : null,
        status,
        requested_at: tierKind === "request" ? new Date().toISOString() : null,
      } as any)
      .select()
      .single();
    if (ticketErr) return json({ error: ticketErr.message }, 500);

    // Bump quantity_sold (best-effort; tier RLS allows host only, service role bypasses)
    await admin
      .from("event_ticket_tiers")
      .update({ quantity_sold: tier.quantity_sold + 1 })
      .eq("id", tier_id);

    // 4. Settlement for paid tickets
    if (isPaid && amountPaid > 0 && ev.host_id) {
      const { data: hostCredits } = await admin
        .from("user_credits")
        .select("balance")
        .eq("user_id", ev.host_id)
        .maybeSingle();
      const feeBps = platformFeeBps(Number(hostCredits?.balance) || 0);
      const platformAmount = +(amountPaid * feeBps / 10000).toFixed(4);
      const hostAmount = +(amountPaid - platformAmount).toFixed(4);
      await admin.from("event_ticket_settlements").insert({
        ticket_id: ticket.id,
        event_id,
        host_id: ev.host_id,
        buyer_id: userId,
        currency: purchaseCurrency,
        gross_amount: amountPaid,
        host_amount: hostAmount,
        reserve_amount: 0,
        platform_amount: platformAmount,
        payment_reference: payment.reference,
      } as any);
    }

    // 5. Confirmation email (best-effort, don't block on failure)
    try {
      const startStr = new Date(ev.starts_at).toLocaleString("en-US", {
        weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      const venue = ev.is_online
        ? "Online — link will be shared closer to the event"
        : (ev.venue_name ?? "Venue TBA");
      const ticketUrl = `https://rhozeland.app/tickets/${ticket.id}`;
      await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "event-ticket-confirmation",
          recipientEmail: cleanEmail,
          idempotencyKey: `ticket-confirm-${ticket.id}`,
          templateData: {
            name: cleanName,
            eventTitle: ev.title,
            eventDate: startStr,
            venue,
            ticketUrl,
            tierName: tier.name,
            status,
            accountCreated,
          },
        },
      });
    } catch (emailErr) {
      console.warn("ticket email enqueue failed", emailErr);
    }

    return json({
      ticket_id: ticket.id,
      status,
      account_created: accountCreated,
      user_id: userId,
    });
  } catch (err) {
    console.error("claim-event-ticket error", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
