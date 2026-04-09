import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
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
  Sparkles,
  Shield,
  TrendingUp,
  Repeat,
  Zap,
  Award,
  Link as LinkIcon,
  PieChart,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const FEATURES = [
  { icon: Building2, label: "Studios", desc: "Book creative spaces by the hour" },
  { icon: Users, label: "Creators", desc: "Hire freelance talent on the marketplace" },
  { icon: FolderKanban, label: "Projects", desc: "Manage work with milestones & budgets" },
];

/* ── How-it-works steps ── */
const STEPS = [
  {
    num: "01",
    icon: Zap,
    title: "Create & Contribute",
    desc: "Post to Flow, complete milestones, review peers, or join Drop Rooms. Every meaningful action earns $RHOZE credits automatically.",
    accent: "hsl(280 80% 65%)",
  },
  {
    num: "02",
    icon: Award,
    title: "Build Reputation",
    desc: "Each reward generates a Contribution Proof — a tamper-proof record of your work. Anchor it on Solana for a portable, verifiable creative identity.",
    accent: "hsl(175 70% 50%)",
  },
  {
    num: "03",
    icon: Wallet,
    title: "Spend & Unlock",
    desc: "Use $RHOZE to book studios, hire talent, and purchase marketplace offerings. Higher token tiers unlock premium perks and visibility.",
    accent: "hsl(30 90% 60%)",
  },
  {
    num: "04",
    icon: PieChart,
    title: "Revenue Sharing",
    desc: "When your work sells, revenue splits automatically between creator, curator, and a 10% buyback pool that strengthens the ecosystem.",
    accent: "hsl(320 80% 60%)",
  },
];

/* ── Flywheel nodes ── */
const FLYWHEEL_NODES = [
  { icon: Sparkles, label: "Earn", color: "hsl(280 80% 65%)" },
  { icon: Shield, label: "Prove", color: "hsl(175 70% 50%)" },
  { icon: TrendingUp, label: "Grow", color: "hsl(30 90% 60%)" },
  { icon: Repeat, label: "Reinvest", color: "hsl(320 80% 60%)" },
];

const LandingPage = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const flywheelRef = useRef<HTMLDivElement>(null);
  const flywheelInView = useInView(flywheelRef, { once: true, amount: 0.4 });

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
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-body text-lg font-bold tracking-tight text-foreground">
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

      {/* ═══════════ HOW IT WORKS + FLYWHEEL ═══════════ */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.06]"
            style={{
              background: "radial-gradient(circle, hsl(280 80% 65%) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border px-3 py-1 mb-4">
              <Coins className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
                THE $RHOZE ECONOMY
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              How It Works
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              A self-reinforcing ecosystem where creating, proving, and spending power each other forward.
            </p>
          </motion.div>

          {/* Flywheel + Steps layout */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* ── Flywheel ── */}
            <div ref={flywheelRef} className="flex items-center justify-center">
              <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
                {/* Outer ring */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={flywheelInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0 rounded-full border border-border/40"
                />

                {/* Spinning dashed track */}
                <motion.svg
                  viewBox="0 0 320 320"
                  className="absolute inset-0 w-full h-full"
                  initial={{ opacity: 0 }}
                  animate={flywheelInView ? { opacity: 0.3, rotate: 360 } : {}}
                  transition={{
                    opacity: { duration: 0.6 },
                    rotate: { duration: 60, repeat: Infinity, ease: "linear" },
                  }}
                >
                  <circle
                    cx="160"
                    cy="160"
                    r="130"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="8 12"
                    className="text-muted-foreground"
                  />
                </motion.svg>

                {/* Inner glow */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={flywheelInView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="absolute inset-[25%] rounded-full"
                  style={{
                    background: "radial-gradient(circle, hsl(280 80% 65% / 0.08) 0%, transparent 70%)",
                  }}
                />

                {/* Center label */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={flywheelInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.4, duration: 0.5, type: "spring" }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground">$RHOZE</p>
                    <p className="text-[10px] text-muted-foreground tracking-wide">FLYWHEEL</p>
                  </div>
                </motion.div>

                {/* Nodes positioned around the circle */}
                {FLYWHEEL_NODES.map((node, i) => {
                  const angle = (i * 360) / FLYWHEEL_NODES.length - 90;
                  const rad = (angle * Math.PI) / 180;
                  const radius = 42; // percentage from center
                  const x = 50 + radius * Math.cos(rad);
                  const y = 50 + radius * Math.sin(rad);

                  return (
                    <motion.div
                      key={node.label}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={flywheelInView ? { opacity: 1, scale: 1 } : {}}
                      transition={{ delay: 0.2 + i * 0.15, duration: 0.4, type: "spring" }}
                      className="absolute flex flex-col items-center gap-1.5"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div
                        className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center backdrop-blur-sm border border-border/50 shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, ${node.color}20, ${node.color}08)`,
                          boxShadow: `0 4px 20px ${node.color}15`,
                        }}
                      >
                        <node.icon className="h-5 w-5" style={{ color: node.color }} />
                      </div>
                      <span className="text-[10px] font-semibold text-foreground tracking-wide">
                        {node.label}
                      </span>
                    </motion.div>
                  );
                })}

                {/* Animated connecting arcs */}
                <motion.svg
                  viewBox="0 0 320 320"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={flywheelInView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  {FLYWHEEL_NODES.map((node, i) => {
                    const angle1 = (i * 360) / FLYWHEEL_NODES.length - 90;
                    const angle2 = (((i + 1) % FLYWHEEL_NODES.length) * 360) / FLYWHEEL_NODES.length - 90;
                    const r = 134;
                    const cx = 160, cy = 160;
                    const startAngle = angle1 + 18;
                    const endAngle = angle2 - 18;
                    const s = { x: cx + r * Math.cos((startAngle * Math.PI) / 180), y: cy + r * Math.sin((startAngle * Math.PI) / 180) };
                    const e = { x: cx + r * Math.cos((endAngle * Math.PI) / 180), y: cy + r * Math.sin((endAngle * Math.PI) / 180) };
                    return (
                      <path
                        key={i}
                        d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
                        fill="none"
                        stroke={node.color}
                        strokeWidth="1.5"
                        strokeOpacity="0.25"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </motion.svg>
              </div>
            </div>

            {/* ── Step cards ── */}
            <div className="flex flex-col gap-4">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="group relative rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 sm:p-5 hover:border-border transition-all"
                >
                  {/* Accent line */}
                  <div
                    className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full opacity-40 group-hover:opacity-80 transition-opacity"
                    style={{ background: step.accent }}
                  />

                  <div className="flex items-start gap-3.5 pl-3">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border border-border/40"
                      style={{
                        background: `linear-gradient(135deg, ${step.accent}15, ${step.accent}05)`,
                      }}
                    >
                      <step.icon className="h-4 w-4" style={{ color: step.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold tracking-wider"
                          style={{ color: step.accent }}
                        >
                          {step.num}
                        </span>
                        <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bottom connector line */}
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-14 mx-auto max-w-xs h-px bg-gradient-to-r from-transparent via-border to-transparent"
          />

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="text-center mt-8"
          >
            <p className="text-xs text-muted-foreground mb-4">
              Every action fuels the flywheel — the more you create, the more the ecosystem grows.
            </p>
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs">
                {user ? "Go to Dashboard" : "Start Creating"}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </motion.div>
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
