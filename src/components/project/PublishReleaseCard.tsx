/**
 * PublishReleaseCard — owner-only toggle that flips a project's `is_public`
 * flag on, generates a public slug (handled by DB trigger), and surfaces the
 * shareable `/release/:slug` link.
 *
 * Part of v11 Tier 3 "build in public" surface. Only renders for project
 * owners. Sensitive fields (budget, files) stay private even when public — the
 * release page only exposes title / vision / scope / milestone list / cheers.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe2, Link as LinkIcon, Copy, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { pumpFunCreateUrl } from "@/lib/pump-fun";

interface Props {
  projectId: string;
  isPublic: boolean;
  publicSlug: string | null;
  cheerCount: number;
  tokenizeReady: boolean;
  /** Optional — used to pre-fill pump.fun's coin-create form. */
  title?: string;
  description?: string | null;
}

const PublishReleaseCard = ({
  projectId,
  isPublic,
  publicSlug,
  cheerCount,
  tokenizeReady,
  title,
  description,
}: Props) => {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("projects")
        .update({ is_public: next })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: (_, next) => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success(next ? "Release is live" : "Release is private");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update visibility"),
  });

  const shareUrl = publicSlug
    ? `${window.location.origin}/release/${publicSlug}`
    : "";

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
            <Globe2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Build in public
              {isPublic && <Badge variant="outline" className="text-[10px]">Live</Badge>}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
              Share a public roadmap so fans can follow the release and cheer
              you on. Budget, files, and DMs stay private.
            </p>
          </div>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(v) => toggle.mutate(v)}
          disabled={toggle.isPending}
        />
      </div>

      {isPublic && publicSlug && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono truncate">
            <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{shareUrl}</span>
          </div>
          <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}

      {isPublic && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60">
          <span>{cheerCount} cheer{cheerCount === 1 ? "" : "s"}</span>
          {tokenizeReady ? (
            <a
              href={pumpFunCreateUrl({ name: title, description })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            >
              <Sparkles className="h-3 w-3" />
              Tokenize this release →
            </a>
          ) : (
            <span className="italic">A&R may flag this release for tokenization</span>
          )}
        </div>
      )}
    </div>
  );
};

export default PublishReleaseCard;
