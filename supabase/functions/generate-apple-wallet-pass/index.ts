/**
 * generate-apple-wallet-pass
 *
 * Generates a signed `.pkpass` for an event ticket the caller owns.
 *
 * Requires Apple Developer credentials (added as Supabase secrets):
 *   APPLE_PASS_TYPE_ID            (e.g. pass.app.rhozeland.ticket)
 *   APPLE_TEAM_ID                 (10-char alphanumeric)
 *   APPLE_PASS_CERT_P12_BASE64    base64 of your Pass Type ID .p12
 *   APPLE_PASS_CERT_PASSWORD      password for the .p12
 *   APPLE_WWDR_CERT_PEM           Apple WWDR intermediate cert (PEM)
 *
 * Until those secrets are configured, the function returns a friendly
 * 501 so the UI can surface "not ready yet" without crashing.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticket_id } = await req.json().catch(() => ({}));
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ticket, error } = await supabase
      .from("event_tickets")
      .select("id, holder_id, qr_token, event:events(title, starts_at, venue_name, is_online)")
      .eq("id", ticket_id)
      .single();

    if (error || !ticket || ticket.holder_id !== user.id) {
      return new Response(JSON.stringify({ error: "ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const passTypeId = Deno.env.get("APPLE_PASS_TYPE_ID");
    const teamId = Deno.env.get("APPLE_TEAM_ID");
    const certB64 = Deno.env.get("APPLE_PASS_CERT_P12_BASE64");
    const certPwd = Deno.env.get("APPLE_PASS_CERT_PASSWORD");
    const wwdrPem = Deno.env.get("APPLE_WWDR_CERT_PEM");

    if (!passTypeId || !teamId || !certB64 || !certPwd || !wwdrPem) {
      return new Response(
        JSON.stringify({
          error: "Apple Wallet not configured yet. Add your Pass Type ID and signing certificate to enable this.",
          configured: false,
        }),
        {
          status: 501,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // TODO: Real .pkpass signing with the configured cert.
    // (Requires PKCS#7 signing — pulled in lazily once user adds certs.)
    return new Response(
      JSON.stringify({
        error: "Apple Wallet signer not yet implemented. Certs are configured — wire up PKCS#7 next.",
        configured: true,
      }),
      {
        status: 501,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
