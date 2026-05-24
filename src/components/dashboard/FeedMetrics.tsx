/**
 * FeedMetrics — the Feed page core surface.
 *
 * 4 clickable tiles (Active Projects · Latest Message · Upcoming Events ·
 * $RHOZE Earned). Clicking a tile expands an inline panel below the grid
 * with real, condensed data + a "View all →" link to the canonical page.
 *
 * No invented copy, no promo cards, no empty-state filler. Every tile and
 * every list item links to a real route.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  FolderKanban,
  MessageSquare,
  Calendar,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import { todayGradient } from "@/lib/rhoze-gradients";
import type { User } from "@supabase/supabase-js";

type Tile = "projects" | "messages" | "events" | "rhoze";

function prettifyMessagePreview(raw?: string | null): string {
  if (!raw) return "No messages yet";
  const s = raw.trim();
  if (s.startsWith("[FLOW:") || s.startsWith('{"type":"flow_share"')) return "Shared a Flow item";
  if (s.startsWith("[FILE:")) return "Sent a file";
  if (s.startsWith("[SMARTBOARD:")) return "Shared a Smartboard";
  if (s.startsWith("[PROFILE:")) return "Shared a profile";
  if (s.startsWith("[LISTING:")) return "Shared a listing";
  if (s.startsWith("[EVENT:")) return "Shared an event";
  if (s.startsWith("[LINK:")) return "Sent a link";
  if (s.startsWith("[STAFF_INVITE:")) return "Sent a staff invitation";
  if (s.startsWith("[QUOTE:")) return "Sent a quote";
  return s;
}

interface FeedMetricsProps {
  user: User | null;
  activeProjects: number;
  projects: any[];
  recentMessages: any[];
  senderMap: Map<string, any>;
  events: any[];
  rhozeBalance: number;
  getProjectProgress: (projectId: string) => number;
}

const TileShell = ({
  active,
  onClick,
  invert = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  invert?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "text-left p-8 rounded-3xl border transition-all duration-300 min-h-[200px] flex flex-col justify-between group",
      invert
        ? "bg-foreground text-background border-foreground hover:bg-foreground/90"
        : "bg-card text-foreground border-border hover:shadow-xl hover:shadow-foreground/5",
      active && !invert && "ring-2 ring-foreground/80 shadow-xl",
      active && invert && "ring-2 ring-background/60",
    ].join(" ")}
  >
    {children}
  </button>
);

const TileLabel = ({ children, invert }: { children: React.ReactNode; invert?: boolean }) => (
  <div
    className={`mt-3 text-xs font-semibold uppercase tracking-wider font-body ${
      invert ? "text-background/50" : "text-muted-foreground"
    }`}
  >
    {children}
  </div>
);

const IconChip = ({ icon: Icon, invert }: { icon: any; invert?: boolean }) => (
  <div
    className={`p-2 rounded-lg ${
      invert ? "bg-background/10 text-background/60" : "bg-muted text-muted-foreground"
    }`}
  >
    <Icon className="w-5 h-5" />
  </div>
);

const ExpandedPanel = ({
  title,
  viewAllHref,
  viewAllLabel = "View all",
  onClose,
  children,
}: {
  title: string;
  viewAllHref: string;
  viewAllLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.25 }}
    className="bg-card border border-border rounded-3xl p-6 sm:p-8"
  >
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-body">
        {title}
      </h3>
      <div className="flex items-center gap-2">
        <Link
          to={viewAllHref}
          className="text-xs font-semibold text-foreground hover:underline font-body inline-flex items-center gap-1"
        >
          {viewAllLabel} <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
    {children}
  </motion.div>
);

const FeedMetrics = ({
  user,
  activeProjects,
  projects,
  recentMessages,
  senderMap,
  events,
  rhozeBalance,
  getProjectProgress,
}: FeedMetricsProps) => {
  const [expanded, setExpanded] = useState<Tile | null>(null);
  const toggle = (t: Tile) => setExpanded((prev) => (prev === t ? null : t));

  const heroLatestMsg = recentMessages?.[0] ?? null;
  const heroLatestSender = heroLatestMsg ? senderMap.get(heroLatestMsg.sender_id) : null;
  const nextEvent = events?.[0] ?? null;

  // Active projects shortlist for the expanded panel
  const activeProjectsList = (projects ?? [])
    .filter((p) => !["completed", "cancelled", "archived"].includes(p.status ?? ""))
    .slice(0, 5);

  // Recent reward transactions for the $RHOZE expanded panel
  const { data: rewardTxs = [] } = useQuery({
    queryKey: ["feed-recent-rewards", user?.id],
    enabled: !!user && expanded === "rhoze",
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, amount, type, description, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <section className="space-y-6">
      {/* Section label */}
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground font-body">
            Feed
          </h2>
          <p className="mt-2 font-display text-3xl sm:text-4xl tracking-tight text-foreground">
            What's moving today
          </p>
        </div>
      </header>

      {/* 4 tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Projects */}
        <TileShell active={expanded === "projects"} onClick={() => toggle("projects")}>
          <div className="flex justify-between items-start">
            <IconChip icon={FolderKanban} />
            {activeProjects > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 font-body">
                Live
              </span>
            )}
          </div>
          <div>
            <div className="font-display text-5xl text-foreground tabular-nums leading-none">
              {activeProjects}
            </div>
            <TileLabel>Active Projects</TileLabel>
          </div>
        </TileShell>

        {/* Latest Message */}
        <TileShell active={expanded === "messages"} onClick={() => toggle("messages")}>
          <div className="flex justify-between items-start">
            <IconChip icon={MessageSquare} />
            {heroLatestSender?.display_name && (
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 font-body truncate max-w-[80px]">
                {heroLatestSender.display_name.split(" ")[0]}
              </span>
            )}
          </div>
          <div>
            <div className="text-base font-medium text-foreground leading-snug line-clamp-2 h-[3rem] font-body">
              {heroLatestMsg
                ? prettifyMessagePreview(heroLatestMsg.content)
                : "No new messages"}
            </div>
            <TileLabel>Latest Message</TileLabel>
          </div>
        </TileShell>

        {/* Upcoming Events */}
        <TileShell active={expanded === "events"} onClick={() => toggle("events")} invert>
          <div className="flex justify-between items-start">
            <IconChip icon={Calendar} invert />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-background/40 font-body">
              {events.length > 0 ? `${events.length} upcoming` : "Calendar"}
            </span>
          </div>
          <div>
            <div className="text-base font-medium leading-snug line-clamp-2 h-[3rem] font-body">
              {nextEvent ? nextEvent.title : "Nothing scheduled"}
            </div>
            <TileLabel invert>
              {nextEvent
                ? format(new Date(nextEvent.start_time), "EEE, MMM d · h:mma")
                : "Upcoming events"}
            </TileLabel>
          </div>
        </TileShell>

        {/* $RHOZE Earned */}
        <TileShell active={expanded === "rhoze"} onClick={() => toggle("rhoze")}>
          <div className="flex justify-between items-start">
            <IconChip icon={Sparkles} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <div className="font-display text-5xl text-foreground tabular-nums">
                {Math.round(rhozeBalance).toLocaleString()}
              </div>
              <div className="text-sm font-bold text-muted-foreground font-body">$RHOZE</div>
            </div>
            <TileLabel>Rewards Earned</TileLabel>
          </div>
        </TileShell>
      </div>

      {/* Expanded panel */}
      <AnimatePresence mode="wait">
        {expanded === "projects" && (
          <ExpandedPanel
            key="projects"
            title="Active Projects"
            viewAllHref="/messages?tab=projects"
            onClose={() => setExpanded(null)}
          >
            {activeProjectsList.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body">No active projects yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activeProjectsList.map((p) => {
                  const progress = getProjectProgress(p.id);
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/projects/${p.id}`}
                        className="flex items-center justify-between gap-4 py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate font-body">
                            {p.name || p.title || "Untitled project"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 font-body">
                            {p.status ?? "active"} · updated{" "}
                            {p.updated_at ? format(new Date(p.updated_at), "MMM d") : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-foreground"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground w-8 text-right font-body">
                            {progress}%
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ExpandedPanel>
        )}

        {expanded === "messages" && (
          <ExpandedPanel
            key="messages"
            title="Unread Messages"
            viewAllHref="/messages"
            viewAllLabel="Open inbox"
            onClose={() => setExpanded(null)}
          >
            {recentMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body">No unread messages.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentMessages.map((m) => {
                  const sender = senderMap.get(m.sender_id);
                  return (
                    <li key={m.id}>
                      <Link
                        to="/messages"
                        className="flex items-start gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                          {sender?.avatar_url ? (
                            <img
                              src={sender.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate font-body">
                            {sender?.display_name || "Creator"}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-1 font-body">
                            {prettifyMessagePreview(m.content)}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 font-body shrink-0 mt-1">
                          {format(new Date(m.created_at), "MMM d")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ExpandedPanel>
        )}

        {expanded === "events" && (
          <ExpandedPanel
            key="events"
            title="Upcoming Events"
            viewAllHref="/events"
            onClose={() => setExpanded(null)}
          >
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body">
                Nothing scheduled. Browse what's coming up across Rhozeland.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {events.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/events/${e.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate font-body">
                          {e.title || "Untitled event"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-body">
                          {format(new Date(e.start_time), "EEE, MMM d · h:mma")}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </ExpandedPanel>
        )}

        {expanded === "rhoze" && (
          <ExpandedPanel
            key="rhoze"
            title="Recent Rewards"
            viewAllHref="/credits"
            viewAllLabel="Open Creator Pass"
            onClose={() => setExpanded(null)}
          >
            {rewardTxs.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body">No reward activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rewardTxs.map((t: any) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate font-body">
                        {t.description || t.type || "Reward"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-body">
                        {format(new Date(t.created_at), "MMM d, h:mma")}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums font-body ${
                        Number(t.amount) >= 0 ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {Number(t.amount) >= 0 ? "+" : ""}
                      {Math.round(Number(t.amount)).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ExpandedPanel>
        )}
      </AnimatePresence>
    </section>
  );
};

export default FeedMetrics;
