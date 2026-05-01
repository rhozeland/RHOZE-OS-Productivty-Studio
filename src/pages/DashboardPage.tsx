/**
 * DashboardPage — the authed Home surface.
 *
 * Pivot v5 ("Spaces"):
 *   Rhozeland is a network of *spaces*. Home presents two parallel networks
 *   as equal peers — Studio Spaces (physical) and the Hub (digital) — and
 *   shows that everything funnels into Projects (the work that happens
 *   inside a space).
 *
 * Layout, top-to-bottom:
 *   ACT 1 — Split-screen duo hero ........ Studios | Hub, shared search bar
 *   ACT 2 — Cinematic stacked previews ... full-width "Nearby studios" + "Hub pulse"
 *   ACT 3 — Unified pulse feed ........... toggle: All / Studios / Hub activity
 *   ACT 4 — Map meets grid ............... studios on a city list, people on a grid
 *
 * Personal sections (Recent Projects, Schedule, Messages, etc.) live BELOW
 * the network surface so the dual-network framing leads. Customizer is kept
 * for power users to reorder personal sections only.
 *
 * Guests: see GuestDashboardPreview in place of personal sections, but
 * still see Acts 1–4 so the network feel hits before sign-up.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import {
  FolderKanban,
  Calendar,
  MessageSquare,
  ArrowRight,
  Building2,
  Clock,
  Zap,
  Settings2,
  GripVertical,
  Eye,
  EyeOff,
  Flame,
  User,
  Search,
  MapPin,
  Sparkles,
  Users,
  Radio,
  Briefcase,
  Megaphone,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import GuestDashboardPreview from "@/components/guest/GuestDashboardPreview";
import VerifiedIPBadge from "@/components/works/VerifiedIPBadge";
import { format } from "date-fns";

type DashboardLayout = {
  sections: string[];
  hiddenSections: string[];
  showCalendar: boolean;
};

const ALL_SECTIONS = ["projects", "events", "messages"];

const SECTION_META: Record<string, { label: string; icon: any }> = {
  projects: { label: "Projects", icon: FolderKanban },
  events: { label: "Schedule", icon: Calendar },
  messages: { label: "Messages", icon: MessageSquare },
};

const DEFAULT_LAYOUT: DashboardLayout = {
  sections: ["projects", "events", "messages"],
  hiddenSections: [],
  showCalendar: false,
};

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [networkSearch, setNetworkSearch] = useState("");
  const [pulseScope, setPulseScope] = useState<"all" | "studios" | "hub">("all");

  // ── Profile & layout (personal sections only) ──
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url, dashboard_layout")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const rawLayout = (profile as any)?.dashboard_layout;
  const parsedLayout: DashboardLayout = useMemo(() => {
    if (!rawLayout) return DEFAULT_LAYOUT;
    const parsed = typeof rawLayout === "string" ? JSON.parse(rawLayout) : rawLayout;
    const sections = (parsed.sections ?? DEFAULT_LAYOUT.sections).filter((s: string) =>
      ALL_SECTIONS.includes(s),
    );
    const ensured = [
      ...sections,
      ...ALL_SECTIONS.filter((s) => !sections.includes(s)),
    ];
    return {
      sections: ensured,
      hiddenSections: parsed.hiddenSections ?? [],
      showCalendar: parsed.showCalendar ?? false,
    };
  }, [rawLayout]);

  const [sectionOrder, setSectionOrder] = useState<string[]>(parsedLayout.sections);
  const [hiddenSections, setHiddenSections] = useState<string[]>(parsedLayout.hiddenSections);

  useEffect(() => {
    setSectionOrder(parsedLayout.sections);
    setHiddenSections(parsedLayout.hiddenSections);
  }, [parsedLayout]);

  const saveLayout = useMutation({
    mutationFn: async (newLayout: DashboardLayout) => {
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ dashboard_layout: newLayout } as any)
        .eq("user_id", user!.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  const persistLayout = (order: string[], hidden: string[]) => {
    if (!user) return;
    saveLayout.mutate({ sections: order, hiddenSections: hidden, showCalendar: false });
  };

  const handleReorder = (newOrder: string[]) => {
    setSectionOrder(newOrder);
    persistLayout(newOrder, hiddenSections);
  };

  const toggleSection = (key: string) => {
    const newHidden = hiddenSections.includes(key)
      ? hiddenSections.filter((s) => s !== key)
      : [...hiddenSections, key];
    setHiddenSections(newHidden);
    persistLayout(sectionOrder, newHidden);
  };

  // ── Personal data (below the network surface) ──
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*");
      return data ?? [];
    },
  });
  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(5);
      return data ?? [];
    },
  });
  const { data: unreadCount } = useQuery({
    queryKey: ["unread-messages-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
  });
  const { data: recentMessages } = useQuery({
    queryKey: ["recent-messages-dashboard", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("receiver_id", user!.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
    enabled: !!user,
  });
  const { data: messageSenders } = useQuery({
    queryKey: ["message-sender-profiles", recentMessages?.map((m) => m.sender_id)],
    queryFn: async () => {
      const ids = [...new Set(recentMessages!.map((m) => m.sender_id))];
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);
      return data ?? [];
    },
    enabled: !!recentMessages && recentMessages.length > 0,
  });
  const senderMap = new Map(messageSenders?.map((p) => [p.user_id, p]) ?? []);
  const { data: collaborators } = useQuery({
    queryKey: ["project-collaborator-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_collaborators")
        .select("project_id");
      return data ?? [];
    },
  });
  const collabCounts = new Map<string, number>();
  collaborators?.forEach((c) => {
    collabCounts.set(c.project_id, (collabCounts.get(c.project_id) || 0) + 1);
  });

  // ── Network data (Acts 1–4) ──
  const { data: studios } = useQuery({
    queryKey: ["home-studios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("id, name, slug, city, country, hero_image_url, cover_image_url, rating_avg, category")
        .eq("is_active", true)
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });
  const { data: rooms } = useQuery({
    queryKey: ["home-rooms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("drop_rooms")
        .select("id, title, description, cover_color, created_at, created_by, category")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });
  const { data: people } = useQuery({
    queryKey: ["home-people"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("user_id, display_name, avatar_url, username, headline, location")
        .not("display_name", "is", null)
        .limit(12);
      return data ?? [];
    },
  });
  const { data: hubListings } = useQuery({
    queryKey: ["home-hub-listings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("id, title, description, category, listing_type, cover_url, image_url, user_id, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });
  const { data: studioBookings } = useQuery({
    queryKey: ["my-studio-bookings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_bookings")
        .select("*, studios(name, cover_image_url, category)")
        .eq("user_id", user!.id)
        .gte("end_time", new Date().toISOString())
        .order("start_time")
        .limit(3);
      return data ?? [];
    },
    enabled: !!user,
  });

  // ── Computed ──
  const completedTasks = tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = tasks?.length ?? 0;
  const activeProjects = projects?.filter((p) => p.status === "active").length ?? 0;
  const firstName =
    profile?.display_name?.split(" ")[0]?.trim() ||
    (profile as any)?.username?.trim() ||
    user?.user_metadata?.full_name?.split(" ")[0]?.trim() ||
    user?.email?.split("@")[0] ||
    "Creator";

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks?.filter((t) => t.project_id === projectId) ?? [];
    if (projectTasks.length === 0) return 0;
    return Math.round(
      (projectTasks.filter((t) => t.completed).length / projectTasks.length) * 100,
    );
  };

  // Unified pulse: merge studio + hub items, sorted by recency
  type PulseItem = {
    kind: "studio" | "hub";
    id: string;
    title: string;
    subtitle: string | null;
    image: string | null;
    href: string;
    timestamp: string;
    icon: any;
  };
  const pulseItems = useMemo<PulseItem[]>(() => {
    const items: PulseItem[] = [];
    (studios ?? []).forEach((s: any) => {
      const img = s.cover_image_url ?? s.hero_image_url ?? null;
      if (!img) return; // skip filler-only studios
      items.push({
        kind: "studio",
        id: `s-${s.id}`,
        title: s.name,
        subtitle: [s.city, s.country].filter(Boolean).join(", ") || "Studio Space",
        image: img,
        href: `/studios/${s.id}`,
        timestamp: s.created_at ?? new Date().toISOString(),
        icon: Building2,
      });
    });
    (hubListings ?? []).forEach((l: any) => {
      const img = l.cover_url ?? l.image_url ?? null;
      if (!img) return; // skip filler-only listings
      items.push({
        kind: "hub",
        id: `h-${l.id}`,
        title: l.title,
        subtitle: l.category ?? "Offering",
        image: img,
        href: `/marketplace/${l.id}`,
        timestamp: l.created_at,
        icon: Sparkles,
      });
    });
    return items
      .filter((i) => pulseScope === "all" || (pulseScope === "studios" ? i.kind === "studio" : i.kind === "hub"))
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
      .slice(0, 8);
  }, [studios, hubListings, pulseScope]);

  const handleNetworkSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = networkSearch.trim();
    if (!q) return;
    // Send searches into Hub by default — Hub owns discovery copy.
    navigate(`/hub?q=${encodeURIComponent(q)}`);
  };

  // ── Personal section renderers ──
  const renderProjectsSection = () => (
    <motion.section key="projects" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-foreground">Recent Projects</h2>
        <Link
          to="/projects"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {projects?.length === 0 ? (
        <div className="border border-dashed border-primary/20 rounded-lg p-6 bg-primary/[0.02]">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FolderKanban className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground font-body mb-1">
                Projects = the work that happens inside a Space
              </p>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                Step into a studio or jump into the Hub — every collaboration ends up
                here as a project with milestones, budgets, and anchored deliverables.
              </p>
            </div>
          </div>
          <Link to="/projects" className="btn-editorial text-xs">
            Start a Project <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {projects?.slice(0, 4).map((project) => {
            const progress = getProjectProgress(project.id);
            const teamCount = (collabCounts.get(project.id) || 0) + 1;
            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center gap-4 bg-card p-4 hover:bg-muted/50 transition-colors group"
              >
                <div
                  className="h-10 w-10 rounded-md shrink-0 flex items-center justify-center"
                  style={{ background: project.cover_color ?? "hsl(var(--muted))" }}
                >
                  <FolderKanban className="h-4 w-4 text-primary-foreground/70" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors font-body">
                      {project.title}
                    </p>
                    <span className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                      {project.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="h-1 flex-1" />
                    <span className="text-[10px] text-muted-foreground shrink-0 font-body">
                      {progress}%
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-body">
                      {teamCount} {teamCount === 1 ? "member" : "members"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </motion.section>
  );

  const renderEventsSection = () => (
    <motion.section key="events" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-foreground">Upcoming Events</h2>
        <Link
          to="/calendar"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {events?.length === 0 ? (
        <div className="border border-dashed border-primary/20 rounded-lg p-6 bg-primary/[0.02]">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground font-body mb-1">
                Schedule sessions with collaborators
              </p>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                Book studio time, schedule sessions, and manage your creative calendar
                all in one place.
              </p>
            </div>
          </div>
          <Link to="/calendar" className="btn-editorial text-xs">
            Create Event <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {events?.slice(0, 4).map((event) => (
            <div key={event.id} className="flex items-center gap-4 bg-card p-4">
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center text-primary-foreground font-display text-sm shrink-0"
                style={{ backgroundColor: event.color ?? "hsl(var(--primary))" }}
              >
                {format(new Date(event.start_time), "dd")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate font-body">
                  {event.title}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-body">
                  <Clock className="h-3 w-3" />
                  {format(new Date(event.start_time), "EEEE, MMM d · h:mm a")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );

  const renderMessagesSection = () => (
    <motion.section key="messages" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-foreground">
          Messages
          {(unreadCount ?? 0) > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5">
              {unreadCount}
            </span>
          )}
        </h2>
        <Link
          to="/messages"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {!recentMessages || recentMessages.length === 0 ? (
        <div className="border border-dashed border-primary/20 rounded-lg p-6 bg-primary/[0.02]">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground font-body mb-1">
                Connect with creators
              </p>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                Message collaborators, send quotes, and manage inquiries.
              </p>
            </div>
          </div>
          <Link to="/messages" className="btn-editorial text-xs">
            Open Inbox <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {recentMessages.map((msg) => {
            const sender = senderMap.get(msg.sender_id);
            return (
              <Link
                key={msg.id}
                to="/messages"
                className="flex items-center gap-3 bg-card p-4 hover:bg-muted/50 transition-colors group"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {sender?.avatar_url ? (
                    <img
                      src={sender.avatar_url}
                      alt=""
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate font-body">
                      {sender?.display_name || "Creator"}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-body">
                      {format(new Date(msg.created_at), "MMM d")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate font-body mt-0.5">
                    {msg.content}
                  </p>
                </div>
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </motion.section>
  );

  const sectionMap: Record<string, () => JSX.Element> = {
    projects: renderProjectsSection,
    events: renderEventsSection,
    messages: renderMessagesSection,
  };

  const visibleSections = sectionOrder.filter((s) => !hiddenSections.includes(s));

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-12">
      {/* ─── Greeting strip ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pt-2"
      >
        <p className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-2">
          {user ? "Your Spaces" : "Welcome to Rhozeland"}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-[1.1]">
          {user ? (
            <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
              {greeting()}, {firstName}.
            </span>
          ) : (
            <>
              <span className="text-foreground">Two networks. </span>
              <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
                One creative space.
              </span>
            </>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl">
          {user
            ? activeProjects > 0
              ? `${activeProjects} active project${activeProjects > 1 ? "s" : ""}${
                  (unreadCount ?? 0) > 0
                    ? ` · ${unreadCount} unread`
                    : ""
                }.`
              : "Open a Space, tune into the Hub, or start a new project."
            : "Step into Spaces or tune into the Hub."}
        </p>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════
          ACT 1 — Split-screen duo + shared search
          Studios on the left (physical), Hub on the right (digital).
          Equal weight. Mirrored language. Shared search above.
          ════════════════════════════════════════════════════════════════ */}
      <section>
        <form onSubmit={handleNetworkSearch} className="relative max-w-2xl mx-auto mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={networkSearch}
            onChange={(e) => setNetworkSearch(e.target.value)}
            placeholder="Search Spaces — studios, people, offerings, works…"
            className="pl-11 h-12 rounded-full bg-card/60 backdrop-blur border-border/60"
          />
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* STUDIO SPACES — physical */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/studios"
              className="group block relative overflow-hidden rounded-3xl border border-border/60 bg-card aspect-[4/5] sm:aspect-[5/4] md:aspect-[4/5]"
            >
              {/* Iridescent backdrop */}
              <div className="absolute inset-0 opacity-80">
                <div
                  className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%]"
                  style={{
                    background: `
                      radial-gradient(ellipse 50% 40% at 30% 30%, hsl(220 70% 50% / 0.35) 0%, transparent 70%),
                      radial-gradient(ellipse 40% 50% at 70% 70%, hsl(180 60% 45% / 0.3) 0%, transparent 70%)
                    `,
                  }}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />

              {/* Content */}
              <div className="relative h-full flex flex-col p-6 sm:p-8">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2.5 py-1 mb-4">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest text-foreground font-medium">
                      Physical Network
                    </span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-none mb-2">
                    Studio
                    <br />
                    Spaces
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    Step in. Real rooms, real gear, vetted hosts. Book by the hour or the day.
                  </p>
                </div>

                {/* Live previews — first 3 studio thumbnails */}
                <div className="flex -space-x-3 mb-4">
                  {(studios ?? []).slice(0, 4).map((s: any) => (
                    <div
                      key={s.id}
                      className="h-12 w-12 rounded-2xl border-2 border-background overflow-hidden bg-muted"
                    >
                      {s.cover_image_url || s.hero_image_url ? (
                        <img
                          src={s.cover_image_url ?? s.hero_image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {(studios?.length ?? 0) > 4 && (
                    <div className="h-12 w-12 rounded-2xl border-2 border-background bg-card flex items-center justify-center text-xs font-semibold">
                      +{(studios?.length ?? 0) - 4}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {studios?.length ?? 0} space{(studios?.length ?? 0) === 1 ? "" : "s"} bookable
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground group-hover:gap-2 transition-all">
                    Step in <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* HUB — digital */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Link
              to="/hub"
              className="group block relative overflow-hidden rounded-3xl border border-border/60 bg-card aspect-[4/5] sm:aspect-[5/4] md:aspect-[4/5]"
            >
              <div className="absolute inset-0 opacity-80">
                <div
                  className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%]"
                  style={{
                    background: `
                      radial-gradient(ellipse 50% 40% at 70% 30%, hsl(320 80% 60% / 0.35) 0%, transparent 70%),
                      radial-gradient(ellipse 40% 50% at 30% 70%, hsl(30 90% 55% / 0.3) 0%, transparent 70%)
                    `,
                  }}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />

              <div className="relative h-full flex flex-col p-6 sm:p-8">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2.5 py-1 mb-4">
                    <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest text-foreground font-medium">
                      Digital Network
                    </span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-none mb-2">
                    The
                    <br />
                    Hub
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    Tune in. Conversations, offerings, opportunities, and verified Works — the
                    pulse of the community.
                  </p>
                </div>

                <div className="flex -space-x-3 mb-4">
                  {(people ?? []).slice(0, 4).map((p: any) => (
                    <div
                      key={p.user_id}
                      className="h-12 w-12 rounded-full border-2 border-background overflow-hidden bg-muted"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs font-bold">
                          {(p.display_name || p.username || "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                  {(people?.length ?? 0) > 4 && (
                    <div className="h-12 w-12 rounded-full border-2 border-background bg-card flex items-center justify-center text-xs font-semibold">
                      +{(people?.length ?? 0) - 4}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {people?.length ?? 0} creator{(people?.length ?? 0) === 1 ? "" : "s"} active
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground group-hover:gap-2 transition-all">
                    Tune in <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Caption: how Spaces lead into Projects */}
        <p className="text-center text-xs text-muted-foreground/70 mt-4 italic">
          Both networks lead to{" "}
          <Link to="/projects" className="text-foreground hover:underline not-italic font-medium">
            Projects
          </Link>{" "}
          — the work that happens once you're inside a space.
        </p>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          ACT 2 — Cinematic stacked previews
          Two full-width editorial blocks. One per network.
          ════════════════════════════════════════════════════════════════ */}
      {(() => {
        const studiosWithImages = (studios ?? []).filter(
          (s: any) => s.cover_image_url || s.hero_image_url,
        );
        if (studiosWithImages.length === 0) return null;
        return (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">
                Spaces near you
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                Studios accepting bookings
              </h2>
            </div>
            <Link
              to="/studios"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors"
            >
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {studiosWithImages.slice(0, 4).map((s: any, i: number) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to={`/studios/${s.id}`}
                  className="group block aspect-[4/5] rounded-2xl overflow-hidden border border-border/50 bg-muted relative"
                >
                  <img
                    src={s.cover_image_url ?? s.hero_image_url}
                    alt={s.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    {s.city && (
                      <p className="text-[10px] text-white/70 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {s.city}
                      </p>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
        );
      })()}

      {(() => {
        const listingsWithImages = (hubListings ?? []).filter(
          (l: any) => l.cover_url || l.image_url,
        );
        if (listingsWithImages.length === 0) return null;
        return (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">
                What's moving in the Hub
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                Fresh offerings & conversations
              </h2>
            </div>
            <Link
              to="/hub"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors"
            >
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {listingsWithImages.slice(0, 6).map((l: any, i: number) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/marketplace/${l.id}`}
                  className="group block aspect-[4/3] rounded-2xl overflow-hidden border border-border/50 bg-muted relative"
                >
                  <img
                    src={l.cover_url ?? l.image_url}
                    alt={l.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                    <p className="text-[10px] uppercase tracking-wider text-white/70 mb-0.5">
                      {l.category}
                    </p>
                    <p className="text-sm font-semibold text-white truncate">{l.title}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════
          ACT 3 — Unified pulse feed (toggle: All / Studios / Hub)
          ════════════════════════════════════════════════════════════════ */}
      {pulseItems.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">
                Live across both networks
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <Flame className="h-6 w-6 text-primary" />
                The Pulse
              </h2>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-card border border-border/60 p-1">
              {(["all", "studios", "hub"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setPulseScope(scope)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider transition-all ${
                    pulseScope === scope
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {scope === "all" ? "All" : scope === "studios" ? "Studios" : "Hub"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pulseItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={item.href}
                    className="group block rounded-2xl border border-border/60 bg-card hover:border-foreground/30 transition-all overflow-hidden"
                  >
                    <div className="aspect-video bg-muted relative">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      <span
                        className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur ${
                          item.kind === "studio"
                            ? "bg-blue-500/90 text-white"
                            : "bg-pink-500/90 text-white"
                        }`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {item.kind === "studio" ? "Studio" : "Hub"}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ACT 4 — Map-meets-grid: physical locations + digital faces
          (Lightweight: location list now, real map can be plugged in later
          via Mapbox/Maplibre without changing this component's contract.)
          ════════════════════════════════════════════════════════════════ */}
      {((studios ?? []).length > 0 || (people ?? []).length > 0) && (
        <section>
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">
              Where & who
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Spaces by city · People in the Hub
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: cities list (acts as a stand-in for a map) */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold text-foreground">Cities with studios</span>
              </div>
              <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
                {Object.entries(
                  (studios ?? []).reduce<Record<string, any[]>>((acc, s: any) => {
                    const key = s.city || "Other";
                    (acc[key] ??= []).push(s);
                    return acc;
                  }, {}),
                ).map(([city, list]) => (
                  <Link
                    key={city}
                    to={`/studios?city=${encodeURIComponent(city)}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{city}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {list.length} space{list.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: people grid */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-pink-500" />
                  <span className="text-sm font-semibold text-foreground">In the Hub</span>
                </div>
                <Link
                  to="/hub"
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  See all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3">
                {(people ?? []).slice(0, 8).map((p: any) => (
                  <Link
                    key={p.user_id}
                    to={`/profiles/${p.user_id}`}
                    className="flex flex-col items-center text-center p-2 rounded-xl hover:bg-muted/50 transition-colors group"
                  >
                    <div className="h-12 w-12 rounded-full bg-muted overflow-hidden mb-1.5 group-hover:ring-2 group-hover:ring-pink-500/40 transition-all">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs font-bold">
                          {(p.display_name || p.username || "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-medium text-foreground line-clamp-1 w-full">
                      {p.display_name || p.username || "Anon"}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Guests stop here (preview shown above already covers the personal view) */}
      {!user && <GuestDashboardPreview />}

      {/* ─── Personal stat strip + sections (auth only) ─────────────── */}
      {user && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-border rounded-lg overflow-hidden">
            {[
              {
                icon: FolderKanban,
                label: "Active Projects",
                value: activeProjects,
                path: "/projects",
              },
              {
                icon: MessageSquare,
                label: "Unread Messages",
                value: unreadCount ?? 0,
                path: "/messages",
              },
              {
                icon: Calendar,
                label: "Upcoming Events",
                value: events?.length ?? 0,
                path: "/calendar",
              },
              {
                icon: Zap,
                label: "Tasks Completed",
                value: `${completedTasks}/${totalTasks}`,
                path: "/projects",
              },
            ].map((stat, i) => (
              <Link key={stat.label} to={stat.path}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.05 * i }}
                  className="bg-card p-6 hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <stat.icon className="h-5 w-5 text-muted-foreground mb-4 group-hover:text-foreground transition-colors" />
                  <p className="font-display text-3xl text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-body">{stat.label}</p>
                </motion.div>
              </Link>
            ))}
          </div>

          {/* Studio sessions */}
          {studioBookings && studioBookings.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl text-foreground">Upcoming Sessions</h2>
                <Link
                  to="/studios"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1px] bg-border rounded-lg overflow-hidden">
                {studioBookings.map((booking: any) => (
                  <Link
                    key={booking.id}
                    to={`/studios/${booking.studio_id}`}
                    className="bg-card p-5 hover:bg-muted/50 transition-colors group"
                  >
                    <Building2 className="h-5 w-5 text-muted-foreground mb-3" />
                    <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate font-body">
                      {booking.studios?.name || "Studio"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-body">
                      <Clock className="h-3 w-3" />
                      {format(new Date(booking.start_time), "MMM d · h:mm a")}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Customizer toggle */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowCustomizer(!showCustomizer)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-body transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Customize sections
            </button>
          </div>

          <AnimatePresence>
            {showCustomizer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-lg border border-border bg-card overflow-hidden"
              >
                <p className="text-sm font-medium text-foreground mb-1 font-body">
                  Customize personal sections
                </p>
                <p className="text-xs text-muted-foreground mb-4 font-body">
                  Drag to reorder · Toggle visibility
                </p>
                <Reorder.Group
                  axis="y"
                  values={sectionOrder}
                  onReorder={handleReorder}
                  className="space-y-2"
                >
                  {sectionOrder.map((section) => {
                    const meta = SECTION_META[section];
                    if (!meta) return null;
                    const isHidden = hiddenSections.includes(section);
                    const SectionIcon = meta.icon;
                    return (
                      <Reorder.Item
                        key={section}
                        value={section}
                        className="flex items-center gap-3 p-3 rounded-md border border-border bg-background cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <SectionIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-body font-medium text-foreground flex-1">
                          {meta.label}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSection(section);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {visibleSections.map((key) => sectionMap[key]?.())}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
