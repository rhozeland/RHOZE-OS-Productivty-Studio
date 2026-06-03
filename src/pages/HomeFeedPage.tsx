/**
 * HomeFeedPage — `/home` (v11 Pillar 8)
 *
 * Personalized activity feed. NOT Flow Mode, NOT a dashboard of tools.
 * A live feed of what's happening around the user's account.
 *
 * Zones:
 *   A — Greeting + 4 stat pills (role-aware)
 *   B — Threshold meter (musicians only, hidden once coin is live)
 *   C — Activity feed (tabs: All · Creators · Events · Live · Activity)
 *
 * Monday-only weekly recap pinned above the filter tabs.
 *
 * Uses existing card styles + design tokens — no new visual language.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  TrendingUp,
  Heart,
  Rocket,
  Globe,
  Music,
  Mail,
  Coins,
  CalendarDays,
  Layers,
  Users as UsersIcon,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveRole } from "@/hooks/useActiveRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type FeedKind =
  | "milestone"
  | "coin_move"
  | "new_backer"
  | "coin_launched"
  | "project_public"
  | "new_musician";

type FeedItem = {
  id: string;
  kind: FeedKind;
  category: "creators" | "events" | "live" | "activity";
  ts: string; // ISO
  title: string;
  sub?: string;
  href?: string;
  cta?: string;
  actor?: { display_name: string; avatar_url?: string | null; user_id: string };
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
};

const groupForTs = (iso: string): "Today" | "Yesterday" | "This Week" => {
  const d = new Date(iso);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = (now.getTime() - d.getTime()) / dayMs;
  if (d.toDateString() === now.toDateString()) return "Today";
  if (diff < 2) return "Yesterday";
  return "This Week";
};

// ─── Zone A — Stat pill ──────────────────────────────────────────────────
const StatPill = ({
  icon: Icon,
  value,
  label,
  to,
  onClick,
  badge,
}: {
  icon: typeof Heart;
  value: number | string;
  label: string;
  to?: string;
  onClick?: () => void;
  badge?: boolean;
}) => {
  const inner = (
    <div className="relative flex items-center gap-3 rounded-full border border-border bg-card/60 px-4 py-2.5 hover:bg-card transition-colors min-w-0">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold tabular-nums leading-none">{value}</div>
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      </div>
      {badge && (
        <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-rose-500" />
      )}
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="text-left">
      {inner}
    </button>
  );
};

// ─── Zone C — Feed card ──────────────────────────────────────────────────
const ICON_BY_KIND: Record<FeedKind, { Icon: typeof Heart; tone: string }> = {
  milestone: { Icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-500" },
  coin_move: { Icon: TrendingUp, tone: "bg-emerald-500/15 text-emerald-500" },
  new_backer: { Icon: Heart, tone: "bg-purple-500/15 text-purple-500" },
  coin_launched: { Icon: Rocket, tone: "bg-amber-500/15 text-amber-500" },
  project_public: { Icon: Globe, tone: "bg-sky-500/15 text-sky-500" },
  new_musician: { Icon: Music, tone: "bg-muted text-foreground" },
};

const FeedCard = ({ item }: { item: FeedItem }) => {
  const { Icon, tone } = ICON_BY_KIND[item.kind];
  return (
    <Card className="p-4 flex items-center gap-3 hover:bg-card/80 transition-colors">
      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        {item.sub && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {item.sub} · {formatDistanceToNow(new Date(item.ts), { addSuffix: true })}
          </p>
        )}
      </div>
      {item.href && (
        <Button asChild size="sm" variant="ghost" className="shrink-0">
          <Link to={item.href}>{item.cta ?? "View"} <ArrowRight className="h-3 w-3 ml-1" /></Link>
        </Button>
      )}
    </Card>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────
const HomeFeedPage = () => {
  const { user } = useAuth();
  const [role] = useActiveRole();
  const navigate = useNavigate();
  const isMusician = role === "creator";
  const [filter, setFilter] = useState<"all" | "creators" | "events" | "live" | "activity">("all");

  // Profile (for greeting name)
  const { data: profile } = useQuery({
    queryKey: ["home-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, token_mint_address")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const firstName =
    (profile?.display_name?.split(" ")[0]) ||
    profile?.username ||
    user?.email?.split("@")[0] ||
    "there";

  // ─── Stats ──────────────────────────────────────────────────────────
  const { data: creatorsBacked = 0 } = useQuery({
    queryKey: ["home-creators-backed", user?.id],
    enabled: !!user && !isMusician,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("creator_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("subscriber_id", user!.id)
        .eq("status", "active");
      return count ?? 0;
    },
  });

  const { data: rhozeEarned = 0 } = useQuery({
    queryKey: ["home-rhoze", user?.id],
    enabled: !!user && !isMusician,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return Math.floor(Number((data as any)?.balance ?? 0));
    },
  });

  const { data: upcomingEvents = 0 } = useQuery({
    queryKey: ["home-upcoming-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .gte("start_time", new Date().toISOString());
      return count ?? 0;
    },
  });

  const { data: unread = 0 } = useQuery({
    queryKey: ["home-unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });

  // Musician-only stats
  const { data: myProjects = [] } = useQuery({
    queryKey: ["home-my-projects", user?.id],
    enabled: !!user && isMusician,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, status, is_public, public_slug, cheer_count, tokenize_ready, linked_token_id, updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  const activeProjects = myProjects.filter((p: any) => p.status === "active").length;

  const { data: pendingInquiries = 0 } = useQuery({
    queryKey: ["home-pending-inquiries", user?.id],
    enabled: !!user && isMusician,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("project_proposals")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", user!.id)
        .in("status", ["draft", "pending"]);
      return count ?? 0;
    },
  });

  // ─── Threshold meter (musician only, hide if coin already live) ────
  const hasLiveCoin = !!profile?.token_mint_address || myProjects.some((p: any) => p.linked_token_id);
  const bestProject = useMemo(() => {
    if (!myProjects.length) return null;
    return [...myProjects].sort((a: any, b: any) => (b.cheer_count ?? 0) - (a.cheer_count ?? 0))[0];
  }, [myProjects]);

  const { data: bestMilestoneCount = 0 } = useQuery({
    queryKey: ["home-milestone-count", bestProject?.id],
    enabled: !!bestProject?.id,
    queryFn: async () => {
      const { data: contracts } = await supabase
        .from("project_contracts")
        .select("id")
        .eq("project_id", bestProject!.id);
      const ids = (contracts ?? []).map((c: any) => c.id);
      if (ids.length === 0) return 0;
      const { count } = await supabase
        .from("project_milestones")
        .select("id", { count: "exact", head: true })
        .in("contract_id", ids)
        .not("approved_at", "is", null);
      return count ?? 0;
    },
  });

  const supporters = bestProject?.cheer_count ?? 0;
  const supportersMet = supporters >= 10;
  const milestonesMet = bestMilestoneCount >= 2;
  const tokenizeUnlocked = supportersMet && milestonesMet;

  // ─── Activity feed (aggregate from a few sources) ──────────────────
  const { data: feedItems = [] } = useQuery({
    queryKey: ["home-feed", user?.id, isMusician],
    enabled: !!user,
    queryFn: async () => {
      const items: FeedItem[] = [];

      // 1. New musicians (last 7 days)
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: newMusicians } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, archetype, region_code, created_at")
        .gte("created_at", since)
        .not("display_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(8);
      (newMusicians ?? []).forEach((p: any) => {
        if (p.user_id === user!.id) return;
        items.push({
          id: `new-musician-${p.user_id}`,
          kind: "new_musician",
          category: "creators",
          ts: p.created_at,
          title: `${p.display_name || p.username} just joined Rhozeland`,
          sub: [p.archetype, p.region_code].filter(Boolean).join(" · "),
          href: `/profile/${p.user_id}`,
          cta: "Follow",
          actor: { display_name: p.display_name || p.username, avatar_url: p.avatar_url, user_id: p.user_id },
        });
      });

      // 2. Projects made public (last 14 days)
      const since14 = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data: publicProjects } = await supabase
        .from("projects")
        .select("id, title, public_slug, user_id, updated_at, is_public")
        .eq("is_public", true)
        .gte("updated_at", since14)
        .order("updated_at", { ascending: false })
        .limit(8);

      const ownerIds = [...new Set((publicProjects ?? []).map((p: any) => p.user_id))];
      const ownerMap = new Map<string, any>();
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", ownerIds);
        (owners ?? []).forEach((o: any) => ownerMap.set(o.user_id, o));
      }
      (publicProjects ?? []).forEach((p: any) => {
        if (p.user_id === user!.id) return;
        const owner = ownerMap.get(p.user_id);
        const name = owner?.display_name || owner?.username || "A musician";
        items.push({
          id: `public-${p.id}`,
          kind: "project_public",
          category: "activity",
          ts: p.updated_at,
          title: `${name} just made their project public`,
          sub: `${p.title} — follow the roadmap`,
          href: p.public_slug ? `/release/${p.public_slug}` : `/projects/${p.id}`,
          cta: "Follow Release",
        });
      });

      // 3. Recently approved milestones
      const { data: recentMs } = await supabase
        .from("project_milestones")
        .select("id, title, approved_at, contract_id")
        .not("approved_at", "is", null)
        .gte("approved_at", since14)
        .order("approved_at", { ascending: false })
        .limit(10);
      const contractIds = [...new Set((recentMs ?? []).map((m: any) => m.contract_id))];
      const contractMap = new Map<string, any>();
      if (contractIds.length) {
        const { data: cs } = await supabase
          .from("project_contracts")
          .select("id, project_id")
          .in("id", contractIds);
        const projIds = [...new Set((cs ?? []).map((c: any) => c.project_id))];
        const { data: ps } = projIds.length
          ? await supabase.from("projects").select("id, title, user_id").in("id", projIds)
          : { data: [] as any[] };
        const projMap = new Map<string, any>();
        (ps ?? []).forEach((p: any) => projMap.set(p.id, p));
        (cs ?? []).forEach((c: any) => contractMap.set(c.id, projMap.get(c.project_id)));
      }
      const msOwnerIds = [...new Set(
        Array.from(contractMap.values()).filter(Boolean).map((p: any) => p.user_id)
      )];
      const msOwnerMap = new Map<string, any>();
      if (msOwnerIds.length) {
        const { data: owners } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", msOwnerIds);
        (owners ?? []).forEach((o: any) => msOwnerMap.set(o.user_id, o));
      }
      (recentMs ?? []).forEach((m: any) => {
        const proj = contractMap.get(m.contract_id);
        if (!proj) return;
        const owner = msOwnerMap.get(proj.user_id);
        const name = owner?.display_name || owner?.username || "A musician";
        items.push({
          id: `ms-${m.id}`,
          kind: "milestone",
          category: "activity",
          ts: m.approved_at,
          title: `${name} completed a milestone on ${proj.title}`,
          sub: m.title,
          href: `/projects/${proj.id}`,
          cta: "View",
        });
      });

      return items.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
    },
  });

  const filtered = useMemo(() => {
    if (filter === "all") return feedItems;
    return feedItems.filter((i) => i.category === filter);
  }, [feedItems, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, FeedItem[]> = { Today: [], Yesterday: [], "This Week": [] };
    filtered.forEach((i) => map[groupForTs(i.ts)].push(i));
    return map;
  }, [filtered]);

  const isMonday = new Date().getDay() === 1;

  // Open inbox helper (dispatches a global event the layout listens for; falls back to /messages)
  const openInbox = () => {
    window.dispatchEvent(new CustomEvent("rhz:open-inbox"));
    navigate("/messages");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-8">
      {/* ─── Zone A — Greeting + Stats ───────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Good {greeting()},{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {firstName}
            </span>
            .
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isMusician
              ? "Your feed and activity."
              : "Posts and updates from musicians you follow and support."}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {isMusician ? (
            <>
              <StatPill icon={Layers} value={activeProjects} label="Active Projects" to="/my-projects" />
              <StatPill
                icon={UsersIcon}
                value={pendingInquiries}
                label="Pending Inquiries"
                to="/market"
                badge={pendingInquiries > 0}
              />
              <StatPill icon={CalendarDays} value={upcomingEvents} label="Upcoming Events" to="/discover" />
              <StatPill
                icon={Mail}
                value={unread}
                label="Unread Messages"
                onClick={openInbox}
                badge={unread > 0}
              />
            </>
          ) : (
            <>
              <StatPill icon={Heart} value={creatorsBacked} label="Creators Backed" to="/portfolio" />
              <StatPill icon={Coins} value={rhozeEarned} label="$RHOZE Earned" to="/credits" />
              <StatPill icon={CalendarDays} value={upcomingEvents} label="Upcoming Events" to="/discover" />
              <StatPill
                icon={Mail}
                value={unread}
                label="Unread Messages"
                onClick={openInbox}
                badge={unread > 0}
              />
            </>
          )}
        </div>
      </section>

      {/* ─── Zone B — Threshold meter (musician only) ────────────────── */}
      {isMusician && !hasLiveCoin && bestProject && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Your path to tokenization</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium">Supporters</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {supporters} of 10 required
                </span>
              </div>
              <Progress
                value={Math.min(100, (supporters / 10) * 100)}
                className="h-2 [&>div]:bg-emerald-500"
              />
              {supportersMet && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Threshold met
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium">Milestones</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {bestMilestoneCount} of 2 required
                </span>
              </div>
              <Progress
                value={Math.min(100, (bestMilestoneCount / 2) * 100)}
                className="h-2 [&>div]:bg-purple-500"
              />
              {milestonesMet && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Threshold met
                </div>
              )}
            </div>
          </div>

          {tokenizeUnlocked ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">
                Your Tokenize CTA is now live on your release page. Fans can see it.
              </p>
              {bestProject.public_slug && (
                <Button asChild size="sm">
                  <Link to={`/release/${bestProject.public_slug}`}>
                    View release page <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {!supportersMet && !milestonesMet
                ? `Reach ${10 - supporters} more supporters and complete ${2 - bestMilestoneCount} more milestone${2 - bestMilestoneCount === 1 ? "" : "s"} to unlock your coin launch CTA.`
                : !supportersMet
                  ? `Reach ${10 - supporters} more supporter${10 - supporters === 1 ? "" : "s"} to unlock your coin launch CTA.`
                  : `Complete ${2 - bestMilestoneCount} more milestone${2 - bestMilestoneCount === 1 ? "" : "s"} to unlock your coin launch CTA.`}
            </p>
          )}
        </Card>
      )}

      {/* ─── Monday-only weekly recap ────────────────────────────────── */}
      {isMonday && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-[10px] uppercase tracking-widest text-primary/80 mb-1">Weekly recap</p>
          <p className="text-sm text-foreground">
            {isMusician
              ? "Last week: your activity is rolling in — check Studio for the full breakdown."
              : "Last week: new milestones from musicians you back are in your feed below."}
          </p>
        </Card>
      )}

      {/* ─── Zone C — Filter tabs + Feed ─────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {(["all", "creators", "events", "live", "activity"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap",
                filter === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card className="p-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Nothing yet — start by following musicians or exploring Discover.
            </p>
            <Button asChild>
              <Link to="/discover">Go to Discover <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </Card>
        ) : (
          (["Today", "Yesterday", "This Week"] as const).map((group) =>
            grouped[group].length > 0 ? (
              <div key={group} className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground px-1">
                  {group}
                </h3>
                <div className="space-y-2">
                  {grouped[group].map((item) => (
                    <FeedCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ) : null
          )
        )}
      </section>
    </div>
  );
};

export default HomeFeedPage;
