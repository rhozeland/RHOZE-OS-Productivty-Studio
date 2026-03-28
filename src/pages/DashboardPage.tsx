import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  FolderKanban,
  Calendar,
  MessageSquare,
  Plus,
  ArrowRight,
  Building2,
  Palette,
  Clock,
  Zap,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-24">
      {/* Hero greeting with gradient card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-8 md:p-10"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 mb-3"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Your Workspace</span>
          </motion.div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
            {greeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg">
            {activeProjects > 0
              ? `You have ${activeProjects} active project${activeProjects > 1 ? "s" : ""}`
              : "Start by creating a project or booking a studio"}
            {(unreadCount ?? 0) > 0 && ` · ${unreadCount} unread message${(unreadCount ?? 0) > 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-3 mt-6 flex-wrap">
            <Link to="/projects">
              <Button className="rounded-full gap-2 shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" /> New Project
              </Button>
            </Link>
            <Link to="/studios">
              <Button variant="secondary" className="rounded-full gap-2 glass">
                <Building2 className="h-4 w-4" /> Book a Studio
              </Button>
            </Link>
            <Link to="/creators">
              <Button variant="secondary" className="rounded-full gap-2 glass">
                <Palette className="h-4 w-4" /> Creators Hub
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Visual action cards — large, image-forward */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: FolderKanban, label: "Projects", value: activeProjects, sub: "Active", path: "/projects", color: "from-primary/20 to-primary/5" },
          { icon: MessageSquare, label: "Messages", value: unreadCount ?? 0, sub: "Unread", path: "/messages", color: "from-blue/20 to-blue/5" },
          { icon: Calendar, label: "Events", value: events?.length ?? 0, sub: "Upcoming", path: "/calendar", color: "from-warm/20 to-warm/5" },
          { icon: Zap, label: "Tasks", value: `${completedTasks}/${totalTasks}`, sub: "Done", path: "/projects", color: "from-pink/20 to-pink/5" },
        ].map((stat, i) => (
          <Link key={stat.label} to={stat.path}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -2, scale: 1.02 }}
              className={cn(
                "relative overflow-hidden rounded-2xl p-5 border border-border/50 cursor-pointer transition-shadow hover:shadow-lg",
                `bg-gradient-to-br ${stat.color}`
              )}
            >
              <stat.icon className="h-7 w-7 text-foreground/70 mb-4" />
              <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub} {stat.label}</p>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Studio sessions spotlight */}
      {studioBookings && studioBookings.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Upcoming Sessions
            </h2>
            <Link to="/studios" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {studioBookings.map((booking: any, i: number) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.05 }}
              >
                <Link
                  to={`/studios/${booking.studio_id}`}
                  className="block rounded-2xl overflow-hidden border border-border/50 hover:shadow-lg transition-all group"
                >
                  <div className="h-24 bg-gradient-to-br from-primary/20 via-accent/10 to-muted flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-primary/40" />
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {booking.studios?.name || "Studio"}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(booking.start_time), "MMM d · h:mm a")}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Projects & Events — side by side, visual cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Recent Projects</h2>
            <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {projects?.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No projects yet</p>
              <Link to="/projects">
                <Button size="sm" className="rounded-full">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Start a Project
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {projects?.slice(0, 4).map((project, i) => {
                const progress = getProjectProgress(project.id);
                const teamCount = (collabCounts.get(project.id) || 0) + 1;
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.05 }}
                  >
                    <Link
                      to={`/projects/${project.id}`}
                      className="flex items-center gap-4 rounded-2xl bg-card border border-border/50 p-4 hover:shadow-md hover:border-primary/20 transition-all group"
                    >
                      <div
                        className="h-12 w-12 rounded-xl shrink-0 flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${project.cover_color ?? "hsl(var(--primary))"}, ${project.cover_color ?? "hsl(var(--primary))"}88)`,
                        }}
                      >
                        <FolderKanban className="h-5 w-5 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {project.title}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary capitalize shrink-0">
                            {project.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">{progress}%</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {teamCount} {teamCount === 1 ? "member" : "members"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Upcoming Events */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Upcoming Events</h2>
            <Link to="/calendar" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {events?.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No events scheduled</p>
              <Link to="/calendar">
                <Button size="sm" variant="outline" className="rounded-full">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Event
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {events?.slice(0, 4).map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-center gap-4 rounded-2xl bg-card border border-border/50 p-4"
                >
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: event.color ?? "hsl(var(--primary))" }}
                  >
                    {format(new Date(event.start_time), "dd")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {format(new Date(event.start_time), "EEEE, MMM d · h:mm a")}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* Discover section — visual cards */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Discover
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/studios" className="group">
            <motion.div
              whileHover={{ y: -3 }}
              className="relative overflow-hidden rounded-2xl border border-border/50 h-40 flex flex-col justify-end p-5 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent hover:shadow-xl transition-all"
            >
              <Building2 className="absolute top-4 right-4 h-8 w-8 text-primary/20" />
              <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors">
                Book a Studio
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Creative spaces by the hour</p>
            </motion.div>
          </Link>
          <Link to="/creators" className="group">
            <motion.div
              whileHover={{ y: -3 }}
              className="relative overflow-hidden rounded-2xl border border-border/50 h-40 flex flex-col justify-end p-5 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent hover:shadow-xl transition-all"
            >
              <Palette className="absolute top-4 right-4 h-8 w-8 text-accent/30" />
              <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors">
                Hire Creatives
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Freelance talent for your projects</p>
            </motion.div>
          </Link>
          <Link to="/flow" className="group">
            <motion.div
              whileHover={{ y: -3 }}
              className="relative overflow-hidden rounded-2xl border border-border/50 h-40 flex flex-col justify-end p-5 bg-gradient-to-br from-warm/15 via-warm/5 to-transparent hover:shadow-xl transition-all"
            >
              <Zap className="absolute top-4 right-4 h-8 w-8 text-warm/30" />
              <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors">
                Flow Mode
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Discover and save inspiration</p>
            </motion.div>
          </Link>
        </div>
      </motion.section>
    </div>
  );
};

export default DashboardPage;
