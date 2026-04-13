import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
  ArrowRightLeft,
  RefreshCw,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const FLYWHEEL_NODES = [
  { icon: Sparkles, label: "Create", color: "hsl(150 55% 45%)" },
  { icon: Coins, label: "Earn", color: "hsl(40 80% 50%)" },
  { icon: TrendingUp, label: "Grow", color: "hsl(210 60% 55%)" },
  { icon: Shield, label: "Reputation", color: "hsl(280 60% 60%)" },
  { icon: ArrowRightLeft, label: "Reinvest", color: "hsl(350 60% 55%)" },
];

const FEATURES = [
  { icon: Building2, title: "Book Studios", desc: "Reserve creative spaces by the hour — recording, photo, video." },
  { icon: Users, title: "Hire Talent", desc: "Find and commission freelance creatives on the marketplace." },
  { icon: FolderKanban, title: "Ship Projects", desc: "Manage work with milestones, budgets, and team collaboration." },
];

const LandingPage = () => {
  const { user } = useAuth();
  const flywheelRef = useRef<HTMLDivElement>(null);
  const flywheelInView = useInView(flywheelRef, { once: true, amount: 0.4 });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 max-w-5xl">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-body text-lg font-bold tracking-tight text-foreground">Rhozeland</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" variant="ghost" className="text-sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button size="sm" variant="ghost" className="text-sm">Sign in</Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="text-sm rounded-full gap-1.5">
                    Get Started <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 sm:px-6 relative overflow-hidden">
        {/* Grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
          }}
        />
        {/* Aurora */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }} className="absolute inset-0">
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

        <div className="relative z-10 max-w-4xl mx-auto w-full py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — copy */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/15 px-3 py-1 mb-6">
                <Flame className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-medium text-primary tracking-wide">THE DIGITAL STUDIO</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.1] text-foreground mb-4">
                Productivity
                <br />
                rewarded.
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground max-w-md mb-8 leading-relaxed">
                Book studios. Hire talent. Ship projects.
                <br />
                Every action earns $RHOZE — unlocking exclusive spaces, networking, and more.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Link to="/auth">
                  <Button className="rounded-full h-11 px-6 gap-2 text-sm font-medium">
                    Get Started <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button variant="outline" className="rounded-full h-11 px-6 text-sm">
                    How it works
                  </Button>
                </a>
              </div>
            </motion.div>

            {/* Right — flywheel */}
            <div ref={flywheelRef} className="flex items-center justify-center">
              <div className="relative" style={{ width: 280, height: 280 }}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={flywheelInView ? { opacity: 1, rotate: 360 } : {}}
                  transition={{ opacity: { duration: 0.5, delay: 0.3 }, rotate: { duration: 20, repeat: Infinity, ease: "linear" } }}
                  className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={flywheelInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.5, duration: 0.5, type: "spring" }}
                    className="h-20 w-20 rounded-full bg-primary/10 border border-primary/30 flex flex-col items-center justify-center"
                  >
                    <RefreshCw className="h-6 w-6 text-primary mb-0.5" />
                    <span className="text-[8px] font-bold text-primary tracking-widest uppercase">$RHOZE</span>
                  </motion.div>
                </div>
                {FLYWHEEL_NODES.map((node, i) => {
                  const rad = (i * 72 - 90) * (Math.PI / 180);
                  const r = 115;
                  const x = 140 + r * Math.cos(rad) - 28;
                  const y = 140 + r * Math.sin(rad) - 28;
                  return (
                    <motion.div
                      key={node.label}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={flywheelInView ? { opacity: 1, scale: 1 } : {}}
                      transition={{ delay: 0.7 + i * 0.12, type: "spring", stiffness: 200 }}
                      className="absolute flex flex-col items-center gap-1"
                      style={{ left: x, top: y, width: 56 }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.15 }}
                        className="h-11 w-11 rounded-full flex items-center justify-center shadow-md cursor-default"
                        style={{ backgroundColor: node.color + "22", border: `2px solid ${node.color}` }}
                      >
                        <node.icon className="h-5 w-5" style={{ color: node.color }} />
                      </motion.div>
                      <span className="text-[10px] font-semibold text-foreground whitespace-nowrap text-center">{node.label}</span>
                    </motion.div>
                  );
                })}
                <motion.svg
                  className="absolute inset-0"
                  viewBox="0 0 280 280"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={flywheelInView ? { opacity: 1 } : {}}
                  transition={{ delay: 1.2, duration: 0.5 }}
                >
                  {FLYWHEEL_NODES.map((node, i) => {
                    const angle = i * 72;
                    const rad1 = (angle - 90) * (Math.PI / 180);
                    const rad2 = (angle + 72 - 90) * (Math.PI / 180);
                    const r = 90;
                    const x1 = 140 + r * Math.cos(rad1);
                    const y1 = 140 + r * Math.sin(rad1);
                    const x2 = 140 + r * Math.cos(rad2);
                    const y2 = 140 + r * Math.sin(rad2);
                    const midAngle = (angle + 36 - 90) * (Math.PI / 180);
                    const cx = 140 + (r + 20) * Math.cos(midAngle);
                    const cy = 140 + (r + 20) * Math.sin(midAngle);
                    return (
                      <motion.path
                        key={i}
                        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                        stroke={node.color}
                        strokeWidth="1.5"
                        strokeOpacity="0.25"
                        strokeDasharray="4 3"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={flywheelInView ? { pathLength: 1 } : {}}
                        transition={{ delay: 1.2 + i * 0.15, duration: 0.5 }}
                      />
                    );
                  })}
                </motion.svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works strip */}
      <section id="how-it-works" className="border-t border-border bg-card/50 px-4 sm:px-6 py-14">
        <div className="max-w-4xl mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-widest text-muted-foreground/50 text-center mb-8"
          >
            What you can do
          </motion.p>

          <div className="grid sm:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-sm p-6 hover:border-border transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center mt-10"
          >
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs">
                {user ? "Go to Dashboard" : "Start Creating"} <ArrowRight className="h-3 w-3" />
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
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
