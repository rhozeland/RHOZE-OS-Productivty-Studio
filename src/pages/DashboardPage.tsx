import { useState, useEffect } from "react";
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
  CalendarDays,
  List,
  Flame,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  User,
  ShoppingBag,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from "date-fns";

type DashboardLayout = {
  sections: string[];
  hiddenSections: string[];
  showCalendar: boolean;
};

const ALL_SECTIONS = ["projects", "events", "hub", "messages"];

const SECTION_META: Record<string, { label: string; icon: any }> = {
  projects: { label: "Projects", icon: FolderKanban },
  events: { label: "Schedule", icon: Calendar },
  hub: { label: "Hub Feed", icon: Flame },
  messages: { label: "Messages", icon: MessageSquare },
};

const DEFAULT_LAYOUT: DashboardLayout = {
  sections: ["projects", "events", "hub", "messages"],
  hiddenSections: [],
  showCalendar: false,
};

const DashboardPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCustomizer, setShowCustomizer] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, dashboard_layout")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const rawLayout = (profile as any)?.dashboard_layout;
  const layout: DashboardLayout = rawLayout
    ? { ...DEFAULT_LAYOUT, ...(typeof rawLayout === "string" ? JSON.parse(rawLayout) : rawLayout) }
    : DEFAULT_LAYOUT;

  // Ensure all sections exist in order (for newly added sections)
  const ensuredSections = [
    ...layout.sections.filter((s) => ALL_SECTIONS.includes(s)),
    ...ALL_SECTIONS.filter((s) => !layout.sections.includes(s)),
  ];

  const [sectionOrder, setSectionOrder] = useState<string[]>(ensuredSections);
  const [hiddenSections, setHiddenSections] = useState<string[]>(layout.hiddenSections ?? []);
  const [showCalendar, setShowCalendar] = useState(layout.showCalendar);

  useEffect(() => {
    if (rawLayout) {
      const parsed = typeof rawLayout === "string" ? JSON.parse(rawLayout) : rawLayout;
      const sections = parsed.sections ?? DEFAULT_LAYOUT.sections;
      const ensured = [
        ...sections.filter((s: string) => ALL_SECTIONS.includes(s)),
        ...ALL_SECTIONS.filter((s) => !sections.includes(s)),
      ];
      setSectionOrder(ensured);
      setHiddenSections(parsed.hiddenSections ?? []);
      setShowCalendar(parsed.showCalendar ?? false);
    }
  }, [rawLayout]);

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

  const persistLayout = (order: string[], hidden: string[], cal: boolean) => {
    if (!user) return;
    saveLayout.mutate({ sections: order, hiddenSections: hidden, showCalendar: cal });
  };

  const handleReorder = (newOrder: string[]) => {
    setSectionOrder(newOrder);
    persistLayout(newOrder, hiddenSections, showCalendar);
  };

  const toggleSection = (key: string) => {
    const newHidden = hiddenSections.includes(key)
      ? hiddenSections.filter((s) => s !== key)
      : [...hiddenSections, key];
    setHiddenSections(newHidden);
    persistLayout(sectionOrder, newHidden, showCalendar);
  };

  const handleCalendarToggle = (val: boolean) => {
    setShowCalendar(val);
    persistLayout(sectionOrder, hiddenSections, val);
  };

  // ── Data queries ──
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
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
      const { data } = await supabase.from("calendar_events").select("*").gte("start_time", new Date().toISOString()).order("start_time").limit(5);
      return data ?? [];
    },
  });

  const { data: allEvents } = useQuery({
    queryKey: ["all-month-events"],
    queryFn: async () => {
      const now = new Date();
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_time", startOfMonth(now).toISOString())
        .lte("start_time", endOfMonth(now).toISOString())
        .order("start_time");
      return data ?? [];
    },
  });

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-messages-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("receiver_id", user!.id).eq("read", false);
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
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
      return data ?? [];
    },
    enabled: !!recentMessages && recentMessages.length > 0,
  });

  const senderMap = new Map(messageSenders?.map((p) => [p.user_id, p]) ?? []);

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

  const { data: hubListings } = useQuery({
    queryKey: ["hub-feed-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("id, title, category, listing_type, credits_price, cover_url, image_url, user_id")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: hubProfiles } = useQuery({
    queryKey: ["hub-feed-profiles", hubListings?.map((l) => l.user_id)],
    queryFn: async () => {
      const ids = [...new Set(hubListings!.map((l) => l.user_id))];
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
      return data ?? [];
    },
    enabled: !!hubListings && hubListings.length > 0,
  });

  const hubProfileMap = new Map(hubProfiles?.map((p) => [p.user_id, p]) ?? []);

  const { data: collaborators } = useQuery({
    queryKey: ["project-collaborator-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("project_collaborators").select("project_id");
      return data ?? [];
    },
  });

  const collabCounts = new Map<string, number>();
  collaborators?.forEach((c) => {
    collabCounts.set(c.project_id, (collabCounts.get(c.project_id) || 0) + 1);
  });

  const completedTasks = tasks?.filter((t) => t.completed).length ?? 0;
  const totalTasks = tasks?.length ?? 0;
  const activeProjects = projects?.filter((p) => p.status === "active").length ?? 0;
  const firstName = profile?.display_name?.split(" ")[0] || (user ? user.email?.split("@")[0] : "") || "";

  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks?.filter((t) => t.project_id === projectId) ?? [];
    if (projectTasks.length === 0) return 0;
    return Math.round((projectTasks.filter((t) => t.completed).length / projectTasks.length) * 100);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  // Mini calendar
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Hub slideshow
  const [hubSlide, setHubSlide] = useState(0);
  const hubCount = hubListings?.length ?? 0;
  const nextSlide = () => setHubSlide((s) => (s + 1) % Math.max(1, hubCount));
  const prevSlide = () => setHubSlide((s) => (s - 1 + Math.max(1, hubCount)) % Math.max(1, hubCount));

  // Auto-advance slideshow
  useEffect(() => {
    if (hubCount <= 1) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [hubCount]);

  const visibleSections = sectionOrder.filter((s) => !hiddenSections.includes(s));

  // ── Section renderers ──

  const renderProjectsSection = () => (
    <motion.section key="projects" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-foreground">Recent Projects</h2>
        <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
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
              <p className="text-sm font-semibold text-foreground font-body mb-1">Manage creative work</p>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                Projects let you track milestones, set budgets, and collaborate with your team. Each completed milestone earns $RHOZE credits.
              </p>
            </div>
          </div>
          <Link to="/projects" className="btn-editorial text-xs">Start a Project <ArrowRight className="h-3 w-3" /></Link>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {projects?.slice(0, 4).map((project) => {
            const progress = getProjectProgress(project.id);
            const teamCount = (collabCounts.get(project.id) || 0) + 1;
            return (
              <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center gap-4 bg-card p-4 hover:bg-muted/50 transition-colors group">
                <div className="h-10 w-10 rounded-md shrink-0 flex items-center justify-center" style={{ background: project.cover_color ?? "hsl(var(--muted))" }}>
                  <FolderKanban className="h-4 w-4 text-primary-foreground/70" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors font-body">{project.title}</p>
                    <span className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-wider shrink-0">{project.status}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="h-1 flex-1" />
                    <span className="text-[10px] text-muted-foreground shrink-0 font-body">{progress}%</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-body">{teamCount} {teamCount === 1 ? "member" : "members"}</span>
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
        <h2 className="font-display text-xl text-foreground">{showCalendar ? "Calendar" : "Upcoming Events"}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => handleCalendarToggle(!showCalendar)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
            {showCalendar ? <List className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
            {showCalendar ? "List" : "Calendar"}
          </button>
          <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      {showCalendar ? (
        <div className="border border-border rounded-lg bg-card p-4">
          <p className="text-sm font-medium text-foreground mb-3 font-body">{format(now, "MMMM yyyy")}</p>
          <div className="grid grid-cols-7 gap-0">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="text-[10px] text-muted-foreground text-center py-1 font-body font-medium">{d}</div>
            ))}
            {calDays.map((day) => {
              const isToday = isSameDay(day, now);
              const dayEvents = allEvents?.filter((e) => isSameDay(new Date(e.start_time), day)) ?? [];
              const isCurrentMonth = day.getMonth() === now.getMonth();
              return (
                <div key={day.toISOString()} className={`relative text-center py-1.5 text-xs font-body cursor-default ${isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"} ${isToday ? "font-bold" : ""}`}>
                  <span className={isToday ? "bg-primary text-primary-foreground rounded-full px-1.5 py-0.5" : ""}>{format(day, "d")}</span>
                  {dayEvents.length > 0 && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-accent" />}
                </div>
              );
            })}
          </div>
        </div>
      ) : events?.length === 0 ? (
        <div className="border border-dashed border-primary/20 rounded-lg p-6 bg-primary/[0.02]">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground font-body mb-1">Book studio time & schedule sessions</p>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                Use credits to book studios, schedule sessions with collaborators, and manage your creative calendar all in one place.
              </p>
            </div>
          </div>
          <Link to="/calendar" className="btn-editorial text-xs">Create Event <ArrowRight className="h-3 w-3" /></Link>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {events?.slice(0, 4).map((event) => (
            <div key={event.id} className="flex items-center gap-4 bg-card p-4">
              <div className="h-10 w-10 rounded-md flex items-center justify-center text-primary-foreground font-display text-sm shrink-0" style={{ backgroundColor: event.color ?? "hsl(var(--primary))" }}>
                {format(new Date(event.start_time), "dd")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate font-body">{event.title}</p>
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

  const renderHubSection = () => {
    const currentListing = hubListings?.[hubSlide];
    const creatorProfile = currentListing ? hubProfileMap.get(currentListing.user_id) : null;

    return (
      <motion.section key="hub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-foreground">Hub Feed</h2>
          <Link to="/creators" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
            Explore <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {!hubListings || hubListings.length === 0 ? (
          <div className="border border-dashed border-primary/20 rounded-lg p-6 bg-primary/[0.02]">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Flame className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground font-body mb-1">Discover & earn in the Hub</p>
                <p className="text-xs text-muted-foreground font-body leading-relaxed">
                  The Creators Hub is where you post services, find talent, and browse listings. Every interaction — posting, reviewing, curating — earns $RHOZE.
                </p>
              </div>
            </div>
            <Link to="/creators" className="btn-editorial text-xs">Visit Hub <ArrowRight className="h-3 w-3" /></Link>
          </div>
        ) : (
          <div className="relative border border-border rounded-lg bg-card overflow-hidden">
            {/* Slideshow */}
            <div className="relative h-48 sm:h-56 overflow-hidden">
              <AnimatePresence mode="wait">
                {currentListing && (
                  <motion.div
                    key={currentListing.id}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    {(currentListing.cover_url || currentListing.image_url) ? (
                      <img
                        src={currentListing.cover_url || currentListing.image_url || ""}
                        alt={currentListing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-wider bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-0.5">
                          {currentListing.category}
                        </span>
                        {currentListing.credits_price && (
                          <span className="text-[10px] font-body font-bold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
                            {currentListing.credits_price} ◊
                          </span>
                        )}
                      </div>
                      <Link to={`/creators/${currentListing.id}`} className="hover:underline">
                        <h3 className="font-display text-lg font-bold text-foreground leading-snug">{currentListing.title}</h3>
                      </Link>
                      {creatorProfile && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-5 w-5 rounded-full bg-muted overflow-hidden shrink-0">
                            {creatorProfile.avatar_url ? (
                              <img src={creatorProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center"><User className="h-3 w-3 text-muted-foreground" /></div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-body">{creatorProfile.display_name || "Creator"}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Nav arrows */}
              {hubCount > 1 && (
                <>
                  <button onClick={prevSlide} className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors z-10">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={nextSlide} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-background transition-colors z-10">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* Dots */}
            {hubCount > 1 && (
              <div className="flex items-center justify-center gap-1.5 py-3">
                {hubListings?.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setHubSlide(i)}
                    className={`h-1.5 rounded-full transition-all ${i === hubSlide ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </motion.section>
    );
  };

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
        <Link to="/messages" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
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
              <p className="text-sm font-semibold text-foreground font-body mb-1">Connect with creators</p>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                Message collaborators, send quotes, and manage inquiries. Use the Network tab to discover new connections.
              </p>
            </div>
          </div>
          <Link to="/messages" className="btn-editorial text-xs">Open Inbox <ArrowRight className="h-3 w-3" /></Link>
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
                    <img src={sender.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate font-body">{sender?.display_name || "Creator"}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-body">
                      {format(new Date(msg.created_at), "MMM d")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate font-body mt-0.5">{msg.content}</p>
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
    hub: renderHubSection,
    messages: renderMessagesSection,
  };

  return (
    <div className="max-w-6xl mx-auto pb-24">
      {/* Hero section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-lg mb-8">
        <div className="absolute inset-0 grid-overlay pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="iridescent-blob absolute -top-20 -right-20 w-[600px] h-[400px] rounded-full opacity-70"
            style={{
              background: "linear-gradient(135deg, hsl(280, 80%, 70%), hsl(320, 80%, 60%), hsl(30, 90%, 60%), hsl(175, 70%, 50%))",
              filter: "blur(60px)",
            }}
          />
        </div>
        <div className="relative z-10 px-8 py-14 md:px-12 md:py-20">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-xs font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-4">
            {user ? "Your Workspace" : "Welcome to Rhozeland"}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground leading-[1.1] mb-4">
            {user ? (
              <>{greeting()}{firstName ? "," : ""}<br />{firstName || "Creator"}</>
            ) : (
              <>Create. Earn.<br />Build Reputation.</>
            )}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
            {user ? (
              <>
                {activeProjects > 0
                  ? `You have ${activeProjects} active project${activeProjects > 1 ? "s" : ""}`
                  : "Start by creating a project or booking a studio"}
                {(unreadCount ?? 0) > 0 && ` · ${unreadCount} unread message${(unreadCount ?? 0) > 1 ? "s" : ""}`}
              </>
            ) : (
              "Explore studios, browse creative services, and discover talent. Sign up to unlock your full workspace."
            )}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center gap-3 flex-wrap">
            {user ? (
              <>
                <Link to="/projects" className="btn-editorial">New Project <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/studios" className="inline-flex items-center gap-3 px-6 py-3 border border-dashed border-foreground/30 text-sm font-medium text-foreground hover:border-foreground transition-colors">
                  Book a Studio <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/creators" className="inline-flex items-center gap-3 px-6 py-3 border border-dashed border-foreground/30 text-sm font-medium text-foreground hover:border-foreground transition-colors">
                  Creators Hub <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth" className="btn-editorial">Get Started <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/creators" className="inline-flex items-center gap-3 px-6 py-3 border border-dashed border-foreground/30 text-sm font-medium text-foreground hover:border-foreground transition-colors">
                  Browse Creators <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/studios" className="inline-flex items-center gap-3 px-6 py-3 border border-dashed border-foreground/30 text-sm font-medium text-foreground hover:border-foreground transition-colors">
                  Explore Studios <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Stat grid — only for logged-in users */}
      {user && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-border mb-8 rounded-lg overflow-hidden">
          {[
            { icon: FolderKanban, label: "Active Projects", value: activeProjects, path: "/projects" },
            { icon: MessageSquare, label: "Unread Messages", value: unreadCount ?? 0, path: "/messages" },
            { icon: Calendar, label: "Upcoming Events", value: events?.length ?? 0, path: "/calendar" },
            { icon: Zap, label: "Tasks Completed", value: `${completedTasks}/${totalTasks}`, path: "/projects" },
          ].map((stat, i) => (
            <Link key={stat.label} to={stat.path}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }} className="bg-card p-6 hover:bg-muted/50 transition-colors cursor-pointer group">
                <stat.icon className="h-5 w-5 text-muted-foreground mb-4 group-hover:text-foreground transition-colors" />
                <p className="font-display text-3xl text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 font-body">{stat.label}</p>
              </motion.div>
            </Link>
          ))}
        </div>
      )}

      {/* Studio sessions */}
      {studioBookings && studioBookings.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-foreground">Upcoming Sessions</h2>
            <Link to="/studios" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[1px] bg-border rounded-lg overflow-hidden">
            {studioBookings.map((booking: any) => (
              <Link key={booking.id} to={`/studios/${booking.studio_id}`} className="bg-card p-5 hover:bg-muted/50 transition-colors group">
                <Building2 className="h-5 w-5 text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate font-body">{booking.studios?.name || "Studio"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-body">
                  <Clock className="h-3 w-3" />
                  {format(new Date(booking.start_time), "MMM d · h:mm a")}
                </p>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* Customizer toggle */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <button onClick={() => setShowCustomizer(!showCustomizer)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-body transition-colors">
          <Settings2 className="h-3.5 w-3.5" />
          Customize
        </button>
      </div>

      {/* Customizer panel */}
      <AnimatePresence>
        {showCustomizer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 rounded-lg border border-border bg-card overflow-hidden"
          >
            <p className="text-sm font-medium text-foreground mb-1 font-body">Customize Dashboard</p>
            <p className="text-xs text-muted-foreground mb-4 font-body">Drag to reorder · Toggle visibility</p>
            <Reorder.Group axis="y" values={sectionOrder} onReorder={handleReorder} className="space-y-2">
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
                    <span className="text-sm font-body font-medium text-foreground flex-1">{meta.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSection(section); }}
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

      {/* Dynamic sections — 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {visibleSections.map((key) => sectionMap[key]?.())}
      </div>
    </div>
  );
};

export default DashboardPage;
