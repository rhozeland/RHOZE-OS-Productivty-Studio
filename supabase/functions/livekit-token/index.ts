import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Minimal JWT helpers for LiveKit access tokens
function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function textToUint8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  identity: string,
  displayName: string,
  canPublish: boolean,
  canSubscribe: boolean,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: apiKey,
    sub: identity,
    name: displayName,
    nbf: now,
    exp: now + 6 * 3600, // 6 hour token
    video: {
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe,
      canPublishData: canPublish,
    },
  };

  const encodedHeader = base64url(textToUint8(JSON.stringify(header)));
  const encodedPayload = base64url(textToUint8(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    textToUint8(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textToUint8(signingInput)),
  );

  return `${signingInput}.${base64url(signature)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      throw new Error("LiveKit secrets not configured");
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { room_id, role } = await req.json();
    if (!room_id) throw new Error("room_id required");

    // Verify room exists and has video enabled
    const { data: room, error: roomErr } = await supabase
      .from("drop_rooms")
      .select("id, title, enable_video, allow_spectators")
      .eq("id", room_id)
      .single();

    if (roomErr || !room) throw new Error("Room not found");
    if (!room.enable_video) throw new Error("Video is not enabled for this room");

    const isSpectator = role === "spectator";
    if (isSpectator && !room.allow_spectators) {
      throw new Error("Spectators not allowed in this room");
    }

    // Get user display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const displayName = profile?.display_name || user.email || "Anonymous";
    const roomName = `drop-room-${room_id}`;

    const token = await createLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      roomName,
      user.id,
      displayName,
      !isSpectator, // canPublish
      true, // canSubscribe
    );

    return new Response(
      JSON.stringify({ token, url: LIVEKIT_URL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
