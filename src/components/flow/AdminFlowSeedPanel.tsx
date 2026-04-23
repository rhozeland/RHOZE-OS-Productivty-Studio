/**
 * AdminFlowSeedPanel
 * ─────────────────────────────────────────────────────────────────────────
 * Tiny popover surfaced ONLY for admins inside the Flow Mode header. Lets
 * an admin re-run the `seed-flow-items` edge function with a dry-run preview
 * (count + list of titles that would be inserted) before committing.
 *
 * The function dedupes seed entries against existing `flow_items.title`, so
 * pressing "Run seed" twice is safe — the second pass inserts 0 rows.
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
import { Database, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type SeedPreview = {
  total: number;
  alreadyPresent: number;
  willInsert: number;
  items: { title: string; category: string; content_type: string }[];
};

const callSeed = async (dryRun: boolean): Promise<SeedPreview & { inserted?: number }> => {
  const { data, error } = await supabase.functions.invoke("seed-flow-items", {
    body: { dryRun },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as SeedPreview & { inserted?: number };
};

const AdminFlowSeedPanel = () => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SeedPreview | null>(null);
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: () => callSeed(true),
    onSuccess: (data) => setPreview(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const runMutation = useMutation({
    mutationFn: () => callSeed(false),
    onSuccess: (data) => {
      toast.success(
        data.inserted && data.inserted > 0
          ? `Seeded ${data.inserted} new Flow post${data.inserted === 1 ? "" : "s"}`
          : "Nothing to seed — all items already present.",
      );
      setPreview(null);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["flow-items"] });
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
                Admin-only · dedupes by title
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
                <Stat label="Existing" value={preview.alreadyPresent} muted />
                <Stat
                  label="New"
                  value={preview.willInsert}
                  emphasis={preview.willInsert > 0}
                />
              </div>

              {preview.items.length > 0 ? (
                <div className="rounded-md border border-border/60 bg-muted/30">
                  <ScrollArea className="h-40">
                    <ul className="divide-y divide-border/50">
                      {preview.items.map((it) => (
                        <li
                          key={it.title}
                          className="flex items-center justify-between gap-2 px-3 py-1.5"
                        >
                          <span className="truncate text-xs">{it.title}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">
                            {it.category}
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

        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2">
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
              preview.willInsert === 0 ||
              runMutation.isPending ||
              previewMutation.isPending
            }
            data-testid="flow-admin-seed-run"
          >
            {runMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : null}
            Run seed
            {preview && preview.willInsert > 0 ? ` (${preview.willInsert})` : ""}
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
