// @ts-nocheck
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_drive/drive/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_DRIVE_API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY');
    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google Drive connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const q: string = (body?.q ?? '').trim();
    const pageSize: number = Math.min(Math.max(Number(body?.pageSize) || 25, 1), 100);

    const params = new URLSearchParams({
      pageSize: String(pageSize),
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,thumbnailLink)',
    });
    if (q) {
      const safe = q.replace(/'/g, "\\'");
      params.set('q', `name contains '${safe}' and trashed = false`);
    } else {
      params.set('q', 'trashed = false');
    }

    const resp = await fetch(`${GATEWAY_URL}/files?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_DRIVE_API_KEY,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(
        JSON.stringify({ error: `Drive API ${resp.status}: ${text.slice(0, 240)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await resp.json();
    return new Response(JSON.stringify({ files: data.files ?? [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
