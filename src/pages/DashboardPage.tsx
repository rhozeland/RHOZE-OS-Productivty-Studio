import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { FolderKanban, Calendar, CheckSquare, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="surface-card p-6"
  >
    <div className="flex items-center gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  </motion.div>
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
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Welcome back<span className="gradient-text">{user?.email ? `, ${user.email.split("@")[0]}` : ""}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">Here's what's happening in your creative world.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projects" value={projects?.length ?? 0} color="bg-primary/20 text-primary" />
        <StatCard icon={CheckSquare} label="Tasks Done" value={completedTasks} color="bg-accent/20 text-accent" />
        <StatCard icon={Calendar} label="Events" value={events?.length ?? 0} color="bg-warm/20 text-warm" />
        <StatCard icon={Zap} label="Active" value={projects?.filter((p) => p.status === "active").length ?? 0} color="bg-primary/20 text-primary" />
      </div>

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
                <div key={project.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: project.cover_color ?? "#7c3aed" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{project.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{project.status}</p>
                  </div>
                </div>
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
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color ?? "#7c3aed" }} />
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
  );
};

export default DashboardPage;
