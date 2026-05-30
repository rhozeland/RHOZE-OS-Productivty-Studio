/**
 * roadmap-copilot edge function — streaming Gemini chat scoped to a single
 * project. Loads project + goals + linked token + collaborators server-side
 * so the client only sends the latest user message + a project_id.
 *
 * Streams SSE back to the browser; client renders token-by-token.
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { project_id, message, history } = await req.json();
    if (!project_id || !message) {
      return new Response(JSON.stringify({ error: "project_id and message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load project context (RLS gates access — non-members get null)
    const { data: project } = await supabase
      .from("projects")
      .select("id, title, description, vision, scope_of_work, total_budget, currency, linked_token_id, user_id")
      .eq("id", project_id)
      .maybeSingle();
    if (!project) return new Response(JSON.stringify({ error: "Project not found or not accessible" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: goals } = await supabase
      .from("project_goals")
      .select("id, title, description, status, due_date, sort_order, parent_id")
      .eq("project_id", project_id)
      .order("sort_order", { ascending: true });

    const { data: collaborators } = await supabase
      .from("project_collaborators")
      .select("user_id, project_role")
      .eq("project_id", project_id);

    let linkedToken: any = null;
    if (project.linked_token_id) {
      const { data } = await supabase
        .from("creator_tokens")
        .select("ticker, name, mint_address")
        .eq("id", project.linked_token_id)
        .maybeSingle();
      linkedToken = data;
    }

    // Owner profile for archetype context
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("display_name, archetype, bio, region_code")
      .eq("user_id", project.user_id)
      .maybeSingle();

    const systemPrompt = `You are the Roadmap Copilot for a music-native creator project on Rhozeland.
Be terse, practical, and music-industry literate (pump.fun, indie release cycles, holder utility, attention economics).

PROJECT
- Title: ${project.title}
- Vision: ${project.vision ?? "—"}
- Scope: ${project.scope_of_work ?? "—"}
- Budget: ${project.total_budget} ${project.currency}
- Owner: ${ownerProfile?.display_name ?? "Unknown"} (${ownerProfile?.archetype ?? "creator"}, ${ownerProfile?.region_code ?? "—"})
- Owner bio: ${ownerProfile?.bio ?? "—"}
- Linked coin: ${linkedToken ? `$${linkedToken.ticker} (${linkedToken.name ?? ""})` : "none"}
- Collaborators: ${(collaborators ?? []).map((c: any) => c.project_role).join(", ") || "solo"}

CURRENT ROADMAP (${(goals ?? []).filter((g: any) => !g.parent_id).length} milestones)
${(goals ?? []).filter((g: any) => !g.parent_id).map((g: any, i: number) => `${i + 1}. [${g.status}] ${g.title}${g.due_date ? ` — due ${g.due_date}` : ""}${g.description ? `\n   ${g.description.slice(0, 200)}` : ""}`).join("\n")}

You help the user think through marketing, sequencing, holder rewards, release timing, collaborator outreach. Answer in plain prose with markdown. Keep responses under 200 words unless the user asks for depth.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (upstream.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await upstream.text();
      console.error("AI gateway error", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("roadmap-copilot error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
