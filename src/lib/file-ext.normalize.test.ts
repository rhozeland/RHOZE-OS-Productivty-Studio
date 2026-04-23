import { describe, it, expect } from "vitest";
import { safeContentType, normalizeMime } from "./file-ext";

/**
 * Targeted tests for `safeContentType` MIME normalization.
 *
 * The browser is not the only source of `file.type` — values may also come
 * from drag-and-drop payloads, clipboard items, server-issued copies, or
 * forms where users pasted a header verbatim. Real-world examples include:
 *   - `"image/png"`              ← copy-pasted with quotes
 *   - `text/html; charset=utf-8` ← full HTTP header
 *   - `  image/jpeg  `           ← stray whitespace
 *   - `image / png`              ← whitespace around the slash
 *   - `IMAGE/PNG`                ← uppercase
 */

describe("normalizeMime", () => {
  it("returns empty string for falsy / blank input", () => {
    expect(normalizeMime(undefined)).toBe("");
    expect(normalizeMime(null)).toBe("");
    expect(normalizeMime("")).toBe("");
    expect(normalizeMime("   ")).toBe("");
    expect(normalizeMime("\t\n")).toBe("");
  });

  it("lowercases and trims simple MIME values", () => {
    expect(normalizeMime("IMAGE/PNG")).toBe("image/png");
    expect(normalizeMime("  image/jpeg  ")).toBe("image/jpeg");
    expect(normalizeMime("Image/Jpeg")).toBe("image/jpeg");
  });

  it("strips wrapping double or single quotes", () => {
    expect(normalizeMime('"image/png"')).toBe("image/png");
    expect(normalizeMime("'image/png'")).toBe("image/png");
    expect(normalizeMime('  "image/jpeg"  ')).toBe("image/jpeg");
  });

  it("drops charset parameters after a semicolon", () => {
    expect(normalizeMime("text/html; charset=utf-8")).toBe("text/html");
    expect(normalizeMime("text/html;charset=UTF-8")).toBe("text/html");
    expect(normalizeMime("application/json ; charset=utf-8")).toBe("application/json");
  });

  it("drops boundary and other parameters", () => {
    expect(
      normalizeMime("multipart/form-data; boundary=----WebKitFormBoundary123"),
    ).toBe("multipart/form-data");
    expect(normalizeMime("audio/ogg; codecs=opus")).toBe("audio/ogg");
  });

  it("collapses whitespace around the slash", () => {
    expect(normalizeMime("image / png")).toBe("image/png");
    expect(normalizeMime("image  /  jpeg")).toBe("image/jpeg");
    expect(normalizeMime(" image\t/\tpng ")).toBe("image/png");
  });

  it("rejects malformed values with no slash", () => {
    expect(normalizeMime("garbage")).toBe("");
    expect(normalizeMime("no-slash-here")).toBe("");
  });

  it("rejects malformed values with empty type or subtype", () => {
    expect(normalizeMime("/png")).toBe("");
    expect(normalizeMime("image/")).toBe("");
    expect(normalizeMime("//")).toBe("");
    expect(normalizeMime("/")).toBe("");
  });

  it("rejects values with extra slashes", () => {
    expect(normalizeMime("image/png/extra")).toBe("");
  });

  it("preserves the `+suffix` portion of structured-syntax MIMEs", () => {
    expect(normalizeMime("image/svg+xml")).toBe("image/svg+xml");
    expect(normalizeMime("application/ld+json; charset=utf-8")).toBe(
      "application/ld+json",
    );
  });

  it("is idempotent — normalizing twice yields the same value", () => {
    const cases = [
      '"text/html; charset=utf-8"',
      "  IMAGE / PNG  ",
      "audio/ogg; codecs=opus",
      "application/json",
    ];
    for (const c of cases) {
      const once = normalizeMime(c);
      expect(normalizeMime(once)).toBe(once);
    }
  });
});

describe("safeContentType — normalization integration", () => {
  it("uses normalized MIME when browser sends quoted value", () => {
    expect(safeContentType({ name: "x.png", type: '"image/png"' })).toBe(
      "image/png",
    );
  });

  it("uses normalized MIME when browser sends a charset parameter", () => {
    expect(
      safeContentType({ name: "page.html", type: "text/html; charset=utf-8" }),
    ).toBe("text/html");
  });

  it("falls back to extension when MIME normalizes to empty (malformed)", () => {
    // Malformed `type/` should be discarded; ext "jpg" → image/jpeg.
    expect(safeContentType({ name: "photo.jpg", type: "garbage" })).toBe(
      "image/jpeg",
    );
    expect(safeContentType({ name: "photo.jpg", type: "//" })).toBe(
      "image/jpeg",
    );
    expect(safeContentType({ name: "photo.jpg", type: "/png" })).toBe(
      "image/jpeg",
    );
  });

  it("falls back to octet-stream when both MIME and ext are unrecoverable", () => {
    expect(safeContentType({ name: "", type: "no-slash" })).toBe(
      "application/octet-stream",
    );
  });

  it("normalizes whitespace-only-around-slash MIMEs", () => {
    expect(safeContentType({ name: "x", type: "image / jpeg" })).toBe(
      "image/jpeg",
    );
  });

  it("preserves +xml / +json structured-syntax suffixes", () => {
    expect(safeContentType({ name: "logo.svg", type: "image/svg+xml" })).toBe(
      "image/svg+xml",
    );
  });
});
