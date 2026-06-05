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

You write DETAILED, opinionated roadmaps tailored to the specific artist: their archetype (musician/producer/engineer/visual/promoter), recent body of work, region, and (if known) their launched coin. Generic advice is a failure — every milestone must answer "what does THIS artist ship next week, and exactly how do we get holders + listeners to care?"

Market reality you must respect:
- Pump.fun launches thousands of coins daily; attention is the scarcest resource.
- Coins succeed when: (a) the artist shows up live (pump.fun livestream), (b) the art/music is genuinely good, (c) early holders get utility (gated stems, behind-the-scenes, IRL access), (d) the launch has a clear narrative beat.
- Bonding curve graduates ~$69k MC → Raydium handoff; plan a "graduation push" stage when tokenize_intent is true.
- Creator rewards on pump.fun ≈ 0.05% (5 bps) of trading volume — surface this in launch-day targets.

Output rules — be SPECIFIC, DENSE, and NUMERICALLY ACCURATE:
- Return 4-7 milestones.
- BUDGET DISCIPLINE: When totalBudget > 0, the suggested_amounts MUST sum to exactly totalBudget — distribute it by actual cost weight (e.g. studio time, mixing engineer day rates, mastering ~$60-150/track, artwork $150-600, music video $500-5000, marketing/KOLs $200-2000). NEVER pad. NEVER round all stages to the same number. Show your work by making bigger production stages cost more than admin/release stages. If totalBudget is 0, propose a realistic indie budget per stage and let the sum reflect a credible total (typical single $800-2500, EP $2.5k-8k, album $8k-25k all-in).
- TIMELINE DISCIPLINE: Every milestone MUST include est_days as a realistic integer count of CALENDAR days that stage takes (NOT cumulative — days for THAT stage only). Be honest: demoing 1 track ≈ 3-5 days, tracking a band ≈ 2-4 days, mixing a single ≈ 5-10 days, mastering ≈ 2-5 days, artwork ≈ 5-10 days, launch day = 1, week-1 holder activations = 7. Stages run sequentially. Total est_days across all milestones should be a plausible delivery window for the release scope (single ~3-6 weeks, EP ~6-12 weeks, album ~3-6 months). timeline_window is a human label like "Week 1" or "Day of launch" — it must match est_days.
- Group milestones into the four canonical release phases — every milestone MUST be tagged with phase ∈ { "pre_production", "production", "post_production", "release" }. Order milestones chronologically by phase. Typical shape:
  · pre_production: writing, demos, references, contracts, casting, location scouting
  · production: tracking, recording sessions, shoot days, principal capture
  · post_production: mixing, mastering, edit, color, artwork, packaging
  · release: launch day, marketing, drop, livestream, holder activations, week-1 retention
- Each milestone needs:
  · title — names the actual deliverable, not the phase (e.g. "Track 1 + 2 demos + reference mixes", NOT "Pre-production").
  · phase — one of the four canonical values above.
  · deliverables — 3-5 sentences describing the exact creative output, format it ships in, and how it's reviewed/approved.
  · tasks — 4-8 atomic checklist items the artist actually does that week. No filler.
  · timeline_window — short human label aligned to est_days ("Week 1", "Week 2-3", "Day of launch").
  · est_days — integer ≥ 1, calendar days for THIS stage only.
  · suggested_amount — USD whole-dollar cost of THIS stage; must contribute to the budget-sum rule above.
  · marketing_strategy — 2-4 sentences naming the artist's recent works AND linked coin (if present) AND specific channels.
  · target_metric { name, value } — realistic indie numbers.
  · asset_refs — 0-4 reference suggestions { label, kind, note? }. Artist will attach URLs themselves.
  · risks — 1 sentence on the most likely derailment.
- When tokenize_intent=true, include a "Launch day" stage (artwork pack, teaser, KOL list, livestream, holder utility) AND a post-launch retention stage (week 1 holder activations).
- When tokenize_intent=false, coin language stays secondary; focus on the release.`;

  const userPrompt = [
    `Project: ${projectName}`,
    `Total budget (USD): ${totalBudget > 0 ? `$${totalBudget.toFixed(2)}` : "(not set — propose a realistic indie budget)"}`,
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
    `Draft 4-7 DETAILED milestones using the draft_roadmap function. Every milestone must include concrete tasks, a timeline window, asset references, and tie marketing_strategy to the artist's specific recent works.`,
  ].join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt + `\n\nReturn ONLY valid JSON of the shape:\n{ "milestones": [ { "title": string, "phase": "pre_production"|"production"|"post_production"|"release", "deliverables": string, "tasks": string[], "timeline_window": string, "suggested_amount": number, "est_days": number, "marketing_strategy": string, "target_metric": { "name": string, "value": string }, "asset_refs": [{ "label": string, "kind": string, "note"?: string }], "risks": string } ] }\nNo prose, no markdown, no code fences — just the JSON object.` },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 8000,
      temperature: 0.7,
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
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("AI returned no content", JSON.stringify(json).slice(0, 500));
    return new Response(JSON.stringify({ error: "AI returned no content" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let args: any;
  try {
    // Strip code fences if the model added them despite instructions
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    args = JSON.parse(cleaned);
  } catch (e) {
    console.error("AI returned invalid JSON", content.slice(0, 800));
    return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  const raw = (args.milestones ?? []) as Array<any>;

  // Clamp est_days to sane integers (≥1) so downstream date math never breaks.
  const milestones = raw.map((m) => ({
    ...m,
    est_days: Math.max(1, Math.round(Number(m.est_days) || 7)),
    suggested_amount: Math.max(0, Number(m.suggested_amount) || 0),
  }));

  // BUDGET NORMALIZATION — when the caller set a totalBudget, rescale the
  // AI's suggested_amounts so they sum to exactly totalBudget (rounded to
  // whole dollars, with the remainder absorbed by the largest stage so the
  // sum is exact). Preserves the AI's weighting between stages.
  if (totalBudget > 0 && milestones.length) {
    const sum = milestones.reduce((s, m) => s + m.suggested_amount, 0);
    if (sum > 0) {
      let allocated = 0;
      milestones.forEach((m, i) => {
        if (i === milestones.length - 1) {
          m.suggested_amount = Math.max(0, Math.round(totalBudget - allocated));
        } else {
          const share = Math.round((m.suggested_amount / sum) * totalBudget);
          m.suggested_amount = share;
          allocated += share;
        }
      });
    } else {
      // AI returned all zeros — even split as a fallback.
      const even = Math.floor(totalBudget / milestones.length);
      milestones.forEach((m, i) => {
        m.suggested_amount = i === milestones.length - 1
          ? totalBudget - even * (milestones.length - 1)
          : even;
      });
    }
  }

  return new Response(JSON.stringify({ milestones }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
