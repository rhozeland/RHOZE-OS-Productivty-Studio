// generate-project-title — turns a freeform project description into a short,
// punchy working title (3-6 words). Music-native voice. No quotes, no emoji.
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
      "You name music projects for Rhozeland. Given a creator's freeform brief, return ONE short working title (3-6 words, max 50 chars). Title Case. No quotes, no emoji, no trailing punctuation. Evocative but grounded — not hype.";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Brief:\n"""${text.slice(0, 2000)}"""\n\nReturn ONLY the title, nothing else.` },
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
    let title = (data?.choices?.[0]?.message?.content || "").toString().trim();
    // Strip wrapping quotes / trailing punctuation just in case
    title = title.replace(/^["'`“”‘’]+|["'`“”‘’.!?]+$/g, "").trim();
    if (title.length > 60) title = title.slice(0, 60).trim();
    if (!title) title = "Untitled Project";

    return new Response(JSON.stringify({ title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
