/**
 * draft-pitch-idea — fills in a "Pitch us a new idea" coin-launch proposal
 * from a freeform creator prompt. Returns structured JSON the client can
 * drop straight into the form fields.
 */
// deno-lint-ignore-file no-explicit-any
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
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Prompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You are an A&R assistant at Rhozeland, a music-native creator platform built around pump.fun coin launches. Turn a creator's freeform idea into a tight pitch the A&R team can act on. Be specific, music-literate, and indie-realistic (no "moon" / no hype). Keep it grounded.`;

    const userMsg = `Creator idea:
"""${prompt.trim().slice(0, 4000)}"""

Fill the proposal fields. Respond ONLY by calling the tool.`;

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
          { role: "user", content: userMsg },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "fill_pitch",
              description: "Structured pitch for a new coin-launch proposal.",
              parameters: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Short working release/project title (max 60 chars).",
                  },
                  summary: {
                    type: "string",
                    description: "1–2 paragraph description of the release & coin idea (120–400 chars). Plain prose.",
                  },
                  holder_benefits: {
                    type: "string",
                    description: "What coin holders get (early access, royalties, exclusive drops, etc). 1–2 sentences.",
                  },
                  outcome: {
                    type: "string",
                    description: "Realistic success metric (e.g. 'EP out in Q3, 200 holders, $25k MC').",
                  },
                },
                required: ["title", "summary", "holder_benefits", "outcome"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fill_pitch" } },
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
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments;
    let parsed: any = {};
    if (typeof args === "string") {
      try { parsed = JSON.parse(args); } catch { parsed = {}; }
    } else if (args && typeof args === "object") {
      parsed = args;
    }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
