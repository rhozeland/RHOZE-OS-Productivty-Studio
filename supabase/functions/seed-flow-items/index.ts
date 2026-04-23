/**
 * seed-flow-items
 * ────────────────────────────────────────────────────────────────────────────
 * Admin-only utility to (re)seed Flow Mode with a curated batch of demo posts.
 *
 *  • POST { dryRun: true }  → returns the seed list and how many would be
 *                              inserted (skips titles already present in
 *                              flow_items).
 *  • POST { dryRun: false } → inserts the missing items as the calling
 *                              admin's user_id.
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

    // ── Compute net-new vs existing (dedupe by title) ─────────────────────
    const titles = SEED_ITEMS.map((s) => s.title);
    const { data: existing, error: existingErr } = await admin
      .from("flow_items")
      .select("title")
      .in("title", titles);
    if (existingErr) {
      return json({ error: existingErr.message }, 500);
    }

    const existingTitles = new Set((existing ?? []).map((r) => r.title));
    const toInsert = SEED_ITEMS.filter((s) => !existingTitles.has(s.title));

    if (dryRun) {
      return json({
        dryRun: true,
        total: SEED_ITEMS.length,
        alreadyPresent: SEED_ITEMS.length - toInsert.length,
        willInsert: toInsert.length,
        items: toInsert.map((s) => ({
          title: s.title,
          category: s.category,
          content_type: s.content_type,
        })),
      });
    }

    if (toInsert.length === 0) {
      return json({
        dryRun: false,
        inserted: 0,
        message: "All seed items already present.",
      });
    }

    const rows = toInsert.map((s) => ({ ...s, user_id: userId }));
    const { error: insertErr } = await admin.from("flow_items").insert(rows);
    if (insertErr) {
      return json({ error: insertErr.message }, 500);
    }

    return json({
      dryRun: false,
      inserted: rows.length,
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
