import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider_token, time_min, time_max } = await req.json();

    if (!provider_token) {
      return new Response(
        JSON.stringify({ error: "Missing Google access token. Please sign in with Google." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const calendarUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    calendarUrl.searchParams.set("singleEvents", "true");
    calendarUrl.searchParams.set("orderBy", "startTime");
    calendarUrl.searchParams.set("maxResults", "100");
    if (time_min) calendarUrl.searchParams.set("timeMin", time_min);
    if (time_max) calendarUrl.searchParams.set("timeMax", time_max);

    const response = await fetch(calendarUrl.toString(), {
      headers: {
        Authorization: `Bearer ${provider_token}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Calendar API error [${response.status}]: ${errorBody}`);
    }

    const data = await response.json();

    const events = (data.items || []).map((event: any) => ({
      id: event.id,
      title: event.summary || "(No title)",
      description: event.description || null,
      start_time: event.start?.dateTime || event.start?.date || null,
      end_time: event.end?.dateTime || event.end?.date || null,
      color: "#4285F4",
      source: "google",
    }));

    return new Response(
      JSON.stringify({ events }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error fetching Google Calendar:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
