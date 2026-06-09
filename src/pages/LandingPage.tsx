import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Mic,
  Coins,
  Users,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Music4,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { todayGradient } from "@/lib/rhoze-gradients";
import Tilt3D from "@/components/ui/Tilt3D";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

/**
 * LandingPage — v11 expanded.
 * Same aurora + parallax hero, plus how-it-works steps, feature rows,
 * stats marquee, and footer. Heavier shadows + scroll-in motion throughout.
 */

type PublicProject = {
  id: string;
  title: string;
  vision: string | null;
  cover_color: string | null;
  public_slug: string | null;
  cheer_count: number;
};

const FALLBACK: PublicProject[] = [
  { id: "f1", title: "Midnight Tape — Vol. II", vision: "Lo-fi project tracking from demo to vinyl pressing.", cover_color: "#ec4899", public_slug: null, cheer_count: 142 },
  { id: "f2", title: "Sunroom Sessions", vision: "Living-room studio EP. 6 songs, one room, six weeks.", cover_color: "#8b5cf6", public_slug: null, cheer_count: 88 },
  { id: "f3", title: "Coast Loop", vision: "Field-recording electronica built on a road trip.", cover_color: "#14b8a6", public_slug: null, cheer_count: 211 },
  { id: "f4", title: "Brass & Bytes", vision: "Live horns × modular synth. Studio coin launches at release.", cover_color: "#f59e0b", public_slug: null, cheer_count: 64 },
  { id: "f5", title: "Garden State", vision: "Bedroom indie LP. Backers vote on the closing track.", cover_color: "#22c55e", public_slug: null, cheer_count: 305 },
  { id: "f6", title: "After Hours Radio", vision: "12-episode mixtape series with rotating producers.", cover_color: "#ef4444", public_slug: null, cheer_count: 47 },
];

const ProjectCard = ({ p }: { p: PublicProject }) => (
  <Tilt3D maxTilt={14} className="shrink-0 w-[300px] sm:w-[340px] rounded-2xl">
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-[0_30px_80px_-25px_rgba(0,0,0,0.55)]">
      <div
        className="h-32 w-full relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${p.cover_color ?? "#ec4899"} 0%, hsl(292 84% 60%) 60%, hsl(38 95% 60%) 100%)`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-50 mix-blend-overlay"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 50%), radial-gradient(circle at 70% 70%, rgba(0,0,0,0.25), transparent 55%)",
          }}
        />
      </div>
      <div className="p-4 space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Live release
        </p>
        <h3 className="font-display text-base text-foreground leading-tight line-clamp-1">
          {p.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {p.vision ?? "Building in public on Rhozeland."}
        </p>
        <p className="pt-1 text-[11px] text-muted-foreground">
          ♥ {p.cheer_count} backing
        </p>
      </div>
    </div>
  </Tilt3D>
);

const STEPS = [
  {
    icon: Mic,
    label: "Build",
    title: "Start a release",
    body: "Sketch the roadmap, set milestones, attach the demos. Rhozeland's A&R drafts a plan with you.",
  },
  {
    icon: Users,
    label: "Share",
    title: "Take fans behind the scenes",
    body: "Post studio clips, voice notes, and updates. Subscribers and coin-holders unlock the private feed.",
  },
  {
    icon: Coins,
    label: "Launch",
    title: "Drop the coin",
    body: "Tokenize on pump.fun when you're ready. Fans back the work, you earn from every trade.",
  },
];

const FEATURES = [
  {
    icon: Rocket,
    title: "A&R that ships",
    body: "Voice-brief your idea. Get a milestoned roadmap with realistic budget and timeline in seconds.",
    color: "hsl(330 81% 60%)",
  },
  {
    icon: ShieldCheck,
    title: "Verified IP, on-chain",
    body: "Every track is content-hashed and anchored on Solana. Proof of authorship, built into the upload.",
    color: "hsl(170 60% 55%)",
  },
  {
    icon: TrendingUp,
    title: "Discover Coins in Motion",
    body: "Watch artist coins move in real time. Back the curve early, ride it with the community.",
    color: "hsl(38 95% 60%)",
  },
  {
    icon: Heart,
    title: "Backers, not buyers",
    body: "Fans cheer releases, subscribe monthly, hold the coin. One creator economy, three ways to support.",
    color: "hsl(292 84% 61%)",
  },
];

const STATS = [
  { v: "5 bps", k: "creator reward / trade" },
  { v: "85/15", k: "creator split on subs" },
  { v: "$69k", k: "bonding-curve graduation" },
  { v: "24h", k: "token-holder unlock" },
  { v: "0%", k: "platform fee on cheers" },
];

const FOOTER_COLS = [
  {
    head: "Creators",
    links: [
      ["Why launch a coin", "/why-coin"],
      ["A&R / Label services", "/label-services"],
      ["Verified IP", "/credits?tab=how"],
      ["Creator Pass", "/credits"],
    ],
  },
  {
    head: "Discover",
    links: [
      ["Featured artists", "/discover"],
      ["Marketplace", "/discover"],
      ["Live events", "/discover"],
      ["Releases", "/discover"],
    ],
  },
  {
    head: "Company",
    links: [
      ["Log in", "/auth?mode=signin"],
      ["Sign up", "/auth?mode=signup"],
      ["Concierge", "/concierge"],
    ],
  },
];

const LandingPage = () => {
  const grad = todayGradient();
  const [projects, setProjects] = useState<PublicProject[]>(FALLBACK);

  // Mouse parallax for hero
  const heroRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 60, damping: 18, mass: 0.6 });
  const rotY = useTransform(sx, [-0.5, 0.5], [8, -8]);
  const rotX = useTransform(sy, [-0.5, 0.5], [-6, 6]);
  const orb1X = useTransform(sx, [-0.5, 0.5], [-40, 40]);
  const orb1Y = useTransform(sy, [-0.5, 0.5], [-30, 30]);
  const orb2X = useTransform(sx, [-0.5, 0.5], [50, -50]);
  const orb2Y = useTransform(sy, [-0.5, 0.5], [40, -40]);
  const orb3X = useTransform(sx, [-0.5, 0.5], [-25, 25]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("projects")
      .select("id,title,vision,cover_color,public_slug,cheer_count")
      .eq("is_public", true)
      .order("cheer_count", { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (cancelled) return;
        if (data && data.length >= 3) setProjects(data as PublicProject[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onMouseMove = (e: React.MouseEvent) => {
    const el = heroRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  const marquee = [...projects, ...projects];
  const tickerStats = [...STATS, ...STATS, ...STATS];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* GLOBAL AURORA BACKDROP */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 opacity-90" style={{ background: grad.surface }} />
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
        <div className="aurora-blob aurora-3" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top, transparent 0%, hsl(var(--background) / 0.5) 70%, hsl(var(--background)) 100%)",
          }}
        />
      </div>

      {/* TOP BAR */}
      <header className="relative z-20 flex items-center justify-between px-5 sm:px-10 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8 drop-shadow-[0_4px_16px_rgba(236,72,153,0.4)]" />
          <span className="font-display text-lg font-bold tracking-tight">Rhozeland</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 rounded-full border border-border/50 bg-card/50 backdrop-blur-md px-2 py-1.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.3)]">
          <Link to="/discover" className="px-3.5 py-1.5 text-sm rounded-full hover:bg-foreground/5 transition">Discover</Link>
          <Link to="/discover" className="px-3.5 py-1.5 text-sm rounded-full hover:bg-foreground/5 transition">Marketplace</Link>
          <Link to="/why-coin" className="px-3.5 py-1.5 text-sm rounded-full hover:bg-foreground/5 transition">Why a coin</Link>
          <Link to="/credits" className="px-3.5 py-1.5 text-sm rounded-full hover:bg-foreground/5 transition">Creator Pass</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth?mode=signin">
            <Button variant="ghost" size="sm" className="rounded-full">Log in</Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm" className="rounded-full shadow-[0_10px_30px_-10px_hsl(330_81%_60%/0.6)]">Sign up</Button>
          </Link>
        </div>
      </header>

      {/* HERO with 3D parallax */}
      <section
        ref={heroRef}
        onMouseMove={onMouseMove}
        onMouseLeave={() => { mx.set(0); my.set(0); }}
        className="relative flex items-center justify-center px-5 sm:px-10"
        style={{ minHeight: "70vh", perspective: 1400 }}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-[10%] left-[12%] h-72 w-72 rounded-full blur-3xl opacity-60"
          style={{
            x: orb1X, y: orb1Y,
            background: "radial-gradient(circle, hsl(292 84% 65% / 0.7), transparent 70%)",
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute bottom-[5%] right-[8%] h-80 w-80 rounded-full blur-3xl opacity-50"
          style={{
            x: orb2X, y: orb2Y,
            background: "radial-gradient(circle, hsl(38 95% 60% / 0.55), transparent 70%)",
          }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-[40%] left-[55%] h-60 w-60 rounded-full blur-3xl opacity-40"
          style={{
            x: orb3X,
            background: "radial-gradient(circle, hsl(200 90% 60% / 0.5), transparent 70%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
          className="relative max-w-4xl text-center space-y-6 py-16 will-change-transform"
        >
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md shadow-[0_10px_30px_-15px_rgba(0,0,0,0.4)]"
            style={{ transform: "translateZ(40px)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live releases dropping this week
          </motion.div>

          <h1
            className="font-display text-4xl sm:text-6xl md:text-7xl font-bold leading-[1.05] tracking-tight"
            style={{ transform: "translateZ(60px)" }}
          >
            Where musicians build in public
            <br className="hidden sm:block" />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: grad.text }}
            >
              {" "}and fans back the work.
            </span>
          </h1>
          <p
            className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            style={{ transform: "translateZ(30px)" }}
          >
            Follow a project. Support the roadmap. Back the coin when it launches.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3" style={{ transform: "translateZ(80px)" }}>
            <Link to="/auth?mode=signup">
              <button
                className="group relative inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm sm:text-base font-semibold text-white shadow-[0_20px_50px_-15px_rgba(236,72,153,0.6)] transition-transform hover:scale-[1.04] active:scale-[0.98]"
                style={{ backgroundImage: grad.text }}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background:
                      "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
                  }}
                />
                <span className="relative">Get started free</span>
                <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
            <Link to="/discover">
              <button className="rounded-full border border-border/60 bg-card/60 backdrop-blur-md px-6 py-3.5 text-sm sm:text-base font-semibold hover:bg-card transition shadow-[0_10px_30px_-15px_rgba(0,0,0,0.4)]">
                Explore artists →
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* STATS TICKER */}
      <section className="relative py-6 border-y border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
        <div
          className="flex gap-12 whitespace-nowrap"
          style={{ width: "max-content", animation: "rhz-ticker 40s linear infinite" }}
        >
          {tickerStats.map((s, i) => (
            <div key={i} className="flex items-baseline gap-2.5">
              <span
                className="font-display text-2xl sm:text-3xl font-bold bg-clip-text text-transparent"
                style={{ backgroundImage: grad.text }}
              >
                {s.v}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {s.k}
              </span>
              <span className="text-muted-foreground/40 ml-8">•</span>
            </div>
          ))}
        </div>
      </section>

      {/* SCROLLING FEED */}
      <section className="relative py-16">
        <div className="text-center max-w-2xl mx-auto mb-10 px-5">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-3">
            Live on Rhozeland
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold">
            Real releases.{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: grad.text }}>
              Real momentum.
            </span>
          </h2>
        </div>
        <div className="relative">
          <div
            className="flex gap-5 marquee-track py-6"
            style={{ width: "max-content", animation: "rhz-marquee 60s linear infinite" }}
          >
            {marquee.map((p, i) => (
              <ProjectCard key={`${p.id}-${i}`} p={p} />
            ))}
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent" />
        </div>
      </section>

      {/* HOW IT WORKS — 3 step bento */}
      <section className="relative px-5 sm:px-10 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center mb-14"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-3">
            How it works
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight">
            From bedroom demo to{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: grad.text }}>
              backed release
            </span>
            , in three moves.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: i * 0.12, ease: "easeOut" }}
            >
              <Tilt3D maxTilt={10} className="rounded-3xl h-full">
                <div className="relative h-full rounded-3xl border border-border/50 bg-card/70 backdrop-blur-md p-7 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]">
                  <div
                    aria-hidden
                    className="absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-40"
                    style={{ background: grad.halo }}
                  />
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-[0_15px_40px_-12px_rgba(236,72,153,0.5)]"
                        style={{ backgroundImage: grad.text }}
                      >
                        <s.icon className="h-5 w-5" />
                      </div>
                      <span className="font-display text-5xl font-bold text-foreground/10">
                        0{i + 1}
                      </span>
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                      {s.label}
                    </p>
                    <h3 className="font-display text-2xl font-bold leading-tight">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </Tilt3D>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="relative px-5 sm:px-10 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center mb-14"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground font-semibold mb-3">
            Built for music
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight">
            Everything an artist needs,{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: grad.text }}>
              one platform.
            </span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.1 }}
              className="group relative rounded-3xl border border-border/50 bg-card/60 backdrop-blur-md p-7 overflow-hidden shadow-[0_25px_70px_-30px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-1 hover:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]"
            >
              <div
                aria-hidden
                className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl opacity-30 transition-opacity group-hover:opacity-50"
                style={{ background: `radial-gradient(circle, ${f.color}, transparent 70%)` }}
              />
              <div className="relative flex items-start gap-4">
                <div
                  className="shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center shadow-[0_15px_40px_-12px_rgba(0,0,0,0.4)]"
                  style={{ background: `linear-gradient(135deg, ${f.color}, ${f.color}80)` }}
                >
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl font-bold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* BIG CTA */}
      <section className="relative px-5 sm:px-10 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="relative max-w-5xl mx-auto rounded-[2rem] border border-border/50 overflow-hidden p-10 sm:p-16 text-center shadow-[0_50px_120px_-40px_rgba(236,72,153,0.5)]"
          style={{ background: grad.surface }}
        >
          <div aria-hidden className="absolute inset-0 bg-background/40 backdrop-blur-sm" />
          <div
            aria-hidden
            className="absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-3xl opacity-60"
            style={{ background: grad.halo }}
          />
          <div className="relative space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md">
              <Music4 className="h-3.5 w-3.5" />
              For musicians, by musicians
            </div>
            <h2 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold leading-[1.05]">
              Your next release deserves{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: grad.text }}>
                more than streams.
              </span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Build it with fans. Anchor it on-chain. Earn from every backer who shows up early.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link to="/auth?mode=signup">
                <button
                  className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm sm:text-base font-semibold text-white shadow-[0_25px_60px_-15px_rgba(236,72,153,0.7)] transition-transform hover:scale-[1.04]"
                  style={{ backgroundImage: grad.text }}
                >
                  Get started free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
              <Link to="/why-coin">
                <button className="rounded-full border border-border/60 bg-card/70 backdrop-blur-md px-7 py-4 text-sm sm:text-base font-semibold hover:bg-card transition">
                  Why launch a coin?
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="relative border-t border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-10 py-14 grid sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src={rhozelandLogo} alt="Rhozeland" className="h-7 w-7" />
              <span className="font-display text-base font-bold">Rhozeland</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The build-in-public studio for musicians and the fans who back them.
            </p>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground pt-1">
              <Sparkles className="h-3 w-3" /> Made in Rhozeland
            </div>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.head} className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                {col.head}
              </p>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link to={href} className="text-sm text-foreground/80 hover:text-foreground transition story-link">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border/40 px-5 sm:px-10 py-5 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto">
          <span>© {new Date().getFullYear()} Rhozeland. All rights reserved.</span>
          <span className="opacity-70">Built for artists. Anchored on Solana.</span>
        </div>
      </footer>

      <style>{`
        @keyframes rhz-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes rhz-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @keyframes aurora-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(8%, 6%) scale(1.15); }
        }
        @keyframes aurora-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1.1); }
          50%      { transform: translate(-10%, 8%) scale(0.95); }
        }
        @keyframes aurora-drift-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(6%, -8%) scale(1.2); }
        }
        .aurora-blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          will-change: transform;
        }
        .aurora-1 {
          top: -10%; left: -10%;
          width: 55vw; height: 55vw;
          background: radial-gradient(circle, hsl(330 90% 65% / 0.45), transparent 65%);
          animation: aurora-drift-1 22s ease-in-out infinite;
        }
        .aurora-2 {
          top: 20%; right: -15%;
          width: 60vw; height: 60vw;
          background: radial-gradient(circle, hsl(260 85% 65% / 0.4), transparent 65%);
          animation: aurora-drift-2 28s ease-in-out infinite;
        }
        .aurora-3 {
          bottom: -20%; left: 20%;
          width: 65vw; height: 65vw;
          background: radial-gradient(circle, hsl(38 95% 60% / 0.35), transparent 65%);
          animation: aurora-drift-3 32s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track, .aurora-blob,
          [style*="rhz-marquee"], [style*="rhz-ticker"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
