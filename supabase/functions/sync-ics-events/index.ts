// Fetch a public ICS feed (e.g. Luma calendar) and mirror upcoming VEVENTs
// into the caller's `events` table as draft external rows.
//
// Body: { ics_url?: string }  (falls back to profiles.luma_ics_url)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "ics";
const MAX_EVENTS = 50;

function unfold(ics: string): string[] {
  // RFC5545: continuation lines start with space or tab
  return ics
    .replace(/\r\n/g, "\n")
    .split("\n")
    .reduce<string[]>((acc, line) => {
      if (/^[ \t]/.test(line) && acc.length) {
        acc[acc.length - 1] += line.slice(1);
      } else {
        acc.push(line);
      }
      return acc;
    }, []);
}

function decode(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseDate(raw: string): string | null {
  // Formats: YYYYMMDDTHHMMSSZ, YYYYMMDDTHHMMSS, YYYYMMDD
  const v = raw.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh = "00", mm = "00", ss = "00", z] = m;
  const iso = `${y}-${mo}-${d}T${hh}:${mm}:${ss}${z ? "Z" : "Z"}`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

interface VEvent {
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  location?: string;
  starts_at: string;
  ends_at: string;
}

function parseICS(ics: string): VEvent[] {
  const lines = unfold(ics);
  const events: VEvent[] = [];
  let cur: Partial<VEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur?.uid && cur.summary && cur.starts_at && cur.ends_at) {
        events.push(cur as VEvent);
      }
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
      else if (key === "DTSTART") {
        const d = parseDate(value);
        if (d) cur.starts_at = d;
      } else if (key === "DTEND") {
        const d = parseDate(value);
        if (d) cur.ends_at = d;
      }
    }
  }
  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let icsUrl: string | undefined = body?.ics_url;
    if (!icsUrl) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("luma_ics_url")
        .eq("user_id", user.id)
        .maybeSingle();
      icsUrl = prof?.luma_ics_url ?? undefined;
    }
    if (!icsUrl || !/^https?:\/\//i.test(icsUrl)) {
      return new Response(JSON.stringify({ error: "missing_ics_url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist URL for next run
    await supabase.from("profiles")
      .update({ luma_ics_url: icsUrl, ics_last_synced_at: new Date().toISOString() })
      .eq("user_id", user.id);

    const resp = await fetch(icsUrl, { headers: { Accept: "text/calendar" } });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `fetch_failed_${resp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ics = await resp.text();
    const parsed = parseICS(ics);
    const now = Date.now();
    const upcoming = parsed
      .filter((e) => Date.parse(e.ends_at) >= now)
      .slice(0, MAX_EVENTS);

    let inserted = 0;
    let updated = 0;
    for (const ev of upcoming) {
      const isOnline = !!ev.url && /^https?:\/\//.test(ev.url) && !ev.location;
      const payload = {
        host_id: user.id,
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
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("host_id", user.id)
        .eq("external_source", SOURCE)
        .eq("external_uid", ev.uid)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from("events").update(payload).eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("events").insert(payload);
        inserted++;
      }
    }

    return new Response(JSON.stringify({ ok: true, inserted, updated, total: upcoming.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-ics-events error", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
