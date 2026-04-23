/**
 * Pure orchestration helper for "validate → upload → rollback" flows.
 *
 * Extracted from BackgroundCustomizer so the rollback contract can be unit-
 * tested without rendering the component or touching Supabase. The component
 * supplies state setters + an upload function; this helper sequences them and
 * guarantees that on ANY failure path (validation rejection OR network error)
 * the pending meta is cleared and the previous URL is restored.
 *
 * Contract:
 *   - On validation failure: set pendingFile/pendingPath, mark uploadOk=false,
 *     toast the reason, leave imageUrl untouched, return { ok: false }.
 *   - On upload failure: clear pending state, restore previousImageUrl, reset
 *     the file input, toast the error, return { ok: false }.
 *   - On success: keep pending meta, set uploadOk=true, set new imageUrl,
 *     return { ok: true, url }.
 */

export interface UploadOrchestratorDeps<TFile extends { name?: string; type?: string; size?: number }> {
  file: TFile;
  previousImageUrl: string;
  buildPath: (file: TFile) => string;
  validate: (file: TFile) => { ok: boolean; reason?: string };
  upload: (path: string, file: TFile) => Promise<{ url: string; error?: string | null }>;
  setPendingFile: (file: TFile | null) => void;
  setPendingPath: (path: string) => void;
  setUploadOk: (ok: boolean | null) => void;
  setImageUrl: (url: string) => void;
  resetFileInput: () => void;
  notifyError: (msg: string) => void;
}

export type OrchestratorResult =
  | { ok: true; url: string }
  | { ok: false; stage: "validation" | "upload"; reason: string };

export async function runUploadWithRollback<
  TFile extends { name?: string; type?: string; size?: number },
>(deps: UploadOrchestratorDeps<TFile>): Promise<OrchestratorResult> {
  const {
    file,
    previousImageUrl,
    buildPath,
    validate,
    upload,
    setPendingFile,
    setPendingPath,
    setUploadOk,
    setImageUrl,
    resetFileInput,
    notifyError,
  } = deps;

  const verdict = validate(file);
  const path = buildPath(file);

  // Always surface the pending meta so the user can see what was attempted,
  // even when validation rejects it.
  setPendingFile(file);
  setPendingPath(path);

  if (!verdict.ok) {
    setUploadOk(false);
    const reason = verdict.reason || "This file isn't allowed";
    notifyError(reason);
    return { ok: false, stage: "validation", reason };
  }

  setUploadOk(true);

  try {
    const { url, error } = await upload(path, file);
    if (error) throw new Error(error);
    setImageUrl(url);
    return { ok: true, url };
  } catch (err: any) {
    // Roll back: drop pending preview + restore prior background + reset input.
    setPendingFile(null);
    setPendingPath("");
    setUploadOk(null);
    setImageUrl(previousImageUrl);
    resetFileInput();
    const reason = err?.message || "Upload failed — previous background restored";
    notifyError(reason);
    return { ok: false, stage: "upload", reason };
  }
}
