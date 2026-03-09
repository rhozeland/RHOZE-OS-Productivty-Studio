import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Star,
  RefreshCw,
  Network,
  FolderKanban,
  Calendar,
  CheckSquare,
  Zap,
  MessageSquare,
  Layers,
  Compass,
  Settings,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

/* ── Hero variants ─────────────────────────────────────────── */
const heroVariants = [
  {
    tagline: "Let's create something great",
    gradient: "linear-gradient(135deg, hsl(175 50% 85%), hsl(310 50% 90%), hsl(280 40% 92%))",
    gradientDark: "linear-gradient(135deg, hsl(175 40% 15%), hsl(310 30% 18%), hsl(280 25% 15%))",
    blurA: "bg-teal/10",
    blurB: "bg-pink/10",
  },
  {
    tagline: "Time to build something legendary",
    gradient: "linear-gradient(135deg, hsl(45 80% 85%), hsl(30 70% 80%), hsl(350 50% 88%))",
    gradientDark: "linear-gradient(135deg, hsl(45 40% 14%), hsl(30 30% 16%), hsl(350 20% 14%))",
    blurA: "bg-warm/10",
    blurB: "bg-destructive/5",
  },
  {
    tagline: "Your vision, amplified",
    gradient: "linear-gradient(135deg, hsl(210 60% 88%), hsl(260 50% 90%), hsl(175 40% 88%))",
    gradientDark: "linear-gradient(135deg, hsl(210 30% 14%), hsl(260 25% 16%), hsl(175 25% 13%))",
    blurA: "bg-blue/10",
    blurB: "bg-teal/10",
  },
];

/* ── All available quick-link options ──────────────────────── */
const allQuickLinks = [
  { id: "profile", icon: User, label: "MY PROFILE", path: "/profiles" },
  { id: "services", icon: Star, label: "RHOZELAND\nSERVICES", path: "/marketplace" },
  { id: "bookings", icon: RefreshCw, label: "MY BOOKINGS", path: "/bookings" },
  { id: "network", icon: Network, label: "NETWORK", path: "/messages" },
  { id: "projects", icon: FolderKanban, label: "PROJECTS", path: "/projects" },
  { id: "calendar", icon: Calendar, label: "CALENDAR", path: "/calendar" },
  { id: "smartboards", icon: Layers, label: "SMARTBOARDS", path: "/smartboards" },
  { id: "flow", icon: Compass, label: "FLOW MODE", path: "/flow" },
  { id: "messages", icon: MessageSquare, label: "MESSAGES", path: "/messages" },
  { id: "settings", icon: Settings, label: "SETTINGS", path: "/settings" },
];

const DEFAULT_LINKS = ["profile", "services", "bookings", "network"];
const STORAGE_KEY = "dashboard-quick-links";

const getStoredLinks = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_LINKS;
};

/* ── Stat pill ─────────────────────────────────────────────── */
const StatPill = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div className="flex items-center gap-3 rounded-xl bg-card/80 backdrop-blur-sm border border-border px-5 py-3">
    <Icon className="h-5 w-5 text-primary" />
    <div>
      <p className="font-display text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

/* ── Main page ─────────────────────────────────────────────── */
const DashboardPage = () => {
  const { user } = useAuth();

  // Hero rotation — picks variant based on day, cycles every 8s for animation demo
  const [variantIdx, setVariantIdx] = useState(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return dayOfYear % heroVariants.length;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setVariantIdx((i) => (i + 1) % heroVariants.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const currentHero = heroVariants[variantIdx];
  const isDark = document.documentElement.classList.contains("dark");

  // Quick-links customisation
  const [selectedIds, setSelectedIds] = useState<string[]>(getStoredLinks);
  const [editing, setEditing] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

  const startEdit = () => { setDraftIds([...selectedIds]); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => {
    const final = draftIds.length === 0 ? DEFAULT_LINKS : draftIds;
    setSelectedIds(final);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
    setEditing(false);
  };
  const toggleDraft = (id: string) => {
    setDraftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 6 ? [...prev, id] : prev
    );
  };

  const visibleLinks = allQuickLinks.filter((l) => selectedIds.includes(l.id));

  // Data queries
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
  const firstName = user?.email ? user.email.split("@")[0] : "";

  return (
    <div className="space-y-8 -mt-4 -mx-4 md:-mx-8 md:-mt-4">
      {/* ── Animated hero banner ── */}
      <div className="relative overflow-hidden px-6 py-14 md:px-12 md:py-20">
        {/* Animated gradient background */}
        <AnimatePresence mode="wait">
          <motion.div
            key={variantIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{ background: isDark ? currentHero.gradientDark : currentHero.gradient }}
          />
        </AnimatePresence>

        {/* Blur accents */}
        <motion.div
          key={`a-${variantIdx}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5 }}
          className={`absolute top-0 left-1/4 w-64 h-64 rounded-full ${currentHero.blurA} blur-3xl`}
        />
        <motion.div
          key={`b-${variantIdx}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.2 }}
          className={`absolute bottom-0 right-1/4 w-80 h-80 rounded-full ${currentHero.blurB} blur-3xl`}
        />

        {/* Content */}
        <div className="relative z-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="font-display text-3xl md:text-5xl font-bold tracking-tight text-foreground uppercase"
          >
            Digital Studio Dashboard
          </motion.h1>
          <AnimatePresence mode="wait">
            <motion.p
              key={currentHero.tagline}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.6 }}
              className="mt-3 text-muted-foreground text-sm md:text-base"
            >
              Welcome back{firstName ? `, ${firstName}` : ""} — {currentHero.tagline.toLowerCase()}
            </motion.p>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-5">
            {heroVariants.map((_, i) => (
              <button
                key={i}
                onClick={() => setVariantIdx(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === variantIdx ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 space-y-8">
        {/* ── Quick-access cards (customisable) ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Access
            </h2>
            {!editing ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Customize
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Editing picker */}
          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden mb-4"
              >
                <div className="flex flex-wrap gap-2 p-4 rounded-xl bg-muted/50 border border-border">
                  <p className="w-full text-xs text-muted-foreground mb-1">
                    Select up to 6 shortcuts for your dashboard:
                  </p>
                  {allQuickLinks.map((item) => {
                    const active = draftIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleDraft(item.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          active
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-card border-border text-muted-foreground hover:border-primary/20"
                        }`}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                        {item.label.replace("\n", " ")}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cards grid */}
          <div className={`grid gap-4 md:gap-6 ${
            visibleLinks.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
          }`}>
            {visibleLinks.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
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
