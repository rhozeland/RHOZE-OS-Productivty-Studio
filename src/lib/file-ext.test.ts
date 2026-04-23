import { describe, it, expect } from "vitest";
import { safeFileExt, safeContentType } from "@/lib/file-ext";

/**
 * These tests pin down the resolution rules so future refactors of
 * file-ext.ts can't silently regress upload behavior. Edge cases here
 * mirror real bugs we saw in the wild (iOS HEIC, dotless camera names,
 * pasted blobs with empty `type`, dotfiles, multi-dot archives).
 */

describe("safeFileExt", () => {
  describe("dotless filenames", () => {
    it("falls back to MIME map when name has no dot", () => {
      expect(safeFileExt({ name: "IMG_0123", type: "image/jpeg" })).toBe("jpg");
      expect(safeFileExt({ name: "screenshot", type: "image/png" })).toBe("png");
      expect(safeFileExt({ name: "clip", type: "video/mp4" })).toBe("mp4");
    });

    it("falls back to MIME subtype when name has no dot and MIME is unknown", () => {
      // image/x-icon isn't in the map → derives from subtype, sanitized
      expect(safeFileExt({ name: "favicon", type: "image/x-icon" })).toBe("xicon");
    });

    it("returns 'bin' when name has no dot and type is missing", () => {
      expect(safeFileExt({ name: "mystery" })).toBe("bin");
      expect(safeFileExt({ name: "mystery", type: "" })).toBe("bin");
    });
  });

  describe("trailing dots and dotfiles", () => {
    it("ignores trailing dot and uses MIME fallback", () => {
      expect(safeFileExt({ name: "report.", type: "application/pdf" })).toBe("pdf");
    });

    it("treats leading-dot names as having no extension", () => {
      // ".env" → dotfile, no ext from name; falls through to MIME / bin
      expect(safeFileExt({ name: ".env" })).toBe("bin");
      expect(safeFileExt({ name: ".gitignore", type: "text/plain" })).toBe("txt");
    });

    it("returns 'bin' for empty name and empty type", () => {
      expect(safeFileExt({ name: "", type: "" })).toBe("bin");
      expect(safeFileExt({})).toBe("bin");
    });
  });

  describe("missing file.type", () => {
    it("uses the filename extension when MIME is missing", () => {
      expect(safeFileExt({ name: "photo.JPG" })).toBe("jpg");
      expect(safeFileExt({ name: "song.mp3" })).toBe("mp3");
      expect(safeFileExt({ name: "doc.PDF", type: "" })).toBe("pdf");
    });

    it("uses last extension for multi-dot names", () => {
      expect(safeFileExt({ name: "archive.tar.gz" })).toBe("gz");
      expect(safeFileExt({ name: "my.backup.zip", type: "" })).toBe("zip");
    });
  });

  describe("sanitization", () => {
    it("lowercases and strips non-alphanumeric characters", () => {
      expect(safeFileExt({ name: "weird.JPG!" })).toBe("jpg");
      expect(safeFileExt({ name: "x.j-p_g" })).toBe("jpg");
    });

    it("clips overly long extensions to 8 chars", () => {
      const ext = safeFileExt({ name: "thing.superlongextension" });
      expect(ext.length).toBeLessThanOrEqual(8);
    });
  });
});

describe("safeContentType", () => {
  describe("missing file.type", () => {
    it("derives content-type from filename extension", () => {
      expect(safeContentType({ name: "photo.png" })).toBe("image/png");
      expect(safeContentType({ name: "song.mp3", type: "" })).toBe("audio/mpeg");
      expect(safeContentType({ name: "doc.pdf" })).toBe("application/pdf");
    });

    it("returns octet-stream for unknown ext + missing type", () => {
      expect(safeContentType({ name: "thing.xyz" })).toBe("application/octet-stream");
      expect(safeContentType({ name: "mystery" })).toBe("application/octet-stream");
    });
  });

  describe("dotless filenames", () => {
    it("uses browser-provided MIME when present", () => {
      expect(safeContentType({ name: "IMG_0001", type: "image/heic" })).toBe("image/heic");
    });

    it("falls back via ext resolution when both look weak", () => {
      // No name ext, no MIME → safeFileExt returns 'bin' → no map entry → octet-stream
      expect(safeContentType({ name: "blob" })).toBe("application/octet-stream");
    });
  });

  describe("trailing dots and dotfiles", () => {
    it("uses browser MIME for trailing-dot names", () => {
      expect(safeContentType({ name: "report.", type: "application/pdf" })).toBe(
        "application/pdf",
      );
    });

    it("uses browser MIME for dotfiles", () => {
      expect(safeContentType({ name: ".env", type: "text/plain" })).toBe("text/plain");
    });
  });

  describe("preference order", () => {
    it("prefers browser-provided MIME over ext lookup", () => {
      // Even though name says .png, we trust what the browser told us.
      expect(safeContentType({ name: "photo.png", type: "image/webp" })).toBe("image/webp");
    });

    it("normalizes browser MIME to lowercase + trimmed", () => {
      expect(safeContentType({ name: "photo.png", type: "  IMAGE/PNG  " })).toBe("image/png");
    });
  });
});
