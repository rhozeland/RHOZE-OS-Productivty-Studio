/**
 * InboxKanban — v9.4 lightweight project-management view for the inbox.
 *
 * Three lanes (New · In Progress · Closed) aggregate every thread the
 * user has across DMs, listing inquiries, and projects. Each card is
 * one "thread" tagged with its source type and (when relevant) the
 * linked listing/project so the inbox reads as a pipeline rather than
 * a flat chat list.
 *
 * Click behavior:
 *   • DM card        → /messages?to=<userId>          (parent opens chat)
 *   • Inquiry card   → /messages?tab=projects#inquiries-section
 *   • Project card   → /messages?tab=projects&p=<id>
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Inbox,
  Flame,
  CheckCircle2,
  MessageSquare,
  Store,
  FolderKanban,
  ArrowRight,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type LaneKey = "new" | "active" | "closed";

type ThreadCard = {
  id: string;
  lane: LaneKey;
  kind: "dm" | "inquiry" | "project";
  title: string;        // counterpart name OR project title
  subtitle?: string;    // listing title / preview / project status
  context?: string;     // e.g. linked listing label
  avatarUrl?: string | null;
  accentColor?: string | null;
  unread?: boolean;
  updatedAt: string;
  onOpen: () => void;
};

const LANES: { key: LaneKey; label: string; icon: typeof Inbox; tone: string }[] = [
  { key: "new",    label: "New",         icon: Inbox,        tone: "text-primary" },
  { key: "active", label: "In Progress", icon: Flame,        tone: "text-amber-600" },
  { key: "closed", label: "Closed",      icon: CheckCircle2, tone: "text-emerald-600" },
];

const KIND_META: Record<ThreadCard["kind"], { label: string; icon: typeof Inbox; color: string }> = {
  dm:      { label: "DM",       icon: MessageSquare, color: "bg-primary/10 text-primary" },
  inquiry: { label: "Inquiry",  icon: Store,         color: "bg-amber-500/15 text-amber-600" },
  project: { label: "Project",  icon: FolderKanban,  color: "bg-emerald-500/15 text-emerald-600" },
};

const colorFromName = (name: string | null | undefined) => {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 45%)`;
};

const initialOf = (n: string | null | undefined) =>
  (n || "?").trim().charAt(0).toUpperCase() || "?";

interface Props {
  userId: string;
  conversations?: Map<string, any>;
  partnerProfiles?: { user_id: string; display_name: string | null; avatar_url: string | null }[];
  inquiries?: any[];
  inquiryListingsMap?: Map<string, { id: string; title: string }>;
  inquiryProfilesMap?: Map<string, string>;
  onOpenDM: (profile: { user_id: string; display_name: string | null; avatar_url: string | null }) => void;
}

const InboxKanban = ({
  userId,
  conversations,
  partnerProfiles,
  inquiries,
  inquiryListingsMap,
  inquiryProfilesMap,
  onOpenDM,
}: Props) => {
  const navigate = useNavigate();

  // Pull projects (owner + collaborator) for the Projects lane.
  const { data: ownedProjects } = useQuery({
    queryKey: ["kanban-owned-projects", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, status, cover_color, updated_at")
        .eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: collabIds } = useQuery({
    queryKey: ["kanban-collab-ids", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("project_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.project_id);
    },
  });

  const { data: collabProjects } = useQuery({
    queryKey: ["kanban-collab-projects", collabIds],
    enabled: !!collabIds && collabIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, status, cover_color, updated_at")
        .in("id", collabIds!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const cards: ThreadCard[] = useMemo(() => {
    const out: ThreadCard[] = [];
    const now = Date.now();

    // ── DM cards ──
    if (partnerProfiles && conversations) {
      for (const p of partnerProfiles) {
        const lastMsg = conversations.get(p.user_id);
        if (!lastMsg) continue;
        const unread = lastMsg.receiver_id === userId && !lastMsg.read;
        const ageDays = (now - new Date(lastMsg.created_at).getTime()) / 86_400_000;
        const lane: LaneKey = unread
          ? "new"
          : ageDays > 14
            ? "closed"
            : "active";
        const preview = (lastMsg.content || "").slice(0, 60);
        out.push({
          id: `dm-${p.user_id}`,
          lane,
          kind: "dm",
          title: p.display_name || "Creator",
          subtitle: preview,
          avatarUrl: p.avatar_url,
          unread,
          updatedAt: lastMsg.created_at,
          onOpen: () => onOpenDM(p),
        });
      }
    }

    // ── Inquiry cards ──
    if (inquiries) {
      for (const i of inquiries) {
        const isReceiver = i.receiver_id === userId;
        const otherId = isReceiver ? i.sender_id : i.receiver_id;
        const otherName = inquiryProfilesMap?.get(otherId) ?? (isReceiver ? "Inquirer" : "Seller");
        const listing = inquiryListingsMap?.get(i.listing_id);
        const lane: LaneKey =
          i.status === "pending"
            ? (isReceiver ? "new" : "active")
            : i.status === "accepted"
              ? "active"
              : "closed";
        out.push({
          id: `inq-${i.id}`,
          lane,
          kind: "inquiry",
          title: listing?.title ?? "Listing inquiry",
          subtitle: `${isReceiver ? "From" : "To"}: ${otherName}`,
          context: i.message?.slice(0, 80),
          unread: isReceiver && i.status === "pending",
          updatedAt: i.created_at,
          onOpen: () => navigate(`/messages?tab=projects#inquiries-section`),
        });
      }
    }

    // ── Project cards ──
    const allProjects = [
      ...(ownedProjects ?? []),
      ...(collabProjects ?? []),
    ];
    const seen = new Set<string>();
    for (const p of allProjects) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const lane: LaneKey =
        p.status === "completed" || p.status === "archived"
          ? "closed"
          : p.status === "paused"
            ? "closed"
            : "active";
      out.push({
        id: `proj-${p.id}`,
        lane,
        kind: "project",
        title: p.title,
        subtitle: p.status === "active" ? "In progress" : p.status,
        accentColor: p.cover_color,
        updatedAt: p.updated_at,
        onOpen: () => navigate(`/messages?tab=projects&p=${p.id}`),
      });
    }

    // Sort each card group by recency (handled per-lane below).
    return out.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [partnerProfiles, conversations, inquiries, inquiryListingsMap, inquiryProfilesMap, ownedProjects, collabProjects, userId, navigate, onOpenDM]);

  const grouped = useMemo(() => {
    const g: Record<LaneKey, ThreadCard[]> = { new: [], active: [], closed: [] };
    for (const c of cards) g[c.lane].push(c);
    return g;
  }, [cards]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {LANES.map((lane) => {
        const LaneIcon = lane.icon;
        const items = grouped[lane.key];
        return (
          <div
            key={lane.key}
            className="surface-card flex flex-col h-[calc(100vh-22rem)] min-h-[480px]"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <LaneIcon className={cn("h-4 w-4", lane.tone)} />
              <h3 className="text-sm font-semibold text-foreground">{lane.label}</h3>
              <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                {items.length}
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 px-2">
                    {lane.key === "new" && "Nothing waiting. You're on top of things."}
                    {lane.key === "active" && "No active threads yet."}
                    {lane.key === "closed" && "Completed work shows up here."}
                  </p>
                ) : (
                  items.map((card) => <KanbanCard key={card.id} card={card} />)
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
};

const KanbanCard = ({ card }: { card: ThreadCard }) => {
  const meta = KIND_META[card.kind];
  const KindIcon = meta.icon;
  return (
    <button
      type="button"
      onClick={card.onOpen}
      className={cn(
        "group w-full text-left rounded-xl border bg-card hover:border-foreground/30 hover:shadow-sm transition-all p-3 space-y-2",
        card.unread ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <Badge className={cn("border-0 gap-1 text-[10px] py-0 h-4", meta.color)}>
          <KindIcon className="h-2.5 w-2.5" />
          {meta.label}
        </Badge>
        {card.unread && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="unread" />
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {formatDistanceToNowStrict(new Date(card.updatedAt), { addSuffix: false })}
        </span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        {card.kind === "dm" ? (
          <div
            className="h-7 w-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: card.avatarUrl ? undefined : colorFromName(card.title) }}
          >
            {card.avatarUrl ? (
              <img src={card.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initialOf(card.title)}</span>
            )}
          </div>
        ) : (
          <span
            className="h-7 w-7 rounded-md shrink-0 flex items-center justify-center"
            style={{ backgroundColor: card.accentColor ?? "hsl(var(--muted))" }}
          >
            <KindIcon className="h-3.5 w-3.5 text-white" />
          </span>
        )}
        <p className={cn(
          "text-sm truncate flex-1 text-foreground",
          card.unread ? "font-semibold" : "font-medium",
        )}>
          {card.title}
        </p>
      </div>
      {card.subtitle && (
        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {card.subtitle}
        </p>
      )}
      {card.context && (
        <p className="text-[10px] text-muted-foreground/70 italic line-clamp-1 border-l-2 border-border pl-2">
          “{card.context}”
        </p>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(card.updatedAt), "MMM d")}
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
};

export default InboxKanban;
