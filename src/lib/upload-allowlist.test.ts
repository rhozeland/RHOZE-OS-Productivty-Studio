import { describe, it, expect } from "vitest";
import {
  validateUpload,
  IMAGE_ALLOWLIST,
  MEDIA_ALLOWLIST,
} from "./upload-allowlist";

/**
 * Integration tests for `validateUpload` using REAL `File` objects (not mocks),
 * so we exercise the full pipeline: browser-provided `name` + `type` →
 * `safeFileExt` / `safeContentType` resolution → allowlist gating.
 *
 * These cases simulate what actually happens in the wild:
 * - iPhone HEIC uploads
 * - Camera files with no extension
 * - Pasted screenshots with no name
 * - Drag-and-dropped video / audio / pdf
 * - Hostile / disallowed types (exe, svg, csv)
 */

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  // Build a real File-like blob; size is honored via the underlying blob length.
  const padding = new Uint8Array(sizeBytes);
  return new File([padding], name, { type });
}

// ─── IMAGE_ALLOWLIST ─────────────────────────────────────────────────────────
describe("validateUpload — IMAGE_ALLOWLIST acceptance", () => {
  const cases: Array<[string, string]> = [
    ["photo.jpg", "image/jpeg"],
    ["photo.JPEG", "image/jpeg"],
    ["screenshot.png", "image/png"],
    ["sticker.gif", "image/gif"],
    ["modern.webp", "image/webp"],
    ["next-gen.avif", "image/avif"],
    ["iphone.heic", "image/heic"],
    ["iphone.HEIF", "image/heif"],
  ];

  it.each(cases)("accepts %s (%s)", (name, type) => {
    const result = validateUpload(makeFile(name, type), IMAGE_ALLOWLIST);
    expect(result.ok, result.reason).toBe(true);
    expect(result.resolvedMime).toBe(type.toLowerCase());
  });

  it("accepts a pasted screenshot blob with empty name (relies on MIME fallback)", () => {
    const result = validateUpload(makeFile("", "image/png"), IMAGE_ALLOWLIST);
    expect(result.ok, result.reason).toBe(true);
    expect(result.resolvedExt).toBe("png");
  });

  it("accepts a camera file with no extension by trusting MIME", () => {
    const result = validateUpload(makeFile("IMG_0123", "image/jpeg"), IMAGE_ALLOWLIST);
    expect(result.ok, result.reason).toBe(true);
    expect(result.resolvedExt).toBe("jpg");
  });
});

describe("validateUpload — IMAGE_ALLOWLIST rejection", () => {
  it("rejects video files", () => {
    const result = validateUpload(makeFile("clip.mp4", "video/mp4"), IMAGE_ALLOWLIST);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not allowed/i);
    expect(result.resolvedExt).toBe("mp4");
  });

  it("rejects PDFs", () => {
    const result = validateUpload(makeFile("doc.pdf", "application/pdf"), IMAGE_ALLOWLIST);
    expect(result.ok).toBe(false);
    expect(result.resolvedMime).toBe("application/pdf");
  });

  it("rejects SVG (deliberately excluded from the image allowlist)", () => {
    const result = validateUpload(makeFile("logo.svg", "image/svg+xml"), IMAGE_ALLOWLIST);
    expect(result.ok).toBe(false);
  });

  it("rejects executables disguised as images by extension", () => {
    // Resolved ext comes from the filename when present → "exe", which is blocked.
    const result = validateUpload(makeFile("trojan.exe", "image/png"), IMAGE_ALLOWLIST);
    expect(result.ok).toBe(false);
    expect(result.resolvedExt).toBe("exe");
  });

  it("rejects files exceeding maxBytes even if type is allowed", () => {
    const big = makeFile("huge.jpg", "image/jpeg", 5 * 1024 * 1024);
    const result = validateUpload(big, { ...IMAGE_ALLOWLIST, maxBytes: 1024 * 1024 });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeds/i);
  });

  it("rejects null / undefined files", () => {
    expect(validateUpload(null, IMAGE_ALLOWLIST).ok).toBe(false);
    expect(validateUpload(undefined, IMAGE_ALLOWLIST).ok).toBe(false);
  });
});

// ─── MEDIA_ALLOWLIST ─────────────────────────────────────────────────────────
describe("validateUpload — MEDIA_ALLOWLIST acceptance", () => {
  const cases: Array<[string, string]> = [
    // Inherits all image types
    ["photo.jpg", "image/jpeg"],
    ["sticker.gif", "image/gif"],
    ["iphone.heic", "image/heic"],
    // Video
    ["clip.mp4", "video/mp4"],
    ["recording.mov", "video/quicktime"],
    ["screen.webm", "video/webm"],
    // Audio
    ["song.mp3", "audio/mpeg"],
    ["voice.wav", "audio/wav"],
    ["podcast.ogg", "audio/ogg"],
    ["voice.m4a", "audio/mp4"],
    // Documents
    ["contract.pdf", "application/pdf"],
  ];

  it.each(cases)("accepts %s (%s)", (name, type) => {
    const result = validateUpload(makeFile(name, type), MEDIA_ALLOWLIST);
    expect(result.ok, result.reason).toBe(true);
  });

  it("accepts an audio blob from MediaRecorder (audio/webm → weba)", () => {
    // MediaRecorder commonly produces audio/webm with no filename.
    const result = validateUpload(makeFile("", "audio/webm"), MEDIA_ALLOWLIST);
    expect(result.ok, result.reason).toBe(true);
    expect(result.resolvedExt).toBe("weba");
  });

  it("accepts a .mov from QuickTime even when browser omits the type", () => {
    // Some browsers send empty `type` for .mov; safeContentType infers it from ext.
    const result = validateUpload(makeFile("clip.mov", ""), MEDIA_ALLOWLIST);
    expect(result.ok, result.reason).toBe(true);
    expect(result.resolvedExt).toBe("mov");
    expect(result.resolvedMime).toBe("video/quicktime");
  });
});

describe("validateUpload — MEDIA_ALLOWLIST rejection", () => {
  it("rejects ZIP archives", () => {
    const result = validateUpload(makeFile("bundle.zip", "application/zip"), MEDIA_ALLOWLIST);
    expect(result.ok).toBe(false);
  });

  it("rejects CSV / spreadsheet files", () => {
    const result = validateUpload(makeFile("data.csv", "text/csv"), MEDIA_ALLOWLIST);
    expect(result.ok).toBe(false);
    expect(result.resolvedExt).toBe("csv");
  });

  it("rejects plain text files", () => {
    const result = validateUpload(makeFile("notes.txt", "text/plain"), MEDIA_ALLOWLIST);
    expect(result.ok).toBe(false);
  });

  it("rejects HTML uploads", () => {
    const result = validateUpload(makeFile("page.html", "text/html"), MEDIA_ALLOWLIST);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown binary blobs (no name, no type)", () => {
    const result = validateUpload(makeFile("", ""), MEDIA_ALLOWLIST);
    expect(result.ok).toBe(false);
    // Falls back to "bin" / "application/octet-stream" — neither is allowlisted.
    expect(result.resolvedExt).toBe("bin");
    expect(result.resolvedMime).toBe("application/octet-stream");
  });
});

// ─── Resolution alignment ────────────────────────────────────────────────────
describe("validateUpload — resolved values always populated", () => {
  it("returns resolvedExt and resolvedMime even when validation fails", () => {
    const result = validateUpload(makeFile("data.csv", "text/csv"), IMAGE_ALLOWLIST);
    expect(result.ok).toBe(false);
    expect(result.resolvedExt).toBe("csv");
    expect(result.resolvedMime).toBe("text/csv");
    expect(result.size).toBeGreaterThan(0);
  });

  it("passes when no allowlist is provided (undefined skips the check)", () => {
    const result = validateUpload(makeFile("anything.xyz", "application/x-foo"), undefined);
    expect(result.ok).toBe(true);
  });
});
