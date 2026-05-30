// Pillar 5 — Music-native, market-aware roadmap drafter.
//
// Takes rich creator context (profile + recent works + linked token + tokenize
// intent + release type) and returns 3-5 milestones — each with a marketing
// strategy paragraph and a target metric — tuned to pump.fun realities.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const Work = z.object({
  title: z.string().max(200).optional().default(""),
  kind: z.string().max(50).nullable().optional(),
  description: z.string().max(800).nullable().optional(),
  mime_type: z.string().max(120).nullable().optional(),
});

const Profile = z.object({
  name: z.string().optional().default(""),
  archetype: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  roles: z.array(z.string()).nullable().optional(),
  region: z.string().nullable().optional(),
  followers: z.number().nullable().optional(),
  token_ticker: z.string().nullable().optional(),
  token_mint: z.string().nullable().optional(),
  recent_works: z.array(Work).max(12).optional().default([]),
});

const Body = z.object({
  projectName: z.string().min(1).max(200),
  totalBudget: z.number().min(0).max(1_000_000),
  tokenize_intent: z.boolean().optional().default(false),
  release_type: z.enum(["single", "ep", "album", "visual", "merch", "tour", "other"])
    .optional().default("other"),
  target_window: z.string().max(120).optional().default(""),
  brief: z.object({
    what: z.string().max(2000).optional().default(""),
    when: z.string().max(500).optional().default(""),
    vibe: z.string().max(500).optional().default(""),
  }).default({ what: "", when: "", vibe: "" }),
  clientProfile: Profile.optional().default({ name: "Client", recent_works: [] }),
  specialistProfile: Profile.optional().default({ name: "Creator", recent_works: [] }),
});

const renderWorks = (works: Array<{ title?: string; kind?: string | null; description?: string | null }>) =>
  works.length
    ? works.slice(0, 8).map((w, i) =>
        `  ${i + 1}. ${w.title || "(untitled)"}${w.kind ? ` [${w.kind}]` : ""}${
          w.description ? ` — ${w.description.slice(0, 140)}` : ""
        }`,
      ).join("\n")
    : "  (no recent works available)";

const renderProfile = (label: string, p: z.infer<typeof Profile>) => {
  const lines = [
    `${label}: ${p.name}${p.archetype ? ` (${p.archetype})` : ""}${p.region ? ` · ${p.region}` : ""}`,
  ];
  if (p.bio) lines.push(`  bio: ${p.bio.slice(0, 280)}`);
  if (p.roles?.length) lines.push(`  roles: ${p.roles.join(", ")}`);
  if (p.token_ticker) lines.push(`  linked coin: $${p.token_ticker}${p.token_mint ? ` (${p.token_mint.slice(0, 8)}…)` : ""}`);
  if (typeof p.followers === "number") lines.push(`  followers: ${p.followers}`);
  if (p.recent_works?.length) {
    lines.push(`  recent works:\n${renderWorks(p.recent_works)}`);
  }
  return lines.join("\n");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const {
    projectName, totalBudget, brief, clientProfile, specialistProfile,
    tokenize_intent, release_type, target_window,
  } = parsed.data;

  const systemPrompt = `You are Rhozeland A&R — a music-industry strategist who plans tokenized music releases on pump.fun.

You write roadmaps that feel hand-crafted to the specific artist: their archetype (musician/producer/engineer/visual/promoter), their recent body of work, their region, and (if known) the coin they've already launched. Every milestone you propose should answer "what does THIS artist ship next, and how do we get holders + listeners to care?"

Market reality you must respect:
- Pump.fun launches thousands of coins daily; attention is the scarcest resource.
- Coins succeed when: (a) the artist shows up live (pump.fun livestream), (b) the art/music is genuinely good, (c) early holders get utility (gated stems, behind-the-scenes, IRL access), (d) the launch has a clear narrative beat (single drop, visual, collab, event).
- Bonding curve graduates around ~$69k market cap → Raydium handoff; plan a "graduation push" stage if tokenize_intent is true.
- Creator rewards on pump.fun ≈ 0.05% (5 bps) of trading volume — surface this in launch-day metrics.

Output rules:
- Return 3-5 milestones whose suggested_amounts sum to roughly the total budget (allow ±10%).
- Each milestone needs a marketing_strategy paragraph that references the artist's archetype + actual recent works + (when present) their linked coin. Be specific, not generic.
- Each milestone needs a target_metric { name, value } that's realistic for an indie artist (e.g. "Holders" 150, "Stream-week plays" 8000, "Pump.fun MC" "$25k"). No vanity inflation.
- When tokenize_intent=true, at least one milestone must be a "Launch day" stage with pump.fun-native deliverables (artwork pack, teaser, KOL list, livestream, holder utility) and another must address post-launch retention (week 1 holder activations).
- When tokenize_intent=false, focus on the release itself — coin language is fine but secondary.`;

  const userPrompt = [
    `Project: ${projectName}`,
    `Total budget (USD): $${totalBudget.toFixed(2)}`,
    `Release type: ${release_type}`,
    `Tokenize intent: ${tokenize_intent ? "YES — plan for a pump.fun coin launch" : "no (release-only)"}`,
    `Target window: ${target_window || "(flexible)"}`,
    ``,
    renderProfile("Specialist (the creator delivering)", specialistProfile),
    ``,
    renderProfile("Client (the requester)", clientProfile),
    ``,
    `What needs to happen: ${brief.what || "(not provided — infer from project name + recent works)"}`,
    `Timeline / when: ${brief.when || "(flexible)"}`,
    `Vibe / direction: ${brief.vibe || "(open)"}`,
    ``,
    `Draft 3-5 milestones for this project using the draft_roadmap function. Tie marketing_strategy to the artist's specific recent works.`,
  ].join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "draft_roadmap",
          description: "Return 3-5 music-native milestone stages tied to the artist's actual work.",
          parameters: {
            type: "object",
            properties: {
              milestones: {
                type: "array",
                minItems: 3,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Short milestone title (≤60 chars)" },
                    deliverables: { type: "string", description: "1-2 sentences: what is delivered at this stage" },
                    suggested_amount: { type: "number", description: "USD allocated to this stage" },
                    est_days: { type: "number", description: "Estimated days for this stage" },
                    marketing_strategy: {
                      type: "string",
                      description: "1-2 sentences explaining how this stage builds audience + holder demand, tied to the artist's archetype and recent works."
                    },
                    target_metric: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Metric name, e.g. Holders, Stream-week plays, Pump.fun MC, Livestream peak viewers" },
                        value: { type: "string", description: "Realistic target value as a string, e.g. '150', '8k', '$25k'" },
                      },
                      required: ["name", "value"],
                      additionalProperties: false,
                    },
                  },
                  required: ["title", "deliverables", "suggested_amount", "est_days", "marketing_strategy", "target_metric"],
                  additionalProperties: false,
                },
              },
            },
            required: ["milestones"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "draft_roadmap" } },
    }),
  });

  if (res.status === 429) {
    return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a minute." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (res.status === 402) {
    return new Response(JSON.stringify({ error: "Lovable AI credits exhausted. Add credits in workspace settings." }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!res.ok) {
    const t = await res.text();
    console.error("AI gateway error:", res.status, t);
    return new Response(JSON.stringify({ error: "AI gateway error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const json = await res.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) {
    return new Response(JSON.stringify({ error: "AI returned no structured output" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let args;
  try { args = JSON.parse(call.function.arguments); }
  catch {
    return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ milestones: args.milestones ?? [] }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
