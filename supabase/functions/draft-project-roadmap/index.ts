// Gemini-powered roadmap drafter.
// Takes a project name + budget + both creators' profiles + a short brief,
// returns 3-5 structured milestones the user can then edit inline.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const Body = z.object({
  projectName: z.string().min(1).max(200),
  totalBudget: z.number().min(0).max(1_000_000),
  brief: z.object({
    what: z.string().max(2000).optional().default(""),
    when: z.string().max(500).optional().default(""),
    vibe: z.string().max(500).optional().default(""),
  }).default({ what: "", when: "", vibe: "" }),
  clientProfile: z.object({
    name: z.string().optional().default("Client"),
    archetype: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
  }).optional().default({ name: "Client" }),
  specialistProfile: z.object({
    name: z.string().optional().default("Creator"),
    archetype: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    roles: z.array(z.string()).nullable().optional(),
  }).optional().default({ name: "Creator" }),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { projectName, totalBudget, brief, clientProfile, specialistProfile } = parsed.data;

  const systemPrompt = `You are Rhozeland A&R — an expert music-industry project planner. You draft pragmatic, stage-by-stage roadmaps for creative projects between a client and a creator. Keep milestones concrete, music-native when relevant, and proportional to the budget. Always return 3 to 5 milestones whose suggested amounts sum to roughly the total budget.`;

  const userPrompt = [
    `Project: ${projectName}`,
    `Total budget (USD): $${totalBudget.toFixed(2)}`,
    `Client: ${clientProfile.name}${clientProfile.archetype ? ` (${clientProfile.archetype})` : ""}${clientProfile.bio ? ` — ${clientProfile.bio}` : ""}`,
    `Creator: ${specialistProfile.name}${specialistProfile.archetype ? ` (${specialistProfile.archetype})` : ""}${specialistProfile.bio ? ` — ${specialistProfile.bio}` : ""}${specialistProfile.roles?.length ? ` · roles: ${specialistProfile.roles.join(", ")}` : ""}`,
    `What needs to happen: ${brief.what || "(not provided — infer from project name)"}`,
    `Timeline / when: ${brief.when || "(flexible)"}`,
    `Vibe / direction: ${brief.vibe || "(open)"}`,
    ``,
    `Draft 3-5 milestones for this project. Use the draft_roadmap function.`,
  ].join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "draft_roadmap",
          description: "Return 3-5 milestone stages for this project.",
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
                    deliverables: { type: "string", description: "1-2 sentence description of what's delivered at this stage" },
                    suggested_amount: { type: "number", description: "USD allocated to this stage" },
                    est_days: { type: "number", description: "Estimated days for this stage" },
                  },
                  required: ["title", "deliverables", "suggested_amount", "est_days"],
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
