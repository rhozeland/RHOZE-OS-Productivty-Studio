import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface DrivePickedFile {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

interface Props {
  /** Render-prop or label fallback. Triggers the picker sheet. */
  children?: React.ReactNode;
  className?: string;
  title?: string;
  onPick: (file: DrivePickedFile) => void | Promise<void>;
}

/**
 * Reusable Google Drive file picker, powered by the `list-drive-files`
 * edge function (which proxies the connector gateway). On pick, returns
 * the file's webViewLink + metadata — caller decides where to store it.
 */
export const GoogleDriveAttachButton = ({
  children,
  className,
  title = "Attach from Google Drive",
  onPick,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("list-drive-files", { body: { q: debounced, pageSize: 30 } })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message ?? "Failed to load Drive");
          setFiles([]);
        } else if ((data as any)?.error) {
          setError((data as any).error);
          setFiles([]);
        } else {
          setFiles((data as any)?.files ?? []);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  const handlePick = async (f: DriveFile) => {
    setPicking(f.id);
    try {
      await onPick({
        id: f.id,
        name: f.name,
        url: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
        mimeType: f.mimeType ?? null,
        sizeBytes: f.size ? Number(f.size) : null,
      });
      toast.success("Attached from Drive", { description: f.name });
      setOpen(false);
    } catch (e: any) {
      toast.error("Could not attach", { description: e?.message ?? "Unknown error" });
    } finally {
      setPicking(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ?? (
          <button
            type="button"
            title={title}
            className={cn(
              "inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors",
              className,
            )}
          >
            <DriveGlyph className="h-3.5 w-3.5" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <DriveGlyph className="h-4 w-4" />
            Attach from Google Drive
          </SheetTitle>
        </SheetHeader>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your Drive…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="mt-3 flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
              <div className="mt-2 text-xs text-muted-foreground">
                Make sure Google Drive is connected in your workspace connectors.
              </div>
            </div>
          ) : files.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {debounced ? "No files match." : "No recent files."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.id} className="py-2">
                  <button
                    type="button"
                    onClick={() => handlePick(f)}
                    disabled={picking === f.id}
                    className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    {f.thumbnailLink ? (
                      <img
                        src={f.thumbnailLink}
                        alt=""
                        className="h-8 w-8 rounded object-cover bg-muted"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {prettyMime(f.mimeType)}
                        {f.size ? ` · ${formatBytes(Number(f.size))}` : ""}
                        {f.modifiedTime ? ` · ${timeAgo(f.modifiedTime)}` : ""}
                      </div>
                    </div>
                    {picking === f.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Read-only · we store the Drive link, not the file.</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/** Google Drive triangle glyph */
const DriveGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 87.3 78" className={className} aria-hidden>
    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
    <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335" />
    <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
    <path d="M59.8 52.5H27.5l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.6c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
    <path d="M73.4 26.5L60.75 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 27.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
  </svg>
);

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function prettyMime(mime: string): string {
  if (!mime) return "File";
  if (mime === "application/vnd.google-apps.document") return "Google Doc";
  if (mime === "application/vnd.google-apps.spreadsheet") return "Google Sheet";
  if (mime === "application/vnd.google-apps.presentation") return "Google Slides";
  if (mime === "application/vnd.google-apps.folder") return "Folder";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("image/")) return "Image";
  if (mime === "application/pdf") return "PDF";
  return mime.split("/").pop() ?? "File";
}

export default GoogleDriveAttachButton;
