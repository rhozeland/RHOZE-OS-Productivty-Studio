/**
 * Safe file extension + content-type resolution for uploads.
 *
 * Handles edge cases:
 * - Files with no dot in the name (e.g. "IMG_0123")
 * - Names ending in a dot (e.g. "report.")
 * - Hidden/dotfiles (e.g. ".env" → no extension)
 * - Multi-dot names (e.g. "archive.tar.gz" → "gz")
 * - Weird casing or unsafe characters in the extension
 * - Browsers that omit `file.type`
 *
 * Always returns a non-empty, lowercase, filesystem-safe extension.
 */

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/json": "json",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/html": "html",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  weba: "audio/webm",
  m4a: "audio/mp4",
  pdf: "application/pdf",
  zip: "application/zip",
  json: "application/json",
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
};

/**
 * Extract the "raw" trailing extension from a filename.
 * Returns "" if no usable extension is present (no dot, dotfile, or trailing dot).
 */
function rawExtFromName(name: string | undefined | null): string {
  if (!name) return "";
  // Strip any path prefix just in case
  const base = name.replace(/^.*[\\/]/, "");
  const dot = base.lastIndexOf(".");
  // No dot, leading dot (dotfile), or trailing dot -> no extension
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1);
}

function sanitizeExt(ext: string): string {
  return ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
}

/**
 * Resolve a safe, non-empty extension for a File/Blob.
 * Order of preference: filename extension → MIME map → MIME subtype → "bin".
 */
export function safeFileExt(file: { name?: string; type?: string }): string {
  const fromName = sanitizeExt(rawExtFromName(file.name));
  if (fromName) return fromName;

  const mime = (file.type || "").toLowerCase().trim();
  if (mime && MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];

  // Fallback: derive from MIME subtype, e.g. "image/x-icon" -> "x-icon" -> "xicon"
  const sub = mime.split("/")[1];
  const fromMime = sanitizeExt(sub || "");
  if (fromMime) return fromMime;

  return "bin";
}

/**
 * Normalize a raw MIME string from the browser, an HTTP header, or a
 * copy-pasted value. Strips:
 *  - Surrounding whitespace
 *  - Wrapping quotes (e.g. `"image/png"` or `'image/png'`)
 *  - Parameters after `;` (e.g. `text/html; charset=utf-8` → `text/html`)
 *  - Internal whitespace around the `/` (e.g. `image / png` → `image/png`)
 *
 * Returns "" when the input is empty or cannot be reduced to a `type/subtype`
 * shape — callers should treat that as "no MIME provided".
 */
export function normalizeMime(raw: string | undefined | null): string {
  if (!raw) return "";
  let s = String(raw).trim();
  if (!s) return "";

  // Strip wrapping quotes (single or double), once.
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }

  // Drop parameters: "text/html; charset=utf-8" -> "text/html"
  const semi = s.indexOf(";");
  if (semi >= 0) s = s.slice(0, semi).trim();

  // Collapse whitespace around the slash and lowercase.
  s = s.replace(/\s*\/\s*/g, "/").toLowerCase();

  // Reject malformed values that lack a clean `type/subtype` shape.
  const parts = s.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "";

  // Strip any remaining internal whitespace inside type or subtype.
  return `${parts[0].replace(/\s+/g, "")}/${parts[1].replace(/\s+/g, "")}`;
}

/**
 * Resolve the best content-type for an upload.
 * Falls back to extension-based lookup if the browser didn't set `file.type`
 * or sent a malformed value.
 */
export function safeContentType(file: { name?: string; type?: string }): string {
  const mime = normalizeMime(file.type);
  if (mime) return mime;

  const ext = safeFileExt(file);
  return EXT_TO_MIME[ext] || "application/octet-stream";
}
