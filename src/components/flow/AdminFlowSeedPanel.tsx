/**
 * AdminFlowSeedPanel
 * ─────────────────────────────────────────────────────────────────────────
 * Tiny popover surfaced ONLY for admins inside the Flow Mode header. Lets
 * an admin re-run the `seed-flow-items` edge function with a dry-run preview
 * (count + list of titles that would be inserted) before committing.
 *
 * Also exposes a "Verify attribution" action: pulls every seeded post from
 * `flow_items` and cross-checks each uploader's `user_id` against the
 * guest-safe `profiles_public` view, returning a quick report of missing
 * profiles or incomplete attribution (no display_name / avatar_url).
 *
 * The seed function dedupes seed entries against existing `flow_items.title`,
 * so pressing "Run seed" twice is safe — the second pass inserts 0 rows.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  LinkIcon,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

type FailedItem = {
  title: string;
  category: string;
  file_url_probe?: { ok: boolean; status?: number; error?: string; fallback?: string };
  link_url_probe?: { ok: boolean; status?: number; error?: string; fallback?: string };
};

type SeedPreviewItem = {
  title: string;
  category: string;
  content_type: string;
  usedFallback?: boolean;
  action?: "insert" | "update";
};

type SeedPreview = {
  total: number;
  alreadyPresent: number;
  willInsert: number;
  willUpdate?: number;
  fallbackCount?: number;
  items: SeedPreviewItem[];
  failedItems?: FailedItem[];
};

type AttributionIssue = {
  title: string;
  user_id: string;
  reason: "missing_profile" | "missing_display_name" | "missing_avatar";
};

type AttributionReport = {
  checked: number;
  ok: number;
  issues: AttributionIssue[];
};

const callSeed = async (
  dryRun: boolean,
): Promise<
  SeedPreview & {
    inserted?: number;
    updated?: number;
    fallbackCount?: number;
    failedItems?: FailedItem[];
  }
> => {
  const { data, error } = await supabase.functions.invoke("seed-flow-items", {
    body: { dryRun },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as SeedPreview & {
    inserted?: number;
    updated?: number;
    fallbackCount?: number;
    failedItems?: FailedItem[];
  };
};

/**
 * Pulls the dry-run seed list (canonical seed titles), then queries
 * `flow_items` for those titles and cross-checks each uploader's profile.
 *
 * Uses `profiles_public` (guest-safe view) so the report reflects exactly
 * what a guest would see on a Flow card.
 */
const verifySeededAttribution = async (): Promise<AttributionReport> => {
  // 1. Get the canonical seed list (dry-run returns titles + already-present
  //    count; we want ALL seeded titles regardless of whether they were just
  //    inserted, so we re-derive the full set from total - willInsert + items).
  const { data: seedData, error: seedErr } = await supabase.functions.invoke(
    "seed-flow-items",
    { body: { dryRun: true } },
  );
  if (seedErr) throw new Error(seedErr.message);
  if ((seedData as { error?: string })?.error) {
    throw new Error((seedData as { error: string }).error);
  }

  // The dry-run only returns net-new items. To validate ALL seeded posts
  // we instead pull every row whose title matches any seed title — easiest
  // path is to query `flow_items` for the union of preview + already-present,
  // but the function doesn't expose existing titles. Workaround: re-query
  // flow_items by joining on the preview titles + filter on creator_name set
  // we know is seeded. Simpler: filter by the curated `creator_name` markers.
  const SEED_CREATOR_NAMES = [
    "Studio Demo", "FieldKit", "Press Room", "Hue Lab", "Codex",
    "Loft Sessions", "Surface Co.", "Margins", "Ink House", "Cover Lab",
    "Daily Draw", "Frame School",
  ];

  const { data: items, error: itemsErr } = await supabase
    .from("flow_items")
    .select("title, user_id")
    .in("creator_name", SEED_CREATOR_NAMES);
  if (itemsErr) throw new Error(itemsErr.message);

  const rows = items ?? [];
  if (rows.length === 0) {
    return { checked: 0, ok: 0, issues: [] };
  }

  // 2. Fetch profiles_public for the unique uploader ids.
  const uploaderIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profiles, error: profErr } = await supabase
    .from("profiles_public")
    .select("user_id, display_name, avatar_url")
    .in("user_id", uploaderIds);
  if (profErr) throw new Error(profErr.message);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p] as const),
  );

  // 3. Build issue list.
  const issues: AttributionIssue[] = [];
  for (const row of rows) {
    const p = profileMap.get(row.user_id);
    if (!p) {
      issues.push({ title: row.title, user_id: row.user_id, reason: "missing_profile" });
      continue;
    }
    if (!p.display_name || p.display_name.trim() === "") {
      issues.push({ title: row.title, user_id: row.user_id, reason: "missing_display_name" });
      continue;
    }
    if (!p.avatar_url) {
      issues.push({ title: row.title, user_id: row.user_id, reason: "missing_avatar" });
    }
  }

  return {
    checked: rows.length,
    ok: rows.length - issues.length,
    issues,
  };
};

const AdminFlowSeedPanel = () => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SeedPreview | null>(null);
  const [report, setReport] = useState<AttributionReport | null>(null);
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: () => callSeed(true),
    onSuccess: (data) => setPreview(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const runMutation = useMutation({
    mutationFn: () => callSeed(false),
    onSuccess: (data) => {
      const inserted = data.inserted ?? 0;
      const updated = data.updated ?? 0;
      const parts: string[] = [];
      if (inserted > 0) parts.push(`${inserted} new`);
      if (updated > 0) parts.push(`${updated} updated`);
      const msg =
        parts.length > 0
          ? `Seed complete — ${parts.join(", ")}.`
          : "Nothing to do — seed is already in sync.";
      toast.success(msg);
      // Surface fallback info as a separate warning toast so it's not buried.
      if (data.fallbackCount && data.fallbackCount > 0) {
        const titles = (data.failedItems ?? [])
          .slice(0, 3)
          .map((f) => f.title)
          .join(", ");
        const more =
          (data.failedItems?.length ?? 0) > 3
            ? ` +${(data.failedItems?.length ?? 0) - 3} more`
            : "";
        toast.warning(
          `${data.fallbackCount} item${data.fallbackCount === 1 ? "" : "s"} used fallback URLs: ${titles}${more}`,
        );
      }
      setPreview(null);
      setReport(null);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["flow-items"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: verifySeededAttribution,
    onSuccess: (data) => {
      setReport(data);
      if (data.checked === 0) {
        toast.info("No seeded posts found yet. Run the seed first.");
      } else if (data.issues.length === 0) {
        toast.success(`All ${data.checked} seeded posts have valid attribution.`);
      } else {
        toast.warning(
          `${data.issues.length} of ${data.checked} seeded posts have attribution issues.`,
        );
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Auto-load preview the first time the popover opens.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !preview && !previewMutation.isPending) {
      previewMutation.mutate();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-card/60 backdrop-blur-sm hover:bg-card/80 h-9 w-9"
          aria-label="Admin: seed Flow posts"
          title="Admin: seed Flow posts"
          data-testid="flow-admin-seed-trigger"
        >
          <Database className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 p-0"
        data-testid="flow-admin-seed-panel"
      >
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Seed Flow posts</h3>
              <p className="text-[11px] text-muted-foreground">
                Admin-only · idempotent (updates by title)
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Admin
            </Badge>
          </div>
        </div>

        <div className="px-4 pb-3 space-y-2">
          {previewMutation.isPending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading seed preview…
            </div>
          ) : preview ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Total" value={preview.total} />
                <Stat
                  label="Update"
                  value={preview.willUpdate ?? preview.alreadyPresent}
                  muted={(preview.willUpdate ?? preview.alreadyPresent) === 0}
                />
                <Stat
                  label="New"
                  value={preview.willInsert}
                  emphasis={preview.willInsert > 0}
                />
              </div>

              {preview.fallbackCount && preview.fallbackCount > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                  <p className="text-[11px] text-foreground leading-snug">
                    <span className="font-semibold">{preview.fallbackCount}</span>{" "}
                    item{preview.fallbackCount === 1 ? "" : "s"} will use fallback
                    media URLs (originals unreachable).
                  </p>
                </div>
              ) : null}

              {preview.items.length > 0 ? (
                <div className="rounded-md border border-border/60 bg-muted/30">
                  <ScrollArea className="h-32">
                    <ul className="divide-y divide-border/50">
                      {preview.items.map((it) => (
                        <li
                          key={it.title}
                          className="flex items-center justify-between gap-2 px-3 py-1.5"
                        >
                          <span className="truncate text-xs flex items-center gap-1.5">
                            {it.usedFallback ? (
                              <LinkIcon
                                className="h-3 w-3 text-destructive shrink-0"
                                aria-label="Will use fallback URL"
                              />
                            ) : null}
                            {it.title}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {it.action === "update" ? (
                              <Badge
                                variant="outline"
                                className="text-[9px] uppercase tracking-wide px-1 py-0 h-4 border-muted-foreground/40 text-muted-foreground"
                              >
                                update
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[9px] uppercase tracking-wide px-1 py-0 h-4 border-primary/40 text-primary"
                              >
                                new
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              {it.category}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  All seed items are already in the feed.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              Open to load preview.
            </p>
          )}
        </div>

        {/* Attribution validation report */}
        {report && (
          <div className="px-4 pb-3 space-y-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Attribution report
              </h4>
              <span className="text-[10px] text-muted-foreground">
                {report.ok}/{report.checked} OK
              </span>
            </div>

            {report.checked === 0 ? (
              <p className="text-xs text-muted-foreground py-1">
                No seeded posts in the feed yet.
              </p>
            ) : report.issues.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-foreground py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                All seeded uploaders resolve in <code className="text-[10px]">profiles_public</code>.
              </div>
            ) : (
              <div className="rounded-md border border-destructive/40 bg-destructive/5">
                <ScrollArea className="h-32">
                  <ul className="divide-y divide-border/50">
                    {report.issues.map((issue, i) => (
                      <li
                        key={`${issue.user_id}-${i}`}
                        className="flex items-start justify-between gap-2 px-3 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">
                            {issue.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">
                            {issue.user_id.slice(0, 8)}…
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase tracking-wide shrink-0 border-destructive/50 text-destructive"
                        >
                          {issue.reason.replace("missing_", "no ")}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending || runMutation.isPending}
            data-testid="flow-admin-verify-attribution"
            title="Cross-check uploader attribution against profiles_public"
          >
            {verifyMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : report && report.issues.length > 0 ? (
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-destructive" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            )}
            Verify
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending || runMutation.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={
              !preview ||
              (preview.willInsert === 0 && (preview.willUpdate ?? 0) === 0) ||
              runMutation.isPending ||
              previewMutation.isPending
            }
            data-testid="flow-admin-seed-run"
          >
            {runMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : null}
            {preview && preview.willInsert === 0 && (preview.willUpdate ?? 0) > 0
              ? `Sync (${preview.willUpdate})`
              : `Run seed${
                  preview && preview.willInsert > 0 ? ` (${preview.willInsert})` : ""
                }`}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const Stat = ({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: number;
  muted?: boolean;
  emphasis?: boolean;
}) => (
  <div
    className={
      "rounded-md border border-border/60 px-2 py-1.5 " +
      (emphasis ? "bg-primary/10 border-primary/40" : "bg-card/60")
    }
  >
    <div
      className={
        "text-base font-semibold " +
        (muted ? "text-muted-foreground" : emphasis ? "text-primary" : "text-foreground")
      }
    >
      {value}
    </div>
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
  </div>
);

export default AdminFlowSeedPanel;
