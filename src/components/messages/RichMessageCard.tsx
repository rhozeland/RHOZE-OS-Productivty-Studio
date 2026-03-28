import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid,
  User,
  ShoppingBag,
  FileText,
  Image as ImageIcon,
  Music,
  Film,
  Download,
  ExternalLink,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Parse helpers
export const isRichMessage = (content: string) =>
  content.startsWith("[FILE:") ||
  content.startsWith("[SMARTBOARD:") ||
  content.startsWith("[PROFILE:") ||
  content.startsWith("[LISTING:") ||
  content.startsWith("[LINK:") ||
  content.startsWith("[STAFF_INVITE:");

const parseRich = (content: string, prefix: string) => {
  try {
    const json = content.slice(prefix.length, -1);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const getFileIcon = (type: string) => {
  if (type?.startsWith("image/")) return ImageIcon;
  if (type?.startsWith("audio/")) return Music;
  if (type?.startsWith("video/")) return Film;
  return FileText;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface RichMessageCardProps {
  content: string;
  isMine: boolean;
  timestamp: string;
  formatTime: (d: string) => string;
}

const RichMessageCard = ({ content, isMine, timestamp, formatTime }: RichMessageCardProps) => {
  // FILE
  if (content.startsWith("[FILE:")) {
    const data = parseRich(content, "[FILE:");
    if (!data) return null;
    const FileIcon = getFileIcon(data.type);
    const isImage = data.type?.startsWith("image/");

    return (
      <div className={cn(
        "max-w-[70%] rounded-2xl overflow-hidden border",
        isMine ? "bg-primary/5 border-primary/20 rounded-br-md" : "bg-muted border-border rounded-bl-md"
      )}>
        {isImage && (
          <a href={data.url} target="_blank" rel="noopener noreferrer">
            <img src={data.url} alt={data.name} className="w-full max-h-64 object-cover" />
          </a>
        )}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground truncate">{data.name}</p>
            {data.size && <p className="text-[10px] text-muted-foreground">{formatSize(data.size)}</p>}
          </div>
          <a href={data.url} download={data.name} target="_blank" rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 shrink-0">
            <Download className="h-4 w-4" />
          </a>
        </div>
        <p className={cn("px-3 pb-2 text-[10px]", isMine ? "text-muted-foreground" : "text-muted-foreground")}>
          {formatTime(timestamp)}
        </p>
      </div>
    );
  }

  // SMARTBOARD
  if (content.startsWith("[SMARTBOARD:")) {
    const data = parseRich(content, "[SMARTBOARD:");
    if (!data) return null;

    return (
      <Link to={`/smartboards/${data.id}`} className="block">
        <div className={cn(
          "max-w-[70%] rounded-2xl overflow-hidden border hover:shadow-md transition-shadow",
          isMine ? "bg-primary/5 border-primary/20 rounded-br-md" : "bg-muted border-border rounded-bl-md"
        )}>
          <div className="h-16 w-full" style={{ background: data.color || "hsl(var(--muted))" }} />
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <LayoutGrid className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Smartboard</span>
            </div>
            <p className="text-sm font-medium text-foreground">{data.title}</p>
            {data.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{data.description}</p>}
            <p className={cn("mt-1.5 text-[10px] text-muted-foreground")}>{formatTime(timestamp)}</p>
          </div>
        </div>
      </Link>
    );
  }

  // PROFILE
  if (content.startsWith("[PROFILE:")) {
    const data = parseRich(content, "[PROFILE:");
    if (!data) return null;

    return (
      <Link to={`/profiles/${data.user_id}`} className="block">
        <div className={cn(
          "max-w-[70%] rounded-2xl overflow-hidden border hover:shadow-md transition-shadow",
          isMine ? "bg-primary/5 border-primary/20 rounded-br-md" : "bg-muted border-border rounded-bl-md"
        )}>
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {data.avatar ? (
                <img src={data.avatar} alt="" className="h-full w-full object-cover rounded-full" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <User className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Creator</span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">{data.name || "Creator"}</p>
              {data.headline && <p className="text-xs text-muted-foreground truncate">{data.headline}</p>}
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
          </div>
          <p className={cn("px-3 pb-2 text-[10px] text-muted-foreground")}>{formatTime(timestamp)}</p>
        </div>
      </Link>
    );
  }

  // LISTING
  if (content.startsWith("[LISTING:")) {
    const data = parseRich(content, "[LISTING:");
    if (!data) return null;

    return (
      <Link to={`/creators/${data.id}`} className="block">
        <div className={cn(
          "max-w-[70%] rounded-2xl overflow-hidden border hover:shadow-md transition-shadow",
          isMine ? "bg-primary/5 border-primary/20 rounded-br-md" : "bg-muted border-border rounded-bl-md"
        )}>
          <div className="px-3 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShoppingBag className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Listing</span>
            </div>
            <p className="text-sm font-medium text-foreground">{data.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.category} · {data.type?.replace("_", " ")}
              {data.price ? ` · ${data.price} credits` : ""}
            </p>
            <p className={cn("mt-1.5 text-[10px] text-muted-foreground")}>{formatTime(timestamp)}</p>
          </div>
        </div>
      </Link>
    );
  }

  // LINK
  if (content.startsWith("[LINK:")) {
    const data = parseRich(content, "[LINK:");
    if (!data) return null;

    const isGDrive = data.url?.includes("drive.google.com") || data.url?.includes("docs.google.com");
    const isDropbox = data.url?.includes("dropbox.com");

    return (
      <a href={data.url} target="_blank" rel="noopener noreferrer" className="block">
        <div className={cn(
          "max-w-[70%] rounded-2xl overflow-hidden border hover:shadow-md transition-shadow",
          isMine ? "bg-primary/5 border-primary/20 rounded-br-md" : "bg-muted border-border rounded-bl-md"
        )}>
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ExternalLink className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                  {isGDrive ? "Google Drive" : isDropbox ? "Dropbox" : "Link"}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">{data.title || data.url}</p>
              <p className="text-[10px] text-muted-foreground truncate">{data.url}</p>
            </div>
          </div>
          <p className={cn("px-3 pb-2 text-[10px] text-muted-foreground")}>{formatTime(timestamp)}</p>
        </div>
      </a>
    );
  }

  return null;
};

export default RichMessageCard;
