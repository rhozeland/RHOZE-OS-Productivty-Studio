// Fetch Open Graph / Twitter / HTML metadata for a URL.
// Used by the Flow share preview to display rich link cards.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
  });

// Extract content from <meta> tags by name/property
function extractMeta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    // property="og:title" content="..."  OR  name="twitter:title" content="..."
    const re = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`,
      "i",
    );
    const m = html.match(re);
    if (m && m[1]) return decode(m[1].trim());
    // content first, then property/name
    const re2 = new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${key}["']`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2 && m2[1]) return decode(m2[1].trim());
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1].trim()) : null;
}

function extractFavicon(html: string, baseUrl: URL): string | null {
  const re = /<link[^>]+rel\s*=\s*["'](?:shortcut )?icon["'][^>]*?href\s*=\s*["']([^"']+)["']/i;
  const m = html.match(re);
  if (m && m[1]) {
    try { return new URL(m[1], baseUrl).toString(); } catch { return null; }
  }
  return `${baseUrl.origin}/favicon.ico`;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, " ");
}

function absoluteUrl(maybe: string | null, base: URL): string | null {
  if (!maybe) return null;
  try { return new URL(maybe, base).toString(); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let url: string | null = null;
    if (req.method === "GET") {
      url = new URL(req.url).searchParams.get("url");
    } else {
      const body = await req.json().catch(() => ({}));
      url = body?.url ?? null;
    }

    if (!url || typeof url !== "string") {
      return json({ error: "Missing url" }, 400);
    }

    // Validate
    let target: URL;
    try { target = new URL(url); } catch {
      return json({ error: "Invalid url" }, 400);
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return json({ error: "Only http/https URLs supported" }, 400);
    }

    // 8s fetch timeout
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(target.toString(), {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RhozelandBot/1.0; +https://rhozeland.app)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      clearTimeout(t);
      const msg = (err as Error)?.name === "AbortError" ? "Request timed out" : "Failed to reach URL";
      return json({ error: msg }, 504);
    }
    clearTimeout(t);

    if (!res.ok) {
      return json({ error: `Upstream responded ${res.status}` }, 502);
    }

    const ctype = res.headers.get("content-type") || "";
    const finalUrl = new URL(res.url || target.toString());

    // Image short-circuit
    if (ctype.startsWith("image/")) {
      return json({
        url: finalUrl.toString(),
        title: finalUrl.pathname.split("/").pop() || finalUrl.hostname,
        description: null,
        image: finalUrl.toString(),
        siteName: finalUrl.hostname,
        favicon: `${finalUrl.origin}/favicon.ico`,
        type: "image",
      });
    }

    if (!ctype.includes("html") && !ctype.includes("xml")) {
      return json({
        url: finalUrl.toString(),
        title: finalUrl.hostname + finalUrl.pathname,
        description: null,
        image: null,
        siteName: finalUrl.hostname,
        favicon: `${finalUrl.origin}/favicon.ico`,
        type: ctype || "unknown",
      });
    }

    // Read up to ~512KB of HTML — meta is in <head>
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const MAX = 512 * 1024;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.byteLength;
          if (total >= MAX) { try { await reader.cancel(); } catch {} break; }
        }
      }
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);

    const title =
      extractMeta(html, ["og:title", "twitter:title"]) ||
      extractTitle(html) ||
      finalUrl.hostname;

    const description =
      extractMeta(html, ["og:description", "twitter:description", "description"]);

    const rawImage = extractMeta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
    const image = absoluteUrl(rawImage, finalUrl);

    const siteName = extractMeta(html, ["og:site_name", "application-name"]) || finalUrl.hostname;
    const favicon = extractFavicon(html, finalUrl);

    return json({
      url: finalUrl.toString(),
      title,
      description,
      image,
      siteName,
      favicon,
      type: "website",
    });
  } catch (err) {
    return json({ error: (err as Error)?.message || "Unknown error" }, 500);
  }
});
