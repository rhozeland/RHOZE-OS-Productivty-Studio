/**
 * Pinterest-style masonry of project deliverables (images, files, links). Used
 * by the Board tab and the Overview preview (limit=6). Categories filter
 * client-side: All / Images / References / Files / Links.
 *
 * Data source: project_deliverables with a file_url. Cards show the file or a
 * filename chip, with hover label.
 */
import { useMemo, useState } from "react";
import { Image as ImageIcon, FileText, Link as LinkIcon, FolderOpen, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Deliverable {
  id: string;
  title: string;
  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  content_hash?: string | null;
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
  /** When true and there is no content, render nothing (public surfaces). */
  hideWhenEmpty?: boolean;
  /** Large dashed empty-state variant (editor Board tab). */
  emptyStateVariant?: "default" | "large";
}

type Cat = "all" | "images" | "references" | "files" | "links";

const kindOf = (d: Deliverable): Cat => {
  const mime = (d.mime_type ?? "").toLowerCase();
  const url = (d.file_url ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "images";
  if (mime === "text/uri-list" || (url.startsWith("http") && !mime)) return "links";
  if (mime || url) return "files";
  return "references";
};

const linkCover = (d: Deliverable): string | null => {
  const h = d.content_hash ?? "";
  if (h.startsWith("og:")) return h.slice(3);
  return null;
};

const domainOf = (url?: string | null) => {
  try { return new URL(url!).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// Deterministic pastel gradient from a string seed
const gradientFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 60) % 360;
  return `linear-gradient(135deg, hsl(${a} 70% 65%), hsl(${b} 70% 55%))`;
};

const filterChips: { id: Cat; label: string }[] = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "references", label: "Moodboard" },
  { id: "files", label: "Files" },
  { id: "links", label: "Links" },
];

const BoardMasonry = ({ deliverables, limit, showFilters, onSeeMore, canManage, onAdd, hideWhenEmpty, emptyStateVariant = "default" }: Props) => {
  const [cat, setCat] = useState<Cat>("all");
  const all = (deliverables ?? []).filter((d) => d.file_url || d.title);
  const filtered = useMemo(() => {
    const base = cat === "all" ? all : all.filter((d) => kindOf(d) === cat);
    return limit ? base.slice(0, limit) : base;
  }, [all, cat, limit]);

  if (!all.length && hideWhenEmpty) return null;

  if (!all.length) {
    if (emptyStateVariant === "large") {
      return (
        <button
          type="button"
          onClick={onAdd}
          disabled={!canManage}
          className="w-full rounded-3xl border-2 border-dashed border-border bg-card/20 px-6 py-20 text-center hover:border-primary/40 hover:bg-card/40 transition-colors group"
        >
          <div className="mx-auto h-14 w-14 rounded-full border-2 border-dashed border-border grid place-items-center mb-4 group-hover:border-primary/50 transition-colors">
            <FolderOpen className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-base font-medium">Add your first asset</p>
          <p className="text-sm text-muted-foreground mt-1">Images, links, references, files — anything that shapes the work.</p>
        </button>
      );
    }
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
          const cover = kind === "links" ? linkCover(d) : null;
          const domain = kind === "links" ? domainOf(d.file_url) : "";
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
              ) : kind === "links" ? (
                cover ? (
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={cover}
                      alt={d.title}
                      className="w-full h-full object-cover block"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-white">
                        <LinkIcon className="h-3 w-3" />
                        <span className="truncate">{domain}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="relative aspect-[4/3] grid place-items-center p-4 text-white"
                    style={{ backgroundImage: gradientFor(d.file_url || d.title) }}
                  >
                    <LinkIcon className="h-8 w-8 opacity-90" />
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/40 to-transparent">
                      <div className="text-[10px] font-medium truncate">{domain || d.title}</div>
                    </div>
                  </div>
                )
              ) : (
                <div className="aspect-[4/3] grid place-items-center bg-gradient-to-br from-muted to-card p-4">
                  <FileText className="h-8 w-8 text-muted-foreground/60" />
                </div>
              )}
              {d.anchored_at && (
                <div className="p-2 bg-card">
                  <Badge variant="outline" className="text-[9px]">
                    Verified IP
                  </Badge>
                </div>
              )}

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
