// Mints a short-lived signed URL for a token-gated Work, but only after
// re-running the gating check server-side with the caller's JWT. This stops
// any attempt to forge a "qualified" call by hitting the storage API directly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate the caller and run the gating RPC under their identity.
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      token,
    );
    if (claimsErr || !claims?.claims?.sub) {
      return json(401, { error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const workId: string | undefined = body?.work_id;
    if (!workId || typeof workId !== "string") {
      return json(400, { error: "work_id required" });
    }

    const { data: gateResult, error: gateErr } = await userClient.rpc(
      "request_work_unlock",
      { _work_id: workId },
    );
    if (gateErr) {
      return json(500, { error: gateErr.message });
    }
    const gate = gateResult as Record<string, unknown> | null;
    if (!gate || gate.allowed !== true) {
      return json(200, gate ?? { allowed: false, reason: "unknown" });
    }

    const gatedPath = gate.gated_path as string | undefined;
    if (!gatedPath) {
      return json(500, { error: "Missing gated_path" });
    }

    // Mint the signed URL with the service role so RLS on the private bucket
    // can stay strict (owner-only direct reads).
    const adminClient = createClient(url, service);
    const { data: signed, error: signErr } = await adminClient.storage
      .from("gated-works")
      .createSignedUrl(gatedPath, 300);
    if (signErr || !signed?.signedUrl) {
      return json(500, { error: signErr?.message ?? "Could not sign URL" });
    }

    return json(200, {
      allowed: true,
      signed_url: signed.signedUrl,
      balance: gate.balance ?? 0,
      threshold: gate.threshold ?? 0,
      ticker: gate.ticker ?? null,
      is_owner: gate.is_owner ?? false,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
