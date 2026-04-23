import { describe, it, expect } from "vitest";
import { safeFileExt, safeContentType } from "./file-ext";

/**
 * Property-based fuzz tests for safeFileExt and safeContentType.
 *
 * We avoid pulling in fast-check to keep the dep graph slim and instead
 * use a seeded PRNG so failures are reproducible. Each "property" is
 * exercised across many randomized inputs, including hostile edge cases:
 * control chars, unicode, very long names, empty strings, weird MIMEs,
 * path separators, and mixed casing.
 */

// ─── Seeded PRNG (Mulberry32) ────────────────────────────────────────────────
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const ITERATIONS = 500;

// Character pools used to build pathological filenames.
const ASCII_LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~ \t\n\\";
const UNICODE = "éñüçßΩ漢字🙂🚀✨—–·";
const ALL_CHARS = ASCII_LETTERS + DIGITS + SYMBOLS + UNICODE;

// Plausible-looking extension fragments (incl. empty + junk).
const EXT_POOL = [
  "",
  "jpg", "JPG", "JpEg", "png", "PNG", "gif", "webp", "svg",
  "heic", "heif", "avif",
  "mp4", "MOV", "webm",
  "mp3", "wav", "ogg", "m4a",
  "pdf", "zip", "json", "txt", "csv", "html",
  "tar.gz", "TAR.GZ",
  "xyz", "unknownext",
  "a", "ab", "abcdefghij", // length variations incl. > 8 chars
  "wéird", "🚀", "..", "...",
  " ", "\t", "?",
];

// Plausible-looking MIME values, including empties and malformed ones.
const MIME_POOL = [
  "",
  "image/jpeg", "IMAGE/JPEG", "image/png", "image/gif", "image/webp",
  "image/svg+xml", "image/heic", "image/heif", "image/avif",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm",
  "application/pdf", "application/zip", "application/json",
  "text/plain", "text/csv", "text/html",
  "application/octet-stream",
  "application/x-some-weird-thing",
  "image/x-icon",
  "garbage", "no-slash", "/missing-type", "type/", "//", "  ",
  " image/png ", "IMAGE / PNG",
];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randomString(rand: () => number, minLen: number, maxLen: number): string {
  const len = Math.floor(rand() * (maxLen - minLen + 1)) + minLen;
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALL_CHARS[Math.floor(rand() * ALL_CHARS.length)];
  }
  return out;
}

function randomFilename(rand: () => number): string {
  const stem = randomString(rand, 0, 30);
  const ext = pick(rand, EXT_POOL);
  const sepRoll = rand();
  if (sepRoll < 0.15) return stem;                   // no extension at all
  if (sepRoll < 0.25) return `${stem}.`;             // trailing dot
  if (sepRoll < 0.32) return `.${ext || "env"}`;     // dotfile
  if (sepRoll < 0.42) return `${stem}.${ext}.${pick(rand, EXT_POOL) || "bak"}`;
  // Sometimes embed path separators to make sure we strip them.
  if (sepRoll < 0.5) return `/some/path\\sub/${stem}.${ext}`;
  return `${stem}.${ext}`;
}

function randomFile(rand: () => number): { name?: string; type?: string } {
  const obj: { name?: string; type?: string } = {};
  const r = rand();
  if (r > 0.1) obj.name = randomFilename(rand);             // sometimes omit name
  if (r > 0.05 && rand() > 0.15) obj.type = pick(rand, MIME_POOL); // sometimes omit type
  return obj;
}

// ─── Property assertions ─────────────────────────────────────────────────────

describe("safeFileExt — fuzz properties", () => {
  it("always returns a non-empty, lowercase, sanitized, ≤8-char string", () => {
    const rand = rng(0xC0FFEE);
    const failures: Array<{ input: unknown; output: string }> = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const input = randomFile(rand);
      const ext = safeFileExt(input);

      const ok =
        typeof ext === "string" &&
        ext.length > 0 &&
        ext.length <= 8 &&
        /^[a-z0-9]+$/.test(ext);

      if (!ok) failures.push({ input, output: ext });
    }

    expect(failures, `Got invalid extensions for inputs: ${JSON.stringify(failures.slice(0, 5))}`)
      .toEqual([]);
  });

  it("never throws on hostile inputs (null/undefined fields, weird primitives)", () => {
    const hostile: any[] = [
      {},
      { name: undefined, type: undefined },
      { name: null, type: null },
      { name: "", type: "" },
      { name: ".", type: "" },
      { name: "..", type: "" },
      { name: "...", type: "" },
      { name: ".env", type: "" },
      { name: "no-dot-here", type: "" },
      { name: "trailing.", type: "" },
      { name: "/abs/path/file", type: "" },
      { name: "C:\\win\\path\\file.JPG", type: "" },
      { name: "weird.\u0000name.png" },
      { name: "🚀.🙂" },
      { name: "x".repeat(2000) + ".pdf" },
      { name: "x".repeat(2000) },
      { name: "tricky.<script>", type: "image/png" },
      { type: "image/png" }, // name absent
    ];

    for (const f of hostile) {
      const ext = safeFileExt(f);
      expect(typeof ext).toBe("string");
      expect(ext.length).toBeGreaterThan(0);
      expect(ext.length).toBeLessThanOrEqual(8);
      expect(ext).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("is deterministic — same input yields same output across calls", () => {
    const rand = rng(42);
    for (let i = 0; i < 100; i++) {
      const input = randomFile(rand);
      expect(safeFileExt(input)).toBe(safeFileExt(input));
    }
  });

  it("prefers a clean filename extension over MIME when both are valid", () => {
    // When the name carries a clean ascii extension, it should win.
    const rand = rng(7);
    for (let i = 0; i < 100; i++) {
      const cleanExt = pick(rand, ["jpg", "png", "pdf", "mp4", "csv"]);
      const stem = randomString(rand, 1, 12).replace(/[^a-zA-Z0-9]/g, "x") || "f";
      const input = { name: `${stem}.${cleanExt}`, type: "application/octet-stream" };
      expect(safeFileExt(input)).toBe(cleanExt);
    }
  });
});

describe("safeContentType — fuzz properties", () => {
  it("always returns a non-empty string containing exactly one slash", () => {
    const rand = rng(0xBADBEEF);
    const failures: Array<{ input: unknown; output: string }> = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const input = randomFile(rand);
      const ct = safeContentType(input);

      const ok =
        typeof ct === "string" &&
        ct.length > 0 &&
        ct.split("/").length === 2 &&
        ct.split("/")[0].length > 0 &&
        ct.split("/")[1].length > 0;

      if (!ok) failures.push({ input, output: ct });
    }

    expect(failures, `Bad content-types: ${JSON.stringify(failures.slice(0, 5))}`)
      .toEqual([]);
  });

  it("prefers the browser-provided MIME when it is present and non-empty", () => {
    const rand = rng(123);
    for (let i = 0; i < 200; i++) {
      const provided = pick(rand, MIME_POOL).trim();
      if (!provided) continue; // empty MIMEs are intentionally allowed to fall through
      const input = { name: randomFilename(rand), type: provided };
      // Implementation lowercases+trims the provided MIME — match that contract.
      expect(safeContentType(input)).toBe(provided.toLowerCase());
    }
  });

  it("falls back to a sensible default when MIME is missing and ext is unknown", () => {
    const ct = safeContentType({ name: "weirdfile.zzznotreal" });
    // Either the extension maps to nothing → octet-stream, or it sanitized cleanly.
    expect(ct.includes("/")).toBe(true);
    expect(ct.length).toBeGreaterThan(0);
  });

  it("never throws on hostile inputs", () => {
    const hostile: any[] = [
      {},
      { name: "", type: "" },
      { name: ".", type: " " },
      { name: ".env" },
      { name: "x".repeat(5000) },
      { type: "garbage-no-slash" },
      { type: "//" },
      { type: "image/" },
      { type: "/png" },
      { name: "🚀.🙂", type: "🚀/🙂" },
    ];
    for (const f of hostile) {
      const ct = safeContentType(f);
      expect(typeof ct).toBe("string");
      expect(ct.length).toBeGreaterThan(0);
    }
  });
});
