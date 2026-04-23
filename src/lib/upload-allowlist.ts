/**
 * Client-side allowlist validation for uploads.
 *
 * Belt-and-suspenders with bucket policies: blocks files whose resolved
 * extension or content-type isn't in the caller-provided allowlists BEFORE
 * we hit storage. Both lists are optional — pass undefined to skip a check.
 *
 * Pair with `safeFileExt` / `safeContentType` so we validate the values we
 * will actually send to the bucket, not the (sometimes empty) browser values.
 */
import { safeFileExt, safeContentType } from "@/lib/file-ext";

export interface UploadAllowlist {
  /** Lowercase extensions WITHOUT the leading dot, e.g. ["jpg", "png"]. */
  exts?: string[];
  /** Lowercase MIME types, e.g. ["image/jpeg", "image/png"]. */
  mimes?: string[];
  /** Optional max size in bytes. */
  maxBytes?: number;
}

export interface UploadValidationResult {
  ok: boolean;
  /** Human-readable reason when `ok === false`. Safe to show in UI. */
  reason?: string;
  resolvedExt: string;
  resolvedMime: string;
  size: number;
}

/** Common image-only allowlist used by avatar / banner / background pickers. */
export const IMAGE_ALLOWLIST: UploadAllowlist = {
  exts: ["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif"],
  mimes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/heic",
    "image/heif",
  ],
};

/** Broader media allowlist for boards / messaging attachments. */
export const MEDIA_ALLOWLIST: UploadAllowlist = {
  exts: [
    ...(IMAGE_ALLOWLIST.exts || []),
    "mp4", "mov", "webm",
    "mp3", "wav", "ogg", "weba", "m4a",
    "pdf",
  ],
  mimes: [
    ...(IMAGE_ALLOWLIST.mimes || []),
    "video/mp4", "video/quicktime", "video/webm",
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4",
    "application/pdf",
  ],
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Validate a File against an allowlist. Returns the resolved values regardless
 * so callers can render them even when validation fails.
 */
export function validateUpload(
  file: { name?: string; type?: string; size?: number } | null | undefined,
  allow: UploadAllowlist | undefined,
): UploadValidationResult {
  const resolvedExt = file ? safeFileExt(file) : "";
  const resolvedMime = file ? safeContentType(file) : "";
  const size = file?.size ?? 0;

  if (!file) {
    return { ok: false, reason: "No file selected", resolvedExt, resolvedMime, size };
  }
  if (!allow) {
    return { ok: true, resolvedExt, resolvedMime, size };
  }

  const exts = allow.exts?.map((e) => e.toLowerCase().replace(/^\./, ""));
  const mimes = allow.mimes?.map((m) => m.toLowerCase());

  if (exts && exts.length > 0 && !exts.includes(resolvedExt)) {
    return {
      ok: false,
      reason: `Extension .${resolvedExt} is not allowed. Accepted: ${exts.map((e) => `.${e}`).join(", ")}`,
      resolvedExt,
      resolvedMime,
      size,
    };
  }
  if (mimes && mimes.length > 0 && !mimes.includes(resolvedMime)) {
    return {
      ok: false,
      reason: `Content-type ${resolvedMime} is not allowed. Accepted: ${mimes.join(", ")}`,
      resolvedExt,
      resolvedMime,
      size,
    };
  }
  if (allow.maxBytes && size > allow.maxBytes) {
    return {
      ok: false,
      reason: `File is ${fmtBytes(size)} — exceeds ${fmtBytes(allow.maxBytes)} limit`,
      resolvedExt,
      resolvedMime,
      size,
    };
  }

  return { ok: true, resolvedExt, resolvedMime, size };
}
