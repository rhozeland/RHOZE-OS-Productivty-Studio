// generate-project-title — turns a freeform project brief into a short
// working title (3-6 words) AND a 1-2 sentence project description.
// The raw user prompt is never surfaced verbatim in the project page;
// the AI rewrites it into a clean overview.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { prompt } = await req.json();
    const text = (prompt || "").toString().trim();
    if (text.length < 3) {
      return new Response(JSON.stringify({ error: "Prompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system =
      "You name and frame music projects for Rhozeland. Given a creator's freeform brief, return STRICT JSON: " +
      `{"title": string, "description": string}. ` +
      "title = 3-6 words, max 50 chars, Title Case, no quotes, no emoji, no trailing punctuation, evocative but grounded. " +
      "description = 1-2 sentences (max 220 chars) written in third person about the release — what it is and the vibe. " +
      "Do NOT echo the user's prompt verbatim. Do NOT use 'I' or 'my'. No quotes around the description.";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Brief:\n"""${text.slice(0, 2000)}"""\n\nReturn ONLY the JSON object.` },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: `AI gateway ${resp.status}: ${txt}` }), {
        status: resp.status === 402 || resp.status === 429 ? resp.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = (data?.choices?.[0]?.message?.content || "").toString().trim();
    let title = "";
    let description = "";
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
      const parsed = JSON.parse(cleaned);
      title = (parsed?.title ?? "").toString().trim();
      description = (parsed?.description ?? "").toString().trim();
    } catch {
      // fall through — leave defaults
    }

    title = title.replace(/^["'`“”‘’]+|["'`“”‘’.!?]+$/g, "").trim();
    if (title.length > 60) title = title.slice(0, 60).trim();
    if (!title) title = "Untitled Project";

    description = description.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "").trim();
    if (description.length > 260) description = description.slice(0, 260).trim();

    return new Response(JSON.stringify({ title, description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
