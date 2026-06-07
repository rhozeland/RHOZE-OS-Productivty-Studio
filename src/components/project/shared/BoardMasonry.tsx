/**
 * Pinterest-style masonry of project deliverables (images, files, links). Used
 * by the Board tab and the Overview preview (limit=6). Categories filter
 * client-side: All / Images / References / Files / Links.
 *
 * Data source: project_deliverables with a file_url. Cards show the file or a
 * filename chip, with hover label.
 */
import { useMemo, useState } from "react";
import { Image as ImageIcon, FileText, Link as LinkIcon, FolderOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Deliverable {
  id: string;
  title: string;
  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  created_at?: string | null;
  anchored_at?: string | null;
}

interface Props {
  deliverables: Deliverable[] | null | undefined;
  limit?: number;
  showFilters?: boolean;
  onSeeMore?: () => void;
  canManage?: boolean;
  onAdd?: () => void;
}

type Cat = "all" | "images" | "references" | "files" | "links";

const kindOf = (d: Deliverable): Cat => {
  const mime = (d.mime_type ?? "").toLowerCase();
  const url = (d.file_url ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "images";
  if (url.startsWith("http") && !mime) return "links";
  if (mime || url) return "files";
  return "references";
};

const filterChips: { id: Cat; label: string }[] = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "references", label: "References" },
  { id: "files", label: "Files" },
  { id: "links", label: "Links" },
];

const BoardMasonry = ({ deliverables, limit, showFilters, onSeeMore, canManage, onAdd }: Props) => {
  const [cat, setCat] = useState<Cat>("all");
  const all = (deliverables ?? []).filter((d) => d.file_url || d.title);
  const filtered = useMemo(() => {
    const base = cat === "all" ? all : all.filter((d) => kindOf(d) === cat);
    return limit ? base.slice(0, limit) : base;
  }, [all, cat, limit]);

  if (!all.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
        <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Board is empty.</p>
        {canManage && onAdd && (
          <Button size="sm" variant="outline" className="mt-3" onClick={onAdd}>
            Add asset
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={[
                "rounded-full border px-3 py-1 text-[11px] transition",
                cat === c.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {c.label}
            </button>
          ))}
          {canManage && onAdd && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={onAdd}>
              Add asset
            </Button>
          )}
        </div>
      )}

      {/* CSS columns masonry */}
      <div className="columns-2 md:columns-3 gap-3 [&>*]:mb-3">
        {filtered.map((d) => {
          const kind = kindOf(d);
          const isImage = kind === "images" && d.file_url;
          return (
            <a
              key={d.id}
              href={d.file_url ?? "#"}
              target={d.file_url ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group block break-inside-avoid rounded-xl overflow-hidden border border-border bg-card hover:border-primary/40 hover:shadow-lg transition"
            >
              {isImage ? (
                <img
                  src={d.file_url!}
                  alt={d.title}
                  className="w-full h-auto block"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-[4/3] grid place-items-center bg-gradient-to-br from-muted to-card p-4">
                  {kind === "links" ? (
                    <LinkIcon className="h-8 w-8 text-muted-foreground/60" />
                  ) : (
                    <FileText className="h-8 w-8 text-muted-foreground/60" />
                  )}
                </div>
              )}
              <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-card">
                <div className="flex items-center gap-1.5 text-[11px] font-medium line-clamp-1">
                  {d.title}
                  {d.file_url && <ExternalLink className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
                </div>
                {d.created_at && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                )}
                {d.anchored_at && (
                  <Badge variant="outline" className="text-[9px] mt-1">
                    Verified IP
                  </Badge>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {onSeeMore && all.length > (limit ?? 0) && (
        <div className="text-center">
          <button
            onClick={onSeeMore}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            See full board ({all.length}) →
          </button>
        </div>
      )}
    </div>
  );
};

export default BoardMasonry;
