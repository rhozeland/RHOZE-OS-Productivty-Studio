// Re-hash a file stored in Supabase Storage (used to backfill old Flow uploads
// into a Work record on opt-in). Returns { hash, size, mime } so the caller
// can create a Work + verification request.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond(401, { error: "No auth" });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return respond(401, { error: "Unauthorized" });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return respond(400, { error: "Invalid JSON" }); }
    const file_url = body.file_url as string | undefined;
    if (!file_url || !/^https?:\/\//.test(file_url))
      return respond(400, { error: "file_url required" });

    // Fetch the file (works for both public buckets and signed URLs)
    const r = await fetch(file_url);
    if (!r.ok) return respond(400, { error: `Could not fetch file (${r.status})` });
    const buf = await r.arrayBuffer();
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);

    return respond(200, {
      hash: bytesToHex(hashBuf),
      size: buf.byteLength,
      mime: r.headers.get("content-type") ?? null,
    });
  } catch (err) {
    console.error("rehash-stored-file error:", err);
    return respond(500, {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
