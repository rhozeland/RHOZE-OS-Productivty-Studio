/**
 * Smartboard storage path builders.
 *
 * The `smartboard-files` bucket relies on RLS policies that authorize reads/writes
 * by inspecting `split_part(name, '/', 1)` — i.e. the FIRST segment of the object
 * key MUST be the smartboard id. Putting `user_id` first (or any other segment)
 * silently breaks uploads with a "row violates row-level security policy" error.
 *
 * Always build paths through these helpers — never hand-roll the string.
 */

import { safeFileExt } from "@/lib/file-ext";

export const SMARTBOARD_BUCKET = "smartboard-files";

type FileLike = { name?: string; type?: string };

interface BuildOpts {
  /** Optional sub-namespace, e.g. "bg" for backgrounds, "item" for board items. */
  kind?: string;
  /** Optional explicit extension override (without the dot). */
  ext?: string;
  /** Optional extra random suffix length (default 6). */
  randomLength?: number;
}

function rand(len: number): string {
  return Math.random().toString(36).slice(2, 2 + Math.max(1, len));
}

/**
 * Build a storage object key for the smartboard-files bucket.
 *
 * Layout: `<boardId>/<userId>/[<kind>-]<timestamp>-<rand>.<ext>`
 *
 * - `boardId` MUST be first for RLS authorization.
 * - `userId` second so we can attribute / clean up per-user uploads.
 * - Timestamp + random suffix avoids collisions on rapid uploads.
 */
export function buildSmartboardFilePath(
  boardId: string,
  userId: string,
  file: FileLike,
  opts: BuildOpts = {}
): string {
  if (!boardId) throw new Error("buildSmartboardFilePath: boardId is required");
  if (!userId) throw new Error("buildSmartboardFilePath: userId is required");

  const ext = (opts.ext || safeFileExt(file)).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const kindPrefix = opts.kind ? `${opts.kind}-` : "";
  const filename = `${kindPrefix}${Date.now()}-${rand(opts.randomLength ?? 6)}.${ext}`;
  return `${boardId}/${userId}/${filename}`;
}

/**
 * Returns true if a smartboard storage key has the expected `<boardId>/<userId>/...` layout.
 * Useful for defensive checks in tests or migrations.
 */
export function isValidSmartboardPath(path: string, boardId: string): boolean {
  if (!path || !boardId) return false;
  const first = path.split("/")[0];
  return first === boardId;
}
