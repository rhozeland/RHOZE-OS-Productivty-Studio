import { describe, it, expect, vi, beforeEach } from "vitest";
import { runUploadWithRollback } from "./upload-orchestrator";

/**
 * Tests for the upload-with-rollback orchestrator.
 *
 * The orchestrator powers BackgroundCustomizer's "validate → upload → rollback"
 * flow. These tests pin the rollback contract for ALL four reachable paths:
 *
 *   1. Validation REJECTS the file
 *      → pending meta surfaced, uploadOk=false, imageUrl untouched, no upload call.
 *   2. Validation ACCEPTS but upload returns { error }
 *      → pending meta cleared, imageUrl restored, file input reset, error toasted.
 *   3. Validation ACCEPTS but upload throws
 *      → same rollback path as case 2; thrown message surfaces in the toast.
 *   4. Validation ACCEPTS and upload succeeds
 *      → pending meta retained, uploadOk=true, imageUrl set to new URL.
 */

type Setters = ReturnType<typeof makeSetters>;

function makeSetters() {
  return {
    setPendingFile: vi.fn(),
    setPendingPath: vi.fn(),
    setUploadOk: vi.fn(),
    setImageUrl: vi.fn(),
    resetFileInput: vi.fn(),
    notifyError: vi.fn(),
  };
}

function makeFile(name = "photo.jpg", type = "image/jpeg", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

interface RunOpts {
  file?: File;
  previousImageUrl?: string;
  validateResult?: { ok: boolean; reason?: string };
  uploadImpl?: (path: string, file: File) => Promise<{ url: string; error?: string | null }>;
  setters?: Setters;
}

async function run(opts: RunOpts = {}) {
  const setters = opts.setters ?? makeSetters();
  const file = opts.file ?? makeFile();
  const previousImageUrl = opts.previousImageUrl ?? "https://cdn.example.com/old.jpg";
  const validate = vi.fn().mockReturnValue(opts.validateResult ?? { ok: true });
  const buildPath = vi.fn().mockReturnValue("boards/abc/bg-123.jpg");
  const upload = vi.fn(
    opts.uploadImpl ??
      (async () => ({ url: "https://cdn.example.com/new.jpg", error: null })),
  );

  const result = await runUploadWithRollback<File>({
    file,
    previousImageUrl,
    buildPath,
    validate,
    upload,
    ...setters,
  });

  return { result, setters, validate, buildPath, upload };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── 1. Validation rejection ─────────────────────────────────────────────────
describe("runUploadWithRollback — validation rejects the file", () => {
  it("returns ok:false with the validation reason and never invokes upload", async () => {
    const { result, upload, setters } = await run({
      validateResult: { ok: false, reason: "Extension .exe is not allowed" },
    });

    expect(result).toEqual({
      ok: false,
      stage: "validation",
      reason: "Extension .exe is not allowed",
    });
    expect(upload).not.toHaveBeenCalled();
    expect(setters.notifyError).toHaveBeenCalledWith("Extension .exe is not allowed");
  });

  it("surfaces the pending meta so the user can see what was rejected", async () => {
    const file = makeFile("trojan.exe", "image/png");
    const { setters } = await run({
      file,
      validateResult: { ok: false, reason: "nope" },
    });

    expect(setters.setPendingFile).toHaveBeenCalledWith(file);
    expect(setters.setPendingPath).toHaveBeenCalledWith("boards/abc/bg-123.jpg");
    expect(setters.setUploadOk).toHaveBeenCalledWith(false);
  });

  it("does NOT touch imageUrl or reset the file input on validation failure", async () => {
    const { setters } = await run({
      validateResult: { ok: false, reason: "nope" },
      previousImageUrl: "https://cdn.example.com/old.jpg",
    });

    expect(setters.setImageUrl).not.toHaveBeenCalled();
    expect(setters.resetFileInput).not.toHaveBeenCalled();
  });

  it("uses a generic fallback reason when validate omits one", async () => {
    const { result, setters } = await run({
      validateResult: { ok: false }, // no reason provided
    });

    expect(result.ok).toBe(false);
    expect(setters.notifyError).toHaveBeenCalledWith("This file isn't allowed");
  });
});

// ─── 2. Upload returns { error } ─────────────────────────────────────────────
describe("runUploadWithRollback — upload returns an error string", () => {
  it("rolls back the pending meta, restores previous URL, and resets the input", async () => {
    const previousImageUrl = "https://cdn.example.com/old.jpg";
    const { result, setters } = await run({
      previousImageUrl,
      uploadImpl: async () => ({ url: "", error: "storage quota exceeded" }),
    });

    expect(result).toEqual({
      ok: false,
      stage: "upload",
      reason: "storage quota exceeded",
    });

    // Rollback assertions
    expect(setters.setPendingFile).toHaveBeenLastCalledWith(null);
    expect(setters.setPendingPath).toHaveBeenLastCalledWith("");
    expect(setters.setUploadOk).toHaveBeenLastCalledWith(null);
    expect(setters.setImageUrl).toHaveBeenCalledWith(previousImageUrl);
    expect(setters.resetFileInput).toHaveBeenCalledTimes(1);
    expect(setters.notifyError).toHaveBeenCalledWith("storage quota exceeded");
  });

  it("restores even when the previous URL was empty (no prior image)", async () => {
    const { setters } = await run({
      previousImageUrl: "",
      uploadImpl: async () => ({ url: "", error: "boom" }),
    });
    expect(setters.setImageUrl).toHaveBeenLastCalledWith("");
  });
});

// ─── 3. Upload throws ────────────────────────────────────────────────────────
describe("runUploadWithRollback — upload throws", () => {
  it("rolls back identically to the { error } path and surfaces err.message", async () => {
    const previousImageUrl = "https://cdn.example.com/old.jpg";
    const { result, setters } = await run({
      previousImageUrl,
      uploadImpl: async () => {
        throw new Error("network unreachable");
      },
    });

    expect(result).toEqual({
      ok: false,
      stage: "upload",
      reason: "network unreachable",
    });
    expect(setters.setPendingFile).toHaveBeenLastCalledWith(null);
    expect(setters.setPendingPath).toHaveBeenLastCalledWith("");
    expect(setters.setUploadOk).toHaveBeenLastCalledWith(null);
    expect(setters.setImageUrl).toHaveBeenLastCalledWith(previousImageUrl);
    expect(setters.resetFileInput).toHaveBeenCalledTimes(1);
    expect(setters.notifyError).toHaveBeenCalledWith("network unreachable");
  });

  it("falls back to a friendly default when the thrown error has no message", async () => {
    const { result, setters } = await run({
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      uploadImpl: async () => {
        throw {}; // weird non-Error throw
      },
    });

    expect(result.ok).toBe(false);
    expect(setters.notifyError).toHaveBeenCalledWith(
      "Upload failed — previous background restored",
    );
  });
});

// ─── 4. Happy path ───────────────────────────────────────────────────────────
describe("runUploadWithRollback — successful upload", () => {
  it("retains pending meta, marks uploadOk=true, and sets the new image URL", async () => {
    const { result, setters } = await run({
      uploadImpl: async () => ({ url: "https://cdn.example.com/fresh.jpg", error: null }),
    });

    expect(result).toEqual({ ok: true, url: "https://cdn.example.com/fresh.jpg" });

    // Pending meta is set ONCE (initial surfacing) and never cleared.
    expect(setters.setPendingFile).toHaveBeenCalledTimes(1);
    expect(setters.setPendingFile).not.toHaveBeenCalledWith(null);
    expect(setters.setPendingPath).toHaveBeenCalledTimes(1);
    expect(setters.setPendingPath).not.toHaveBeenCalledWith("");

    // uploadOk transitions only to `true` (no rollback to null).
    expect(setters.setUploadOk).toHaveBeenCalledWith(true);
    expect(setters.setUploadOk).not.toHaveBeenCalledWith(null);
    expect(setters.setUploadOk).not.toHaveBeenCalledWith(false);

    // The fresh URL replaces the previous one; no rollback or input reset.
    expect(setters.setImageUrl).toHaveBeenCalledWith("https://cdn.example.com/fresh.jpg");
    expect(setters.resetFileInput).not.toHaveBeenCalled();
    expect(setters.notifyError).not.toHaveBeenCalled();
  });

  it("calls validate, buildPath, and upload exactly once each in order", async () => {
    const { validate, buildPath, upload } = await run();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(buildPath).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith("boards/abc/bg-123.jpg", expect.any(File));
  });
});

// ─── Cross-path invariants ───────────────────────────────────────────────────
describe("runUploadWithRollback — cross-path invariants", () => {
  it("never sets imageUrl to the new URL on any failure path", async () => {
    const failurePaths: RunOpts[] = [
      { validateResult: { ok: false, reason: "x" } },
      { uploadImpl: async () => ({ url: "https://nope/whatever.jpg", error: "boom" }) },
      {
        uploadImpl: async () => {
          throw new Error("kaboom");
        },
      },
    ];

    for (const opts of failurePaths) {
      const setters = makeSetters();
      await run({ ...opts, setters, previousImageUrl: "https://prev/" });
      const setUrlCalls = setters.setImageUrl.mock.calls.map((c) => c[0]);
      expect(setUrlCalls).not.toContain("https://nope/whatever.jpg");
    }
  });

  it("always invokes notifyError on any failure path", async () => {
    const failurePaths: RunOpts[] = [
      { validateResult: { ok: false, reason: "x" } },
      { uploadImpl: async () => ({ url: "", error: "boom" }) },
      {
        uploadImpl: async () => {
          throw new Error("kaboom");
        },
      },
    ];

    for (const opts of failurePaths) {
      const setters = makeSetters();
      await run({ ...opts, setters });
      expect(setters.notifyError).toHaveBeenCalledTimes(1);
    }
  });
});
