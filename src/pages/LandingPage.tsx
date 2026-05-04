import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Coins,
  Heart,
  Palette,
  Search,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

/* ─────────────────────────── Data ─────────────────────────── */

const HOW_FANS = [
  { icon: Search, title: "Discover", body: "Spin the globe to find verified artists, spaces, and live moments worldwide." },
  { icon: Heart, title: "Back the work", body: "Follow, collect, book, and tip the artists whose work moves you." },
  { icon: Coins, title: "Earn $RHOZE", body: "Every meaningful action earns rewards you can reinvest into the artists you love." },
];

const HOW_ARTISTS = [
  { icon: ShieldCheck, title: "Get verified", body: "A quick selfie + bio unlocks the Verified Artist badge and monetization." },
  { icon: Palette, title: "Prove your work", body: "Upload, content-hash, and anchor your work on-chain — provenance you own forever." },
  { icon: Sparkles, title: "Sell access & upside", body: "Open commissions, host Spaces, drop events, and let fans co-own your momentum." },
];

// Aligned with the canonical tier matrix swatches:
// Spark = blue, Bloom = pink, Glow = orange, Play = yellow.
const TIERS = [
  {
    name: "Spark",
    hue: "from-sky-400 via-blue-500 to-indigo-600",
    accent: "text-sky-600",
    chipBg: "bg-sky-500/10 text-sky-700 border-sky-500/30",
    blurb: "Welcome in. Earn rewards just by showing up.",
  },
  {
    name: "Bloom",
    hue: "from-[hsl(330_85%_75%)] via-[hsl(335_75%_60%)] to-[hsl(345_70%_50%)]",
    accent: "text-[hsl(335_70%_50%)]",
    chipBg: "bg-[hsl(330_85%_75%/0.15)] text-[hsl(335_70%_45%)] border-[hsl(335_70%_55%/0.4)]",
    blurb: "Hold a little $RHOZE. Unlock more of the network.",
  },
  {
    name: "Glow",
    hue: "from-amber-400 via-orange-500 to-red-500",
    accent: "text-orange-600",
    chipBg: "bg-orange-500/10 text-orange-700 border-orange-500/30",
    blurb: "Hold more, get lower fees and louder reach.",
  },
  {
    name: "Play",
    hue: "from-yellow-300 via-amber-400 to-yellow-600",
    accent: "text-amber-600",
    chipBg: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    blurb: "The top floor — best perks, lowest fees, full studio.",
  },
];

/* ─────────────────────── Soft pastel orbs ─────────────────── */

const PastelBackdrop = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full opacity-70 blur-3xl"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, hsl(330 85% 78% / 0.55), transparent 60%)," +
          "radial-gradient(circle at 70% 60%, hsl(292 84% 78% / 0.45), transparent 65%)",
      }}
    />
    <div
      className="absolute top-10 -right-20 h-[480px] w-[480px] rounded-full opacity-70 blur-3xl"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, hsl(38 92% 75% / 0.55), transparent 60%)," +
          "radial-gradient(circle at 70% 30%, hsl(160 65% 70% / 0.40), transparent 65%)",
      }}
    />
    <div
      className="absolute bottom-[-200px] left-1/3 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, hsl(200 85% 78% / 0.40), transparent 60%)," +
          "radial-gradient(circle at 30% 70%, hsl(330 85% 78% / 0.45), transparent 65%)",
      }}
    />
  </div>
);

/* ────────────────────────── Page ──────────────────────────── */

const LandingPage = () => {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <PastelBackdrop />

      {/* Nav */}
      <nav className="relative z-10">
        <div className="mx-auto flex h-16 items-center justify-between px-5 sm:px-8 max-w-6xl">
          <Link to="/" className="flex items-center gap-2">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-display text-xl font-bold tracking-tight">Rhozeland</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/discover">
              <Button size="sm" variant="ghost" className="rounded-full text-sm">Explore</Button>
            </Link>
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" className="rounded-full text-sm gap-1.5">
                  Open Studio <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button size="sm" variant="ghost" className="rounded-full text-sm">Sign in</Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="rounded-full text-sm gap-1.5">
                    Join free <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative z-10 px-5 sm:px-8">
        <div className="mx-auto max-w-5xl pt-12 sm:pt-20 pb-16 sm:pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 backdrop-blur-md px-3 py-1 mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              A home for real artists
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display text-5xl sm:text-7xl leading-[0.98] tracking-tight"
          >
            Where{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(330 85% 60%), hsl(292 84% 65%), hsl(38 92% 55%))",
                WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
              }}
            >
              real artists
            </span>
            <br />
            and{" "}
            <span
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(38 92% 55%), hsl(160 65% 50%), hsl(200 85% 55%))",
                WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
              }}
            >
              real fans
            </span>{" "}
            meet.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            Rhozeland is a soft place on the internet for independent artists to
            prove their work, host Spaces, and grow — while fans discover, back,
            and earn alongside the people they love.
          </motion.p>

          {/* Split CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto"
          >
            <Link to="/auth?intent=fan" className="group">
              <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-5 text-left hover:border-foreground/30 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Heart className="h-4 w-4 text-pink-500" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">For fans</span>
                </div>
                <p className="font-display text-lg font-semibold">Discover & back artists</p>
                <p className="text-xs text-muted-foreground mt-1">Free to join · earn $RHOZE rewards</p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium group-hover:gap-2.5 transition-all">
                  Start exploring <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>

            <Link to="/auth?intent=artist" className="group">
              <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-5 text-left hover:border-foreground/30 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Palette className="h-4 w-4 text-amber-500" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">For artists</span>
                </div>
                <p className="font-display text-lg font-semibold">Get verified & monetize</p>
                <p className="text-xs text-muted-foreground mt-1">Prove your work · keep up to 93%</p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium group-hover:gap-2.5 transition-all">
                  Apply to verify <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          </motion.div>

          <p className="mt-5 text-xs text-muted-foreground">
            <Link to="/discover" className="underline-offset-4 hover:underline">
              Or peek at the world first →
            </Link>
          </p>
        </div>
      </section>

      {/* ─── How it works (3 steps × 2 audiences) ─── */}
      <section id="how-it-works" className="relative z-10 px-5 sm:px-8 pb-20">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">How it works</p>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight">Two sides. One soft economy.</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Fans column */}
            <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-md p-6 sm:p-8">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 mb-5">
                <Heart className="h-3 w-3 text-pink-500" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-pink-600 dark:text-pink-300">Fans</span>
              </div>
              <ol className="space-y-5">
                {HOW_FANS.map((s, i) => (
                  <li key={s.title} className="flex gap-4">
                    <div className="shrink-0 h-9 w-9 rounded-full bg-foreground/5 border border-border/60 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">{s.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Artists column */}
            <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-md p-6 sm:p-8">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 mb-5">
                <Palette className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Artists</span>
              </div>
              <ol className="space-y-5">
                {HOW_ARTISTS.map((s, i) => (
                  <li key={s.title} className="flex gap-4">
                    <div className="shrink-0 h-9 w-9 rounded-full bg-foreground/5 border border-border/60 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">{s.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Tier ladder (Creator Pass) ─── */}
      <section className="relative z-10 px-5 sm:px-8 pb-20">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Creator Pass</p>
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight">Earned, never paid.</h2>
            <p className="mt-3 max-w-xl mx-auto text-sm text-muted-foreground leading-relaxed">
              Show up, hold a little $RHOZE, climb the ladder. Lower fees, louder
              reach, more perks — at every tier.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TIERS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-5 overflow-hidden group"
              >
                {/* Big soft tier-colored glow */}
                <div className={`absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br ${t.hue} opacity-60 blur-2xl group-hover:opacity-80 transition-opacity`} />
                <div className={`absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-gradient-to-br ${t.hue} opacity-25 blur-3xl`} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold px-2 py-0.5 rounded-full border ${t.chipBg}`}>
                      Tier {i + 1}
                    </span>
                    <span
                      className={`h-8 w-8 rounded-xl shadow-md ring-1 ring-white/40 bg-gradient-to-br ${t.hue}`}
                      aria-hidden
                    />
                  </div>
                  <div className={`font-display text-2xl font-bold bg-gradient-to-br ${t.hue} bg-clip-text text-transparent`}>
                    {t.name}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{t.blurb}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/credits?tab=how" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              How rewards work →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Closing CTA ─── */}
      <section className="relative z-10 px-5 sm:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center rounded-[2rem] border border-border/60 bg-card/70 backdrop-blur-xl p-10 sm:p-14 relative overflow-hidden"
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-70 blur-2xl"
            style={{
              background:
                "radial-gradient(circle at 30% 40%, hsl(330 85% 78% / 0.40), transparent 60%)," +
                "radial-gradient(circle at 70% 60%, hsl(38 92% 75% / 0.40), transparent 65%)",
            }}
          />
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-5xl tracking-tight leading-[1.05]">
              Bring your work.
              <br />
              We'll bring the world.
            </h2>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="rounded-full gap-2">
                  Join Rhozeland — it's free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/discover">
                <Button size="lg" variant="ghost" className="rounded-full">
                  Explore first
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border/60 py-6">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={rhozelandLogo} alt="" className="h-4 w-4 opacity-60" />
            <span>© 2026 Rhozeland</span>
          </div>
          <Link to="/auth" className="hover:text-foreground transition-colors">Sign in →</Link>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
