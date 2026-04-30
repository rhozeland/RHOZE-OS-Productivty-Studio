/**
 * Content-hash utilities — Phase 2 of the infrastructure stack.
 *
 * Every "Work" registered on Rhozeland is fingerprinted with a SHA-256 hash
 * of its file bytes. This hash is what gets anchored on Solana via the
 * existing `anchor-contribution` edge function, giving creators a verifiable,
 * timestamped proof of authorship for any uploaded asset.
 */

/**
 * Compute the SHA-256 content hash of a File or Blob, returned as a
 * lowercase hex string. Uses Web Crypto's SubtleCrypto.digest for speed.
 */
export async function computeContentHash(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Infer a coarse "kind" bucket for a Work from its MIME type. */
export function inferWorkKind(
  mime: string | null | undefined,
): "audio" | "image" | "video" | "text" | "other" {
  if (!mime) return "other";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (
    mime.startsWith("text/") ||
    mime === "application/pdf" ||
    mime === "application/json"
  )
    return "text";
  return "other";
}

/** Pretty-format a byte size for UI display. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Truncate a long hex hash for compact display (e.g. `a1b2c3…f9e8d7`). */
export function shortHash(hash: string, head = 6, tail = 6): string {
  if (!hash) return "";
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
