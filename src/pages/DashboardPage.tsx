import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, Reorder } from "framer-motion";
import {
  FolderKanban,
  Calendar,
  MessageSquare,
  ArrowRight,
  Building2,
  Palette,
  Clock,
  Zap,
  Settings2,
  GripVertical,
  CalendarDays,
  List,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type DashboardLayout = {
  sections: string[];
  showCalendar: boolean;
};

const DEFAULT_LAYOUT: DashboardLayout = { sections: ["projects", "events"], showCalendar: false };

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

  const [sectionOrder, setSectionOrder] = useState<string[]>(layout.sections);
  const [showCalendar, setShowCalendar] = useState(layout.showCalendar);

  useEffect(() => {
    if (rawLayout) {
      const parsed = typeof rawLayout === "string" ? JSON.parse(rawLayout) : rawLayout;
      setSectionOrder(parsed.sections ?? DEFAULT_LAYOUT.sections);
      setShowCalendar(parsed.showCalendar ?? false);
    }
  }, [rawLayout]);

  const saveLayout = useMutation({
    mutationFn: async (newLayout: DashboardLayout) => {
      await supabase
        .from("profiles")
        .update({ dashboard_layout: newLayout } as any)
        .eq("user_id", user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  const handleReorder = (newOrder: string[]) => {
    setSectionOrder(newOrder);
    saveLayout.mutate({ sections: newOrder, showCalendar });
  };

  const handleCalendarToggle = (val: boolean) => {
    setShowCalendar(val);
    saveLayout.mutate({ sections: sectionOrder, showCalendar: val });
  };

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
  const firstName = profile?.display_name?.split(" ")[0] || user?.email?.split("@")[0] || "";

  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks?.filter((t) => t.project_id === projectId) ?? [];
    if (projectTasks.length === 0) return 0;
    const done = projectTasks.filter((t) => t.completed).length;
    return Math.round((done / projectTasks.length) * 100);
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

  const renderProjectsSection = () => (
    <motion.section
      key="projects"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-foreground">Recent Projects</h2>
        <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {projects?.length === 0 ? (
        <div className="card-dashed p-10 text-center">
          <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground font-body mb-4">No projects yet</p>
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
                    <span className="text-[10px] text-muted-foreground shrink-0 font-body">{progress}%</span>
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
    <motion.section
      key="events"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-foreground">
          {showCalendar ? "Calendar" : "Upcoming Events"}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCalendarToggle(!showCalendar)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors"
          >
            {showCalendar ? <List className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
            {showCalendar ? "List" : "Calendar"}
          </button>
          <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {showCalendar ? (
        /* Mini calendar grid */
        <div className="border border-border rounded-lg bg-card p-4">
          <p className="text-sm font-medium text-foreground mb-3 font-body">
            {format(now, "MMMM yyyy")}
          </p>
          <div className="grid grid-cols-7 gap-0">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="text-[10px] text-muted-foreground text-center py-1 font-body font-medium">
                {d}
              </div>
            ))}
            {calDays.map((day) => {
              const isToday = isSameDay(day, now);
              const dayEvents = allEvents?.filter((e) => isSameDay(new Date(e.start_time), day)) ?? [];
              const isCurrentMonth = day.getMonth() === now.getMonth();

              return (
                <div
                  key={day.toISOString()}
                  className={`relative text-center py-1.5 text-xs font-body cursor-default ${
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"
                  } ${isToday ? "font-bold" : ""}`}
                >
                  <span className={isToday ? "bg-primary text-primary-foreground rounded-full px-1.5 py-0.5" : ""}>
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-accent" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : events?.length === 0 ? (
        <div className="card-dashed p-10 text-center">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground font-body mb-4">No events scheduled</p>
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

  const sectionMap: Record<string, () => JSX.Element> = {
    projects: renderProjectsSection,
    events: renderEventsSection,
  };

  return (
    <div className="max-w-6xl mx-auto pb-24">
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden rounded-lg mb-8"
      >
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
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xs font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-4"
          >
            Your Workspace
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="font-display text-4xl md:text-5xl lg:text-6xl text-foreground leading-[1.1] mb-4"
          >
            {greeting()}{firstName ? `,` : ""}<br />
            {firstName || "Creator"}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed"
          >
            {activeProjects > 0
              ? `You have ${activeProjects} active project${activeProjects > 1 ? "s" : ""}`
              : "Start by creating a project or booking a studio"}
            {(unreadCount ?? 0) > 0 && ` · ${unreadCount} unread message${(unreadCount ?? 0) > 1 ? "s" : ""}`}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 flex-wrap"
          >
            <Link to="/projects" className="btn-editorial">
              New Project <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/studios"
              className="inline-flex items-center gap-3 px-6 py-3 border border-dashed border-foreground/30 text-sm font-medium text-foreground hover:border-foreground transition-colors"
            >
              Book a Studio <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/creators"
              className="inline-flex items-center gap-3 px-6 py-3 border border-dashed border-foreground/30 text-sm font-medium text-foreground hover:border-foreground transition-colors"
            >
              Creators Hub <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-border mb-8 rounded-lg overflow-hidden">
        {[
          { icon: FolderKanban, label: "Active Projects", value: activeProjects, path: "/projects" },
          { icon: MessageSquare, label: "Unread Messages", value: unreadCount ?? 0, path: "/messages" },
          { icon: Calendar, label: "Upcoming Events", value: events?.length ?? 0, path: "/calendar" },
          { icon: Zap, label: "Tasks Completed", value: `${completedTasks}/${totalTasks}`, path: "/projects" },
        ].map((stat, i) => (
          <Link key={stat.label} to={stat.path}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
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
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-foreground">Upcoming Sessions</h2>
            <Link to="/studios" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-body transition-colors">
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
        </motion.section>
      )}

      {/* Customizable sections header */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={() => setShowCustomizer(!showCustomizer)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-body transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Customize
        </button>
      </div>

      {/* Customizer panel */}
      {showCustomizer && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 p-4 rounded-lg border border-border bg-card"
        >
          <p className="text-sm font-medium text-foreground mb-3 font-body">Drag to reorder sections</p>
          <Reorder.Group axis="y" values={sectionOrder} onReorder={handleReorder} className="space-y-2">
            {sectionOrder.map((section) => (
              <Reorder.Item
                key={section}
                value={section}
                className="flex items-center gap-3 p-3 rounded-md border border-border bg-background cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-body font-medium text-foreground capitalize">{section}</span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </motion.div>
      )}

      {/* Projects & Events — reorderable side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {sectionOrder.map((key) => sectionMap[key]?.())}
      </div>
    </div>
  );
};

export default DashboardPage;
