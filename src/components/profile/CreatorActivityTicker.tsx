/**
 * CreatorActivityTicker — slim, rotating ticker showing the creator's
 * 3 most-recent on-platform actions (new work, completed project,
 * hosted event, backer milestone). Items fade in/out every 6s.
 *
 * Same data source as `CreatorActivityCard`; visually condensed for the
 * profile header area.
 */
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Activity, FileImage, CheckCircle2, Calendar as CalendarIcon, Users } from "lucide-react";
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

const CreatorActivityTicker = ({
  creatorProfileId,
  creatorUserId,
  creatorName,
  tokenTicker,
}: Props) => {
  const { data: rows = [] } = useQuery<ActivityRow[]>({
    queryKey: ["creator-activity-ticker", creatorProfileId, creatorUserId],
    queryFn: async () => {
      const [worksRes, projectsRes, eventsRes, subsRes] = await Promise.all([
        supabase.from("works").select("id, title, created_at").eq("user_id", creatorUserId).is("archived_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("projects").select("id, title, updated_at, status").eq("user_id", creatorUserId).in("status", ["completed", "delivered", "closed"]).order("updated_at", { ascending: false }).limit(3),
        supabase.from("events").select("id, title, starts_at, status").eq("host_id", creatorProfileId).eq("status", "published" as any).lte("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(3),
        supabase.from("creator_subscriptions").select("id, created_at").eq("creator_id", creatorProfileId).eq("status", "active").order("created_at", { ascending: true }),
      ]);
      const out: ActivityRow[] = [];
      (worksRes.data ?? []).forEach((w: any) =>
        out.push({ key: `w-${w.id}`, icon: FileImage, label: `Posted new work · "${(w.title ?? "Untitled").slice(0, 38)}"`, at: w.created_at, points: 5 }),
      );
      (projectsRes.data ?? []).forEach((pr: any) =>
        out.push({ key: `p-${pr.id}`, icon: CheckCircle2, label: `Completed project · "${(pr.title ?? "Untitled").slice(0, 38)}"`, at: pr.updated_at, points: 10 }),
      );
      (eventsRes.data ?? []).forEach((ev: any) =>
        out.push({ key: `e-${ev.id}`, icon: CalendarIcon, label: `Hosted event · "${(ev.title ?? "Untitled").slice(0, 38)}"`, at: ev.starts_at, points: 8 }),
      );
      const subs = subsRes.data ?? [];
      [10, 25, 50, 100, 250].forEach((m) => {
        if (subs.length >= m) {
          const hitAt = subs[m - 1]?.created_at;
          if (hitAt) out.push({ key: `m-${m}`, icon: Users, label: `Hit ${m} backers milestone`, at: hitAt, points: 15 });
        }
      });
      out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      return out.slice(0, 6);
    },
    staleTime: 60_000,
  });

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (rows.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % rows.length), 6000);
    return () => clearInterval(t);
  }, [rows.length]);

  if (rows.length === 0) return null;
  const r = rows[idx % rows.length];
  const Icon = r.icon;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm px-3 sm:px-4 py-2.5 flex items-center gap-3 overflow-hidden">
      <div className="shrink-0 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Activity className="h-3 w-3" /> Activity
      </div>
      <div className="hidden sm:block w-px h-5 bg-border/60 shrink-0" />
      <div className="flex-1 min-w-0 relative h-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 flex items-center gap-2 min-w-0"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-foreground truncate">{r.label}</p>
            <span className="hidden sm:inline text-[10px] text-muted-foreground whitespace-nowrap">· {fmtAgo(r.at)}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
        +{r.points} Signal
      </span>
    </div>
  );
};

export default CreatorActivityTicker;
