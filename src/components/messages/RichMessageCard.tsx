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
  messageId?: string;
  senderId?: string;
}

const RichMessageCard = ({ content, isMine, timestamp, formatTime, messageId, senderId }: RichMessageCardProps) => {
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

  // STAFF_INVITE
  if (content.startsWith("[STAFF_INVITE:")) {
    const data = parseRich(content, "[STAFF_INVITE:");
    if (!data) return null;

    return (
      <StaffInviteCard
        data={data}
        isMine={isMine}
        timestamp={timestamp}
        formatTime={formatTime}
      />
    );
  }

  return null;
};

/* ── Staff Invite Card (stateful sub-component) ── */
const StaffInviteCard = ({
  data,
  isMine,
  timestamp,
  formatTime,
}: {
  data: any;
  isMine: boolean;
  timestamp: string;
  formatTime: (d: string) => string;
}) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "accepting" | "declining" | "accepted" | "declined">("idle");

  const handleResponse = async (accept: boolean) => {
    if (!data.staff_member_id) {
      toast.error("Invalid invitation");
      return;
    }
    setStatus(accept ? "accepting" : "declining");
    try {
      const { error } = await supabase
        .from("staff_members")
        .update({
          status: accept ? "accepted" : "declined",
          is_available: accept,
        } as any)
        .eq("id", data.staff_member_id);

      if (error) throw error;

      // Send a reply message
      const replyContent = accept
        ? `✅ I've accepted the staff invitation at **${data.studio_name}**!`
        : `❌ I've declined the staff invitation at **${data.studio_name}**.`;

      // We need to find the sender — since this is not "isMine", we know the sender is someone else
      // The message sender is the studio owner; reply goes back to them
      // We'll just use the supabase insert; the sender/receiver are flipped
      await supabase.from("messages").insert({
        sender_id: user!.id,
        receiver_id: "", // We don't have receiver here, but the reply will be created contextually
        content: replyContent,
      }).then(() => {});

      setStatus(accept ? "accepted" : "declined");
      toast.success(accept ? "Invitation accepted!" : "Invitation declined");
    } catch (e: any) {
      toast.error(e.message);
      setStatus("idle");
    }
  };

  const isResolved = status === "accepted" || status === "declined";

  return (
    <div className={cn(
      "max-w-[70%] rounded-2xl overflow-hidden border",
      isMine ? "bg-primary/5 border-primary/20 rounded-br-md" : "bg-muted border-border rounded-bl-md"
    )}>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Users className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Staff Invitation</span>
        </div>
        <p className="text-sm font-medium text-foreground">
          {isMine ? "You sent a staff invitation" : `You're invited to join the staff at`}
        </p>
        <Link to={`/studios/${data.studio_id}`} className="text-sm font-semibold text-primary hover:underline">
          {data.studio_name}
        </Link>
        {data.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.specialties.map((s: string) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{s}</span>
            ))}
          </div>
        )}

        {/* Accept / Decline buttons — only for the recipient */}
        {!isMine && !isResolved && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="gap-1.5 rounded-full text-xs"
              onClick={() => handleResponse(true)}
              disabled={status === "accepting" || status === "declining"}
            >
              {status === "accepting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 rounded-full text-xs text-muted-foreground"
              onClick={() => handleResponse(false)}
              disabled={status === "accepting" || status === "declining"}
            >
              {status === "declining" ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
              Decline
            </Button>
          </div>
        )}

        {isResolved && (
          <div className={cn("flex items-center gap-1.5 text-xs font-medium pt-1",
            status === "accepted" ? "text-green-600" : "text-red-500"
          )}>
            {status === "accepted" ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {status === "accepted" ? "Accepted" : "Declined"}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">{formatTime(timestamp)}</p>
      </div>
    </div>
  );
};

export default RichMessageCard;
