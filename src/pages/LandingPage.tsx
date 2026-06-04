import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { todayGradient } from "@/lib/rhoze-gradients";
import Tilt3D from "@/components/ui/Tilt3D";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

/**
 * LandingPage — v11 with depth.
 * Animated aurora gradient field, mouse-parallax hero, 3D-tilted project
 * cards in the marquee, floating orbs. Same content as before.
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
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]">
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
        <div className="flex items-center gap-2">
          <Link to="/auth?mode=signin">
            <Button variant="ghost" size="sm" className="rounded-full">Log in</Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm" className="rounded-full">Sign up</Button>
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
        {/* Floating parallax orbs */}
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
            className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md"
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
          <div className="pt-2" style={{ transform: "translateZ(80px)" }}>
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
          </div>
        </motion.div>
      </section>

      {/* SCROLLING FEED */}
      <section className="relative py-12">
        <div className="relative">
          <div
            className="flex gap-5 marquee-track py-6"
            style={{ width: "max-content", animation: "rhz-marquee 60s linear infinite" }}
          >
            {marquee.map((p, i) => (
              <ProjectCard key={`${p.id}-${i}`} p={p} />
            ))}
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-0 backdrop-blur-[1px] bg-background/30" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent" />

          <div className="absolute inset-0 flex items-center justify-center">
            <Link to="/auth?mode=signup">
              <div
                className="group inline-flex items-center gap-2 rounded-full border border-border/60 px-6 py-3 text-sm font-semibold text-foreground shadow-2xl backdrop-blur-xl transition-all hover:scale-[1.04]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--card) / 0.85), hsl(var(--card) / 0.6))",
                }}
              >
                <Sparkles className="h-4 w-4 text-primary" />
                Sign up to follow along
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>

        <style>{`
          @keyframes rhz-marquee {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
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
            .marquee-track, .aurora-blob { animation: none !important; }
          }
        `}</style>
      </section>
    </div>
  );
};

export default LandingPage;
