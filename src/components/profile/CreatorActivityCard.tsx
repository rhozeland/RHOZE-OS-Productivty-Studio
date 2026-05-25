/**
 * CreatorActivityCard — recent on-platform activity that feeds the creator's
 * Signal score. Read-only, profile-page surface. Aggregates:
 *   • Posted new work        (+5)  → works.user_id, latest 5
 *   • Completed a project    (+10) → projects.user_id, status in (completed, delivered)
 *   • Hosted an event        (+8)  → events.host_id, status=published, starts_at <= now
 *   • Backer milestone       (+15) → creator_subscriptions count crosses 10/25/50/100
 *
 * The header makes the value loop explicit: activity → Signal → demand for
 * the linked pump.fun token.
 */
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  FileImage,
  CheckCircle2,
  Calendar as CalendarIcon,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNowStrict } from "date-fns";

interface Props {
  creatorProfileId: string;
  creatorUserId: string;
  creatorName: string;
  tokenTicker?: string | null;
}

interface ActivityRow {
  key: string;
  icon: typeof Activity;
  label: string;
  at: string;
  points: number;
}

const fmtAgo = (iso: string) => {
  try {
    return `${formatDistanceToNowStrict(new Date(iso))} ago`;
  } catch {
    return "";
  }
};

const CreatorActivityCard = ({
  creatorProfileId,
  creatorUserId,
  creatorName,
  tokenTicker,
}: Props) => {
  const { data: rows = [], isLoading } = useQuery<ActivityRow[]>({
    queryKey: ["creator-activity", creatorProfileId, creatorUserId],
    queryFn: async () => {
      const [worksRes, projectsRes, eventsRes, subsRes] = await Promise.all([
        supabase
          .from("works")
          .select("id, title, created_at")
          .eq("user_id", creatorUserId)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("projects")
          .select("id, title, updated_at, status")
          .eq("user_id", creatorUserId)
          .in("status", ["completed", "delivered", "closed"])
          .order("updated_at", { ascending: false })
          .limit(3),
        supabase
          .from("events")
          .select("id, title, starts_at, status")
          .eq("host_id", creatorProfileId)
          .eq("status", "published" as any)
          .lte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: false })
          .limit(3),
        supabase
          .from("creator_subscriptions")
          .select("id, created_at")
          .eq("creator_id", creatorProfileId)
          .eq("status", "active")
          .order("created_at", { ascending: true }),
      ]);

      const out: ActivityRow[] = [];

      (worksRes.data ?? []).forEach((w: any) =>
        out.push({
          key: `w-${w.id}`,
          icon: FileImage,
          label: `Posted new work · "${(w.title ?? "Untitled").slice(0, 38)}"`,
          at: w.created_at,
          points: 5,
        }),
      );
      (projectsRes.data ?? []).forEach((pr: any) =>
        out.push({
          key: `p-${pr.id}`,
          icon: CheckCircle2,
          label: `Completed a project · "${(pr.title ?? "Untitled").slice(0, 38)}"`,
          at: pr.updated_at,
          points: 10,
        }),
      );
      (eventsRes.data ?? []).forEach((ev: any) =>
        out.push({
          key: `e-${ev.id}`,
          icon: CalendarIcon,
          label: `Hosted an event · "${(ev.title ?? "Untitled").slice(0, 38)}"`,
          at: ev.starts_at,
          points: 8,
        }),
      );

      // Backer milestones (10/25/50/100/250…) — emit one row per crossed tier.
      const subs = subsRes.data ?? [];
      const milestones = [10, 25, 50, 100, 250, 500];
      milestones.forEach((m) => {
        if (subs.length >= m) {
          const hitAt = subs[m - 1]?.created_at;
          if (hitAt) {
            out.push({
              key: `m-${m}`,
              icon: Users,
              label: `Hit ${m} backers milestone`,
              at: hitAt,
              points: 15,
            });
          }
        }
      });

      out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      return out.slice(0, 8);
    },
  });

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Creator Activity</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Signal score grows when {creatorName} is active. Higher signal = more
            visibility on Rhozeland = more demand for $
            {(tokenTicker || "TOKEN").toUpperCase()}.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 rounded-lg bg-muted/40 animate-pulse" />
          <div className="h-10 rounded-lg bg-muted/40 animate-pulse" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No recent activity yet — uploads, completed projects, hosted events,
          and backer milestones will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.key} className="flex items-center gap-3 py-2">
                <div className="h-7 w-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtAgo(r.at)}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-emerald-500 tabular-nums">
                  +{r.points} Signal
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CreatorActivityCard;
