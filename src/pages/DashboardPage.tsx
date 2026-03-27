import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  FolderKanban,
  Calendar,
  CheckSquare,
  MessageSquare,
  Plus,
  ArrowRight,
  Store,
  Clock,
  Building2,
  Palette,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

const DashboardPage = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {activeProjects > 0
              ? `You have ${activeProjects} active project${activeProjects > 1 ? "s" : ""}`
              : "No active projects yet"}
            {(unreadCount ?? 0) > 0 && ` · ${unreadCount} unread message${(unreadCount ?? 0) > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/projects">
            <Button size="sm" className="rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </Link>
          <Link to="/studios">
            <Button size="sm" variant="outline" className="rounded-full gap-1.5">
              <Building2 className="h-4 w-4" /> Find a Studio
            </Button>
          </Link>
          <Link to="/creators">
            <Button size="sm" variant="outline" className="rounded-full gap-1.5">
              <Palette className="h-4 w-4" /> Hire Talent
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: FolderKanban, label: "Active Projects", value: activeProjects, path: "/projects" },
          { icon: CheckSquare, label: "Tasks Done", value: `${completedTasks}/${totalTasks}`, path: "/projects" },
          { icon: Calendar, label: "Upcoming Events", value: events?.length ?? 0, path: "/calendar" },
          { icon: MessageSquare, label: "Messages", value: unreadCount ?? 0, path: "/messages" },
        ].map((stat, i) => (
          <Link key={stat.label} to={stat.path}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-xl bg-card border border-border px-4 py-3.5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
            >
              <stat.icon className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-display text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Studio bookings banner */}
      {studioBookings && studioBookings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Upcoming Studio Sessions
            </h2>
            <Link to="/studios" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {studioBookings.map((booking: any) => (
              <Link
                key={booking.id}
                to={`/studios/${booking.studio_id}`}
                className="flex items-center gap-3 rounded-xl bg-card/80 backdrop-blur-sm p-3 hover:bg-card transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {(booking as any).studios?.name || "Studio"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(booking.start_time), "MMM d · h:mm a")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent projects & events */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Projects */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="surface-card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">Recent Projects</h2>
            <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {projects?.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No projects yet</p>
              <Link to="/projects">
                <Button size="sm" className="rounded-full">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Your First Project
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {projects?.slice(0, 5).map((project) => {
                const progress = getProjectProgress(project.id);
                const teamCount = (collabCounts.get(project.id) || 0) + 1;
                return (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5 hover:bg-muted/70 transition-colors group"
                  >
                    <div
                      className="h-10 w-1 rounded-full shrink-0"
                      style={{ backgroundColor: project.cover_color ?? "hsl(var(--primary))" }}
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {project.title}
                        </p>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize shrink-0">
                          {project.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground shrink-0">{progress}%</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {teamCount} {teamCount === 1 ? "person" : "people"}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Events */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="surface-card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">Upcoming Events</h2>
            <Link to="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {events?.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">No events yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">Plan your week and stay on track</p>
              </div>
              <Link to="/calendar">
                <Button size="sm" variant="outline" className="rounded-full">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Event
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {events?.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3.5">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: event.color ?? "hsl(var(--primary))" }}
                  >
                    {format(new Date(event.start_time), "dd")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(event.start_time), "MMM d · h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/studios" className="group">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl bg-card border border-border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Building2 className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-display font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Find a Studio</h3>
            <p className="text-xs text-muted-foreground">Browse and book creative spaces by the hour.</p>
          </motion.div>
        </Link>
        <Link to="/creators" className="group">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl bg-card border border-border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Palette className="h-8 w-8 text-accent-foreground mb-3" />
            <h3 className="font-display font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Hire Talent</h3>
            <p className="text-xs text-muted-foreground">Discover freelance creatives for your projects.</p>
          </motion.div>
        </Link>
        <Link to="/flow" className="group">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl bg-card border border-border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Zap className="h-8 w-8 text-warm mb-3" />
            <h3 className="font-display font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Flow Mode</h3>
            <p className="text-xs text-muted-foreground">Discover and save creative inspiration.</p>
          </motion.div>
        </Link>
      </div>
    </div>
  );
};

export default DashboardPage;
