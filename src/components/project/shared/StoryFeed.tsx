/**
 * Story tab — creative journal of artist updates.
 *
 * Note: dedicated `project_story_updates` table is on the roadmap (see
 * future migration). Until then, this surface renders existing
 * `project_goals.description` blurbs (those AI-drafted "Strategy / Target"
 * lines effectively read like a journal) and an inert "Add update"
 * affordance so the layout never feels broken.
 */
import { Button } from "@/components/ui/button";
import { Plus, Lock, FileText } from "lucide-react";
import { Link } from "react-router-dom";

interface StoryItem {
  id: string;
  title: string;
  description?: string | null;
  created_at?: string | null;
  is_public?: boolean;
}

interface Props {
  items: StoryItem[] | null | undefined;
  canManage?: boolean;
  /** When true (public release view), private updates are filtered out entirely. */
  publicOnly?: boolean;
  /** Compact preview for the Overview column (limit to 3, no add button). */
  preview?: boolean;
  onAdd?: () => void;
}

const StoryFeed = ({ items, canManage, publicOnly, preview, onAdd }: Props) => {
  const all = (items ?? []).filter((it) => (publicOnly ? it.is_public !== false : true));
  const list = preview ? all.slice(0, 3) : all;

  return (
    <div className="space-y-4">
      {canManage && !preview && (
        <Button onClick={onAdd} variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add update
        </Button>
      )}

      {!list.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No updates posted yet.</p>
          {canManage && !preview && (
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Share what you're working on so supporters stay close.
            </p>
          )}
        </div>
      ) : (
        <ol className="space-y-4">
          {list.map((it) => (
            <li
              key={it.id}
              className={[
                "rounded-2xl border bg-card p-5",
                preview ? "border-border" : "border-border md:p-6",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {it.created_at &&
                  new Date(it.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: preview ? undefined : "numeric",
                  })}
                {it.is_public === false && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px]">
                    <Lock className="h-2.5 w-2.5" /> Private
                  </span>
                )}
              </div>
              <h3 className={preview ? "text-sm font-semibold leading-snug" : "text-lg font-semibold leading-snug"}>
                {it.title}
              </h3>
              {it.description && (
                <p
                  className={[
                    "mt-1.5 text-muted-foreground whitespace-pre-wrap leading-relaxed",
                    preview ? "text-xs line-clamp-3" : "text-sm",
                  ].join(" ")}
                >
                  {it.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {preview && all.length > 3 && (
        <Link
          to="?tab=story"
          className="block text-center text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Read all updates ({all.length}) →
        </Link>
      )}
    </div>
  );
};

export default StoryFeed;
