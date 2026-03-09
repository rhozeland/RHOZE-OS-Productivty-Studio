import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  User,
  Star,
  RefreshCw,
  Network,
  FolderKanban,
  Calendar,
  CheckSquare,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

const quickLinks = [
  { icon: User, label: "MY PROFILE", path: "/profiles", delay: 0 },
  { icon: CalendarStar, label: "RHOZELAND\nSERVICES", path: "/marketplace", delay: 0.05 },
  { icon: RefreshCw, label: "MY BOOKINGS", path: "/calendar", delay: 0.1 },
  { icon: Network, label: "NETWORK", path: "/messages", delay: 0.15 },
];

const StatPill = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div className="flex items-center gap-3 rounded-xl bg-card/80 backdrop-blur-sm border border-border px-5 py-3">
    <Icon className="h-5 w-5 text-primary" />
    <div>
      <p className="font-display text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
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
      const { data } = await supabase.from("calendar_events").select("*");
      return data ?? [];
    },
  });

  const completedTasks = tasks?.filter((t) => t.completed).length ?? 0;

  return (
    <div className="space-y-8 -mt-4 -mx-4 md:-mx-8 md:-mt-4">
      {/* Hero gradient banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="gradient-hero px-6 py-14 md:px-12 md:py-20 relative overflow-hidden"
      >
        {/* Subtle decorative blur circles */}
        <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-teal/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-pink/10 blur-3xl" />

        <div className="relative z-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="font-display text-3xl md:text-5xl font-bold tracking-tight text-foreground uppercase"
          >
            Digital Studio Dashboard
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-3 text-muted-foreground text-sm md:text-base"
          >
            Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""} — let's create something great
          </motion.p>
        </div>
      </motion.div>

      <div className="px-4 md:px-8 space-y-8">
        {/* Quick-access icon cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {quickLinks.map((item) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: item.delay, duration: 0.4 }}
            >
              <Link
                to={item.path}
                className="group flex flex-col items-center gap-4 rounded-2xl bg-card border border-border p-6 md:p-8 transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary/30"
              >
                <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <item.icon className="h-8 w-8 md:h-10 md:w-10 text-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
                </div>
                <span className="font-display text-xs md:text-sm font-semibold text-foreground uppercase tracking-wider text-center whitespace-pre-line leading-tight">
                  {item.label}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill icon={FolderKanban} label="Projects" value={projects?.length ?? 0} />
          <StatPill icon={CheckSquare} label="Tasks Done" value={completedTasks} />
          <StatPill icon={Calendar} label="Events" value={events?.length ?? 0} />
          <StatPill icon={Zap} label="Active" value={projects?.filter((p) => p.status === "active").length ?? 0} />
        </div>

        {/* Recent projects & events */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Recent Projects</h2>
              <Link to="/projects" className="text-sm text-primary hover:underline">View all</Link>
            </div>
            {projects?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No projects yet. Create your first one!</p>
            ) : (
              <div className="space-y-3">
                {projects?.slice(0, 5).map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 hover:bg-muted transition-colors">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: project.cover_color ?? "hsl(var(--primary))" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{project.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{project.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">Upcoming Events</h2>
              <Link to="/calendar" className="text-sm text-primary hover:underline">View all</Link>
            </div>
            {events?.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events scheduled. Plan your week!</p>
            ) : (
              <div className="space-y-3">
                {events?.slice(0, 5).map((event) => (
                  <div key={event.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color ?? "hsl(var(--primary))" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.start_time).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
