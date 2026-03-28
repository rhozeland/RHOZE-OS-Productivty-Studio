import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Flame,
  Building2,
  Users,
  FolderKanban,
  Coins,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const FEATURES = [
  { icon: Building2, label: "Studios", desc: "Book creative spaces by the hour" },
  { icon: Users, label: "Creators", desc: "Hire freelance talent on the marketplace" },
  { icon: FolderKanban, label: "Projects", desc: "Manage work with milestones & budgets" },
];

const LandingPage = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % FEATURES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("waitlist" as any)
        .insert({ email: trimmed } as any);
      if (error && error.code === "23505") {
        toast.info("You're already on the list!");
      } else if (error) {
        throw error;
      } else {
        toast.success("You're on the list! We'll be in touch.");
        setEmail("");
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 max-w-5xl">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-7 w-7" />
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              Rhozeland
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" variant="ghost" className="text-sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button size="sm" variant="ghost" className="text-sm">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 sm:px-6 relative overflow-hidden">
        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />

        {/* Animated aurora gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2 }}
            className="absolute inset-0"
          >
            <div
              className="absolute top-[-40%] left-[-20%] w-[140%] h-[180%]"
              style={{
                background: `
                  radial-gradient(ellipse 50% 40% at 20% 50%, hsl(280 80% 70% / 0.25) 0%, transparent 70%),
                  radial-gradient(ellipse 40% 50% at 80% 30%, hsl(320 80% 60% / 0.2) 0%, transparent 70%),
                  radial-gradient(ellipse 45% 35% at 60% 80%, hsl(30 90% 60% / 0.18) 0%, transparent 70%),
                  radial-gradient(ellipse 35% 45% at 30% 20%, hsl(175 70% 50% / 0.15) 0%, transparent 70%)
                `,
                animation: "aurora-drift 20s ease-in-out infinite alternate",
              }}
            />
          </motion.div>
        </div>

        <div className="relative z-10 max-w-lg mx-auto text-center py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/15 px-3 py-1 mb-8">
              <Flame className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-medium text-primary tracking-wide">
                EARLY ACCESS
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.15] text-foreground mb-4">
              Where creatives
              <br />
              build together.
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-sm mx-auto mb-8 leading-relaxed">
              Book studios. Hire talent. Ship projects.
              <br />
              One workspace for your creative team.
            </p>

            {/* Waitlist form */}
            <form
              onSubmit={handleWaitlist}
              className="flex flex-col sm:flex-row items-center gap-2.5 max-w-sm mx-auto mb-4"
            >
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-full text-sm bg-muted/50 border-border px-4 flex-1 w-full"
                maxLength={255}
                disabled={submitting}
              />
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-full h-11 px-6 gap-2 text-sm font-medium shrink-0 w-full sm:w-auto"
              >
                {submitting ? "Joining…" : "Join Waitlist"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>

            <p className="text-[11px] text-muted-foreground/60">
              Early members earn founding badges & bonus $RHOZE.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Feature preview strip */}
      <section className="border-t border-border bg-card/50 px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-widest text-muted-foreground/50 text-center mb-6"
          >
            What's inside
          </motion.p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {FEATURES.map((f, i) => (
              <button
                key={f.label}
                onClick={() => setActiveFeature(i)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
                  activeFeature === i
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            ))}
          </div>

          {/* Preview card */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg shadow-black/5">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
              </div>
              <div className="flex-1 flex justify-center">
                <span className="text-[10px] text-muted-foreground/40">rhozeland.app</span>
              </div>
            </div>

            {/* Screen content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="p-6 sm:p-8 min-h-[220px] flex flex-col"
              >
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {(() => {
                      const Icon = FEATURES[activeFeature].icon;
                      return <Icon className="h-4 w-4" />;
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{FEATURES[activeFeature].label}</p>
                    <p className="text-[11px] text-muted-foreground">{FEATURES[activeFeature].desc}</p>
                  </div>
                </div>

                {/* Skeleton UI per feature */}
                {activeFeature === 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                    {["Recording Studio", "Photo Lab", "Video Suite"].map((name) => (
                      <div key={name} className="rounded-xl bg-muted/40 border border-border/50 p-3 flex flex-col justify-between">
                        <div className="h-12 rounded-lg bg-muted/60 mb-2" />
                        <p className="text-[10px] font-medium text-foreground/60">{name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">$45/hr</p>
                      </div>
                    ))}
                  </div>
                )}
                {activeFeature === 1 && (
                  <div className="flex flex-col gap-2.5 flex-1">
                    {["Graphic Designer", "Mix Engineer", "Photographer"].map((name) => (
                      <div key={name} className="flex items-center gap-3 rounded-xl bg-muted/40 border border-border/50 p-3">
                        <div className="h-9 w-9 rounded-full bg-muted/60 shrink-0" />
                        <div className="flex-1">
                          <p className="text-[11px] font-medium text-foreground/60">{name}</p>
                          <p className="text-[9px] text-muted-foreground">Available now</p>
                        </div>
                        <div className="text-[9px] text-primary font-medium">View →</div>
                      </div>
                    ))}
                  </div>
                )}
                {activeFeature === 2 && (
                  <div className="flex flex-col gap-2 flex-1">
                    {[
                      { title: "Album Cover Design", status: "In Progress", pct: 65 },
                      { title: "Music Video Edit", status: "Review", pct: 90 },
                      { title: "Brand Identity", status: "Planning", pct: 15 },
                    ].map((p) => (
                      <div key={p.title} className="rounded-xl bg-muted/40 border border-border/50 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11px] font-medium text-foreground/60">{p.title}</p>
                          <span className="text-[9px] text-muted-foreground">{p.status}</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/40" style={{ width: `${p.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {FEATURES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveFeature(i)}
                className={`h-1.5 rounded-full transition-all ${
                  activeFeature === i ? "w-4 bg-foreground" : "w-1.5 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* $RHOZE Token */}
      <section className="px-4 sm:px-6 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border px-3 py-1 mb-3">
            <Coins className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">$RHOZE</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Rhozeland is powered by <span className="font-semibold text-foreground">$RHOZE</span> — the token behind every booking, hire, and collaboration on the platform. Earn it by completing work, contributing to the community, and growing your creative reputation.
          </p>
        </div>
      </section>


      <footer className="border-t border-border py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <img src={rhozelandLogo} alt="" className="h-4 w-4 opacity-50" />
            <span className="text-xs text-muted-foreground">© 2026 Rhozeland</span>
          </div>
          <Link
            to="/auth"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
