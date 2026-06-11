/**
 * draft-listing-inquiry — turns a short user brief + listing context into
 * a polished inquiry/pitch message the user can send to a creator.
 * Returns { message: string }.
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

    const {
      brief = "",
      listingTitle = "",
      listingType = "service",
      listingCategory = "",
      sellerName = "",
      inquiryKind = "hire",
    } = await req.json();

    if (!brief || typeof brief !== "string" || brief.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Tell us a bit more about what you need." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kindHint =
      inquiryKind === "pitch"
        ? "The user is PITCHING themselves to take on this project. Frame as why they're a fit, include rate/availability/portfolio hints."
        : inquiryKind === "collab"
          ? "The user is proposing a COLLABORATION. Frame around mutual fit, their role, and what they bring."
          : inquiryKind === "question"
            ? "The user has a QUESTION about the item. Keep it short and specific."
            : "The user wants to HIRE the creator. Include scope, budget, and deadline placeholders if missing.";

    const system = `You write short, warm, professional outreach messages on Rhozeland, a music-native creator platform. Voice: confident, specific, indie-realistic, no hype, no emojis, no "I hope this finds you well". 90–160 words. Plain prose with a couple of short lines (Scope / Budget / Deadline style) only when relevant. Address the creator by first name if provided.`;

    const userMsg = `Listing: "${listingTitle}" (${listingType}${listingCategory ? `, ${listingCategory}` : ""})
Creator: ${sellerName || "the creator"}
Inquiry type: ${inquiryKind}
Guidance: ${kindHint}

User's rough brief:
"""${brief.trim().slice(0, 2000)}"""

Write the message the user should send. Respond ONLY by calling the tool.`;

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
              name: "write_message",
              description: "Polished outreach message ready to send.",
              parameters: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "The full message body (90–160 words, plain prose).",
                  },
                },
                required: ["message"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "write_message" } },
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
    return new Response(JSON.stringify({ message: parsed.message ?? "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
