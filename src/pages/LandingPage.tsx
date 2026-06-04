import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { todayGradient } from "@/lib/rhoze-gradients";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

/**
 * LandingPage — marketing front door for logged-out visitors at `/`.
 *
 * Spec (v11):
 *  • Top: logo left · Sign up + Log in right.
 *  • Hero (~60vh): big headline · subline · single gradient CTA.
 *  • Below: scrolling marquee of REAL public projects, dimmed + blurred,
 *    with a single "Sign up to follow along →" overlay CTA.
 *
 * No additional sections — this IS the marketing page.
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
  <div
    className="shrink-0 w-[300px] sm:w-[340px] rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm"
    aria-hidden
  >
    <div
      className="h-32 w-full"
      style={{
        background: `linear-gradient(135deg, ${p.cover_color ?? "#ec4899"} 0%, hsl(292 84% 60%) 100%)`,
      }}
    />
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
);

const LandingPage = () => {
  const grad = todayGradient();
  const [projects, setProjects] = useState<PublicProject[]>(FALLBACK);

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

  // Duplicate the row so the marquee can scroll seamlessly.
  const marquee = [...projects, ...projects];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* TOP BAR */}
      <header className="relative z-20 flex items-center justify-between px-5 sm:px-10 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
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

      {/* HERO — ~60vh */}
      <section className="relative flex items-center justify-center px-5 sm:px-10"
               style={{ minHeight: "60vh" }}>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-80"
          style={{ background: grad.surface }}
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-4xl text-center space-y-6 py-16"
        >
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            Where musicians build in public
            <br className="hidden sm:block" />
            <span> and fans back the work.</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Follow a project. Support the roadmap. Back the coin when it launches.
          </p>
          <div className="pt-2">
            <Link to="/auth?mode=signup">
              <button
                className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm sm:text-base font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundImage: grad.text }}
              >
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* SCROLLING FEED — dimmed/blurred preview with single overlay CTA */}
      <section className="relative py-10">
        <div className="relative">
          {/* Marquee track */}
          <div
            className="flex gap-4 marquee-track py-4"
            style={{
              width: "max-content",
              animation: "rhz-marquee 50s linear infinite",
            }}
          >
            {marquee.map((p, i) => (
              <ProjectCard key={`${p.id}-${i}`} p={p} />
            ))}
          </div>

          {/* Dim + blur overlay (does not block clicks on the CTA) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 backdrop-blur-[2px] bg-background/40"
          />
          {/* Edge fades */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent"
          />

          {/* CTA overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Link to="/auth?mode=signup">
              <div className="inline-flex items-center gap-2 rounded-full bg-card/90 border border-border/60 px-5 py-2.5 text-sm font-semibold text-foreground shadow-md backdrop-blur-md hover:bg-card transition-colors">
                <Sparkles className="h-4 w-4 text-primary" />
                Sign up to follow along
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          </div>
        </div>

        {/* Marquee keyframes — scoped inline so we don't touch global CSS */}
        <style>{`
          @keyframes rhz-marquee {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @media (prefers-reduced-motion: reduce) {
            .marquee-track { animation: none !important; }
          }
        `}</style>
      </section>
    </div>
  );
};

export default LandingPage;
