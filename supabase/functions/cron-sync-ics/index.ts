// Service-role sweep: pulls every profile with a luma_ics_url and re-syncs
// their feed. Invoked by pg_cron every 6h. Reuses the same parser as the
// per-user `sync-ics-events` function.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "ics";
const MAX_EVENTS_PER_USER = 50;
const MAX_USERS_PER_RUN = 200;

function unfold(ics: string): string[] {
  return ics.replace(/\r\n/g, "\n").split("\n").reduce<string[]>((acc, line) => {
    if (/^[ \t]/.test(line) && acc.length) acc[acc.length - 1] += line.slice(1);
    else acc.push(line);
    return acc;
  }, []);
}
function decode(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
function parseDate(raw: string): string | null {
  const v = raw.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
  const t = Date.parse(`${y}-${mo}-${d}T${hh}:${mm}:${ss}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
interface VEvent { uid: string; summary: string; description?: string; url?: string; location?: string; starts_at: string; ends_at: string }
function parseICS(ics: string): VEvent[] {
  const lines = unfold(ics);
  const out: VEvent[] = [];
  let cur: Partial<VEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.uid && cur.summary && cur.starts_at && cur.ends_at) out.push(cur as VEvent);
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const left = line.slice(0, idx);
      const value = line.slice(idx + 1);
      const key = left.split(";")[0].toUpperCase();
      if (key === "UID") cur.uid = value.trim();
      else if (key === "SUMMARY") cur.summary = decode(value);
      else if (key === "DESCRIPTION") cur.description = decode(value);
      else if (key === "URL") cur.url = value.trim();
      else if (key === "LOCATION") cur.location = decode(value);
      else if (key === "DTSTART") { const d = parseDate(value); if (d) cur.starts_at = d; }
      else if (key === "DTEND") { const d = parseDate(value); if (d) cur.ends_at = d; }
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("user_id, luma_ics_url")
      .not("luma_ics_url", "is", null)
      .limit(MAX_USERS_PER_RUN);
    if (error) throw error;

    let users = 0;
    let inserted = 0;
    let updated = 0;
    let failures = 0;

    for (const p of profiles ?? []) {
      const url = p.luma_ics_url as string;
      if (!url || !/^https?:\/\//i.test(url)) continue;
      users++;
      try {
        const resp = await fetch(url, { headers: { Accept: "text/calendar" } });
        if (!resp.ok) { failures++; continue; }
        const ics = await resp.text();
        const now = Date.now();
        const upcoming = parseICS(ics).filter((e) => Date.parse(e.ends_at) >= now).slice(0, MAX_EVENTS_PER_USER);

        for (const ev of upcoming) {
          const isOnline = !!ev.url && /^https?:\/\//.test(ev.url) && !ev.location;
          const payload = {
            host_id: p.user_id,
            title: ev.summary.slice(0, 200),
            description: [ev.description, ev.url ? `\n\nRSVP: ${ev.url}` : ""].filter(Boolean).join(""),
            starts_at: ev.starts_at,
            ends_at: ev.ends_at,
            is_online: isOnline,
            online_url: isOnline ? ev.url : null,
            venue_name: ev.location ?? null,
            venue_address: ev.location ?? null,
            status: "published" as const,
            external_source: SOURCE,
            external_uid: ev.uid,
            external_url: ev.url ?? null,
            external_synced_at: new Date().toISOString(),
          };
          const { data: existing } = await admin
            .from("events")
            .select("id")
            .eq("host_id", p.user_id)
            .eq("external_source", SOURCE)
            .eq("external_uid", ev.uid)
            .maybeSingle();
          if (existing?.id) { await admin.from("events").update(payload).eq("id", existing.id); updated++; }
          else { await admin.from("events").insert(payload); inserted++; }
        }
        await admin.from("profiles").update({ ics_last_synced_at: new Date().toISOString() }).eq("user_id", p.user_id);
      } catch (e) {
        console.error("ics sweep user failed", p.user_id, e);
        failures++;
      }
    }

    return new Response(JSON.stringify({ ok: true, users, inserted, updated, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cron-sync-ics fatal", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
