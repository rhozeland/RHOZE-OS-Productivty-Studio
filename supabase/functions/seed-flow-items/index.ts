/**
 * seed-flow-items
 * ────────────────────────────────────────────────────────────────────────────
 * Admin-only utility to (re)seed Flow Mode with a curated batch of demo posts.
 *
 *  • POST { dryRun: true }  → returns the seed list and how many would be
 *                              inserted (skips titles already present in
 *                              flow_items). Each item also reports whether
 *                              its external media URL is reachable, and
 *                              which fallback would be substituted if not.
 *  • POST { dryRun: false } → inserts the missing items as the calling
 *                              admin's user_id, swapping in fallback URLs
 *                              for any external media that failed validation.
 *
 * Auth: requires a JWT for an account that has the `admin` role in
 *       public.user_roles. We validate in-code (verify_jwt is off by default
 *       for Lovable-managed functions).
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

type SeedItem = {
  title: string;
  description: string;
  category: string;
  content_type: "image" | "link" | "video";
  file_url: string | null;
  link_url: string | null;
  creator_name: string;
  tags: string[];
};

// ── Fallback media ──────────────────────────────────────────────────────────
// Used when an external image/link fails a HEAD probe. Picked to be:
//   • permissive of CORS / hotlinking,
//   • thematically close to the seed post (image vs. audio/link),
//   • hosted on infra we already trust elsewhere in the seed list.
//
// Keep these dead-simple — if THESE fall over the seed should still insert
// rows (with the broken URL) rather than 500. We log the failure either way.
const FALLBACK_IMAGE_URL =
  "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1200"; // safe Unsplash perennial
const FALLBACK_LINK_URL = "https://en.wikipedia.org/wiki/Creative_work";
const FALLBACK_AUDIO_LINK_URL = "https://en.wikipedia.org/wiki/Field_recording";

// Curated seed list. Titles are unique and used as the dedupe key in dry-run.
const SEED_ITEMS: SeedItem[] = [
  {
    title: "Brutalist studio lights",
    description: "Concrete + neon mood study from a Berlin warehouse session.",
    category: "design",
    content_type: "image",
    file_url: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200",
    link_url: null,
    creator_name: "Studio Demo",
    tags: ["mood", "lighting"],
  },
  {
    title: "Field recording — rain on tin roof",
    description: "8 min loop, royalty-free, great for ambient layers.",
    category: "music",
    content_type: "link",
    file_url: null,
    link_url: "https://freesound.org/people/InspectorJ/sounds/346642/",
    creator_name: "FieldKit",
    tags: ["ambient", "foley"],
  },
  {
    title: "Editorial typography reference",
    description: "Magazine spread breakdown — grid, hierarchy, weight pairing.",
    category: "design",
    content_type: "image",
    file_url: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200",
    link_url: null,
    creator_name: "Press Room",
    tags: ["typography", "editorial"],
  },
  {
    title: "Color study: dusk palette",
    description: "Six-stop gradient pulled from a sunset over the bay.",
    category: "design",
    content_type: "image",
    file_url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200",
    link_url: null,
    creator_name: "Hue Lab",
    tags: ["color", "palette"],
  },
  {
    title: "Generative loop — particles",
    description: "p5.js sketch, BPM-synced. MIT licensed.",
    category: "code",
    content_type: "link",
    file_url: null,
    link_url: "https://editor.p5js.org/",
    creator_name: "Codex",
    tags: ["generative", "p5"],
  },
  {
    title: "Studio session BTS",
    description: "Behind-the-scenes from yesterday's tracking session.",
    category: "music",
    content_type: "image",
    file_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200",
    link_url: null,
    creator_name: "Loft Sessions",
    tags: ["bts", "studio"],
  },
  {
    title: "Texture pack: weathered concrete",
    description: "12 high-res scans, free to remix.",
    category: "design",
    content_type: "image",
    file_url: "https://images.unsplash.com/photo-1503602642458-232111445657?w=1200",
    link_url: null,
    creator_name: "Surface Co.",
    tags: ["texture", "freebie"],
  },
  {
    title: "Reading: Why we still need zines",
    description: "A short essay on independent print culture in 2026.",
    category: "writing",
    content_type: "link",
    file_url: null,
    link_url: "https://en.wikipedia.org/wiki/Zine",
    creator_name: "Margins",
    tags: ["essay", "zine"],
  },
  {
    title: "Process video: screen-print layering",
    description: "4-color separation walkthrough, 90 seconds.",
    category: "design",
    content_type: "image",
    file_url: "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=1200",
    link_url: null,
    creator_name: "Ink House",
    tags: ["print", "process"],
  },
  {
    title: "Album art draft — Side B",
    description: "Working draft for a friend's EP. WIP, feedback welcome.",
    category: "design",
    content_type: "image",
    file_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200",
    link_url: null,
    creator_name: "Cover Lab",
    tags: ["wip", "music"],
  },
  {
    title: "Sketchbook page — character study",
    description: "Pen + watercolor, 30 min sketch.",
    category: "art",
    content_type: "image",
    file_url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200",
    link_url: null,
    creator_name: "Daily Draw",
    tags: ["sketch", "ink"],
  },
  {
    title: "Reference: cinematic framing breakdown",
    description: "Shot study from a recent indie short. Worth a watch.",
    category: "video",
    content_type: "link",
    file_url: null,
    link_url: "https://en.wikipedia.org/wiki/Cinematography",
    creator_name: "Frame School",
    tags: ["cinema", "reference"],
  },
];

// ── URL probing ─────────────────────────────────────────────────────────────
type ProbeResult = { ok: boolean; status?: number; error?: string };

/**
 * Quick HEAD probe with a short timeout. We accept any 2xx/3xx response as
 * "reachable" — some CDNs (Unsplash, Wikipedia) return redirects on HEAD that
 * still resolve to a usable resource.
 */
async function probeUrl(url: string, timeoutMs = 4000): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    // Some hosts (notably freesound.org) reject HEAD with 405. Retry GET with
    // a tiny range so we don't pull the whole asset.
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { Range: "bytes=0-0" },
        signal: controller.signal,
      });
    }
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

type ResolvedItem = SeedItem & {
  /** True if any media URL on this item failed probing and was swapped. */
  usedFallback: boolean;
  /** Diagnostic info per probed slot (omitted when nothing was probed). */
  probe?: {
    file_url?: ProbeResult & { fallback?: string };
    link_url?: ProbeResult & { fallback?: string };
  };
};

/**
 * Probes every external media URL in parallel and returns each seed item with
 * fallbacks applied where necessary. Always returns a usable record — broken
 * URLs are swapped with safe defaults rather than dropped from the seed.
 */
async function resolveSeedMedia(items: SeedItem[]): Promise<ResolvedItem[]> {
  return await Promise.all(
    items.map(async (item) => {
      const probe: ResolvedItem["probe"] = {};
      let usedFallback = false;
      let file_url = item.file_url;
      let link_url = item.link_url;

      if (item.file_url) {
        const r = await probeUrl(item.file_url);
        if (!r.ok) {
          file_url = FALLBACK_IMAGE_URL;
          usedFallback = true;
          probe.file_url = { ...r, fallback: FALLBACK_IMAGE_URL };
        } else {
          probe.file_url = r;
        }
      }

      if (item.link_url) {
        const r = await probeUrl(item.link_url);
        if (!r.ok) {
          // Music-tagged links get the audio-themed fallback so the swap stays
          // contextually relevant on a Flow card.
          const fallback =
            item.category === "music" ? FALLBACK_AUDIO_LINK_URL : FALLBACK_LINK_URL;
          link_url = fallback;
          usedFallback = true;
          probe.link_url = { ...r, fallback };
        } else {
          probe.link_url = r;
        }
      }

      return { ...item, file_url, link_url, usedFallback, probe };
    }),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Validate JWT in-code ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User-scoped client → resolve who's calling.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Invalid auth token" }, 401);
    }
    const userId = userData.user.id;

    // Admin client → role check + privileged inserts.
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr || !roleRow) {
      return json({ error: "Admin role required" }, 403);
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let dryRun = true;
    try {
      const body = await req.json();
      if (typeof body?.dryRun === "boolean") dryRun = body.dryRun;
    } catch {
      // empty body → treat as dry run
    }

    // ── Match seeds against existing rows by title (idempotent) ──────────
    // Rerunning the seed UPDATES existing rows in place rather than skipping
    // them, so edits to descriptions, tags, categories, or media URLs in the
    // SEED_ITEMS array propagate on the next run without duplicating posts.
    const titles = SEED_ITEMS.map((s) => s.title);
    const { data: existing, error: existingErr } = await admin
      .from("flow_items")
      .select("id, title")
      .in("title", titles);
    if (existingErr) {
      return json({ error: existingErr.message }, 500);
    }

    const existingByTitle = new Map(
      (existing ?? []).map((r) => [r.title, r.id] as const),
    );

    // Probe ALL seed items (both new and existing) so updates also benefit
    // from fallback URL substitution if originals have since broken.
    const resolved = await resolveSeedMedia(SEED_ITEMS);
    const toInsert = resolved.filter((r) => !existingByTitle.has(r.title));
    const toUpdate = resolved.filter((r) => existingByTitle.has(r.title));

    // Build the failure log (only items that needed a fallback).
    const failedItems = resolved
      .filter((r) => r.usedFallback)
      .map((r) => ({
        title: r.title,
        category: r.category,
        file_url_probe: r.probe?.file_url,
        link_url_probe: r.probe?.link_url,
      }));

    // Server-side log so failures show up in edge function logs even when the
    // admin closes the panel before reading the response.
    if (failedItems.length > 0) {
      console.warn(
        `[seed-flow-items] ${failedItems.length} seed item(s) needed fallback URLs:`,
        JSON.stringify(failedItems, null, 2),
      );
    }

    if (dryRun) {
      return json({
        dryRun: true,
        total: SEED_ITEMS.length,
        alreadyPresent: SEED_ITEMS.length - resolved.length,
        willInsert: resolved.length,
        fallbackCount: failedItems.length,
        items: resolved.map((s) => ({
          title: s.title,
          category: s.category,
          content_type: s.content_type,
          usedFallback: s.usedFallback,
        })),
        failedItems,
      });
    }

    if (resolved.length === 0) {
      return json({
        dryRun: false,
        inserted: 0,
        fallbackCount: 0,
        failedItems: [],
        message: "All seed items already present.",
      });
    }

    const rows = resolved.map((s) => ({
      title: s.title,
      description: s.description,
      category: s.category,
      content_type: s.content_type,
      file_url: s.file_url,
      link_url: s.link_url,
      creator_name: s.creator_name,
      tags: s.tags,
      user_id: userId,
    }));

    const { error: insertErr } = await admin.from("flow_items").insert(rows);
    if (insertErr) {
      return json({ error: insertErr.message }, 500);
    }

    return json({
      dryRun: false,
      inserted: rows.length,
      fallbackCount: failedItems.length,
      failedItems,
      titles: rows.map((r) => r.title),
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
