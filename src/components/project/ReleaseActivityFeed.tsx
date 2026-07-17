/**
 * ReleaseActivityFeed — build-in-public activity stream.
 *
 * Aggregates into a single reverse-chronological list:
 *  - Story updates (`project_story_updates`)
 *  - Milestone events (approved / submitted / released)
 *  - Cheers (`project_cheers` — most recent supporters)
 *  - Disputes filed / resolved (owner view only)
 *
 * Used both inside the owner workspace (ProjectDetailPage → Activity tab)
 * and on the public release page (ReleasePage → Activity tab) via the
 * `publicOnly` flag — private story updates + disputes are hidden there.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import {
  Sparkles,
  CheckCircle2,
  Flag,
  Heart,
  Rocket,
  MessageSquare,
  Lock,
} from "lucide-react";

type FeedEvent = {
  id: string;
  kind: "story" | "milestone" | "cheer" | "dispute";
  at: string;
  title: string;
  body?: string | null;
  actorId?: string | null;
  private?: boolean;
  icon: JSX.Element;
  accent: string;
};

interface Props {
  projectId: string;
  contractId?: string | null;
  /** Public release view — hide private updates + disputes. */
  publicOnly?: boolean;
}

const ReleaseActivityFeed = ({ projectId, contractId, publicOnly }: Props) => {
  const { data: stories } = useQuery({
    queryKey: ["activity-stories", projectId],
    queryFn: async () => {
      const q = supabase
        .from("project_story_updates" as any)
        .select("id, title, body, is_public, created_at, user_id")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(30);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });

  const { data: milestones } = useQuery({
    queryKey: ["activity-milestones", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_milestones")
        .select("id, title, status, submitted_at, approved_at, updated_at")
        .eq("contract_id", contractId!)
        .order("updated_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: cheers } = useQuery({
    queryKey: ["activity-cheers", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_cheers")
        .select("id, user_id, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const { data: disputes } = useQuery({
    queryKey: ["activity-disputes", projectId],
    enabled: !!contractId && !publicOnly,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_disputes")
        .select("id, reason, status, created_at, resolved_at, dispute_type")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // Collect all actor ids to resolve display names in one call.
  const actorIds = useMemo(() => {
    const ids = new Set<string>();
    (stories ?? []).forEach((s: any) => s.user_id && ids.add(s.user_id));
    (cheers ?? []).forEach((c: any) => c.user_id && ids.add(c.user_id));
    return Array.from(ids);
  }, [stories, cheers]);

  const { data: profiles } = useQuery({
    queryKey: ["activity-profiles", actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", actorIds);
      return data ?? [];
    },
  });

  const nameOf = (uid?: string | null) => {
    if (!uid) return "Someone";
    const p = profiles?.find((x: any) => x.user_id === uid);
    return p?.display_name || p?.username || "Someone";
  };

  const events: FeedEvent[] = useMemo(() => {
    const out: FeedEvent[] = [];

    (stories ?? []).forEach((s: any) => {
      if (publicOnly && s.is_public === false) return;
      out.push({
        id: `story-${s.id}`,
        kind: "story",
        at: s.created_at,
        title: s.title,
        body: s.body,
        actorId: s.user_id,
        private: s.is_public === false,
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        accent: "text-violet-500 bg-violet-500/10 border-violet-500/20",
      });
    });

    (milestones ?? []).forEach((m: any) => {
      const s = (m.status || "").toLowerCase();
      if (s === "approved" || s === "released") {
        out.push({
          id: `ms-approved-${m.id}`,
          kind: "milestone",
          at: m.approved_at || m.updated_at,
          title: `Milestone approved · ${m.title}`,
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        });
      } else if (s === "submitted" && m.submitted_at) {
        out.push({
          id: `ms-submitted-${m.id}`,
          kind: "milestone",
          at: m.submitted_at,
          title: `Milestone submitted for review · ${m.title}`,
          icon: <Rocket className="h-3.5 w-3.5" />,
          accent: "text-sky-500 bg-sky-500/10 border-sky-500/20",
        });
      }
    });

    (cheers ?? []).forEach((c: any) => {
      out.push({
        id: `cheer-${c.id}`,
        kind: "cheer",
        at: c.created_at,
        title: `${nameOf(c.user_id)} cheered this release`,
        actorId: c.user_id,
        icon: <Heart className="h-3.5 w-3.5" />,
        accent: "text-rose-500 bg-rose-500/10 border-rose-500/20",
      });
    });

    if (!publicOnly) {
      (disputes ?? []).forEach((d: any) => {
        out.push({
          id: `dispute-${d.id}`,
          kind: "dispute",
          at: d.created_at,
          title: `Dispute filed · ${d.dispute_type}`,
          body: d.reason,
          private: true,
          icon: <Flag className="h-3.5 w-3.5" />,
          accent: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        });
        if (d.resolved_at) {
          out.push({
            id: `dispute-res-${d.id}`,
            kind: "dispute",
            at: d.resolved_at,
            title: `Dispute resolved · ${d.dispute_type}`,
            private: true,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
          });
        }
      });
    }

    return out
      .filter((e) => !!e.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 60);
  }, [stories, milestones, cheers, disputes, publicOnly, profiles]);

  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-muted-foreground/60 mb-2" />
        <p className="text-sm text-muted-foreground">
          {publicOnly
            ? "No updates from the artist yet — check back soon."
            : "No activity yet. Post a story update or hit a milestone to start the feed."}
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 pl-3 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border">
      {events.map((e) => (
        <li key={e.id} className="relative pl-6">
          <span
            className={`absolute -left-[3px] top-2 grid h-5 w-5 place-items-center rounded-full border ${e.accent}`}
          >
            {e.icon}
          </span>
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              <span>{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</span>
              {e.private && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] normal-case tracking-normal">
                  <Lock className="h-2.5 w-2.5" /> Private
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground leading-snug">{e.title}</p>
            {e.body && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {e.body}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
};

export default ReleaseActivityFeed;
