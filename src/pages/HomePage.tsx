/**
 * HomePage — Public front door for guests (v8.7).
 *
 * One-pager. No inbox, no projects, no marketplace dump. Just the pitch:
 *   1. Hero — "Own a piece of the artists you love." (v7 framing)
 *   2. Live globe — featured artists / events / spaces orbiting the world
 *   3. Creator Pass preview — 3D-tilt mock + tier ladder (Spark→Play)
 *   4. How rewards work — 3 simple steps, no jargon
 *   5. Final sign-up CTA
 *
 * Authed users skip this entirely (App.tsx routes them to /discover).
 */
import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Eye,
  Loader2,
  Sparkles,
  ShieldCheck,
  Coins,
  TrendingUp,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";
import Tilt3D from "@/components/ui/Tilt3D";
import { TIERS } from "@/lib/tier-matrix";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import type { RegionMarket } from "@/lib/regions";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

const STEPS = [
  {
    icon: ShieldCheck,
    title: "Verify",
    desc: "Artists prove identity + IP. Every drop is content-hashed and anchored on Solana.",
  },
  {
    icon: Coins,
    title: "Engage",
    desc: "Discover spaces, events, and creators. Buy access, support, and collect.",
  },
  {
    icon: TrendingUp,
    title: "Earn $RHOZE",
    desc: "Real activity earns credits. Hold them to unlock tier perks — or cash out.",
  },
];

const HomePage = () => {
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);

  // Live creators count — small trust signal under the hero.
  const { data: creatorCount = 0 } = useQuery({
    queryKey: ["home-creator-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles_public")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Nav ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <Link to="/" className="flex items-center gap-2">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-7 w-7" />
            <span className="font-body text-base font-bold tracking-tight text-foreground">
              Rhozeland
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button size="sm" variant="ghost" className="text-xs">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="text-xs rounded-full gap-1.5 h-8">
                Get started <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-14 sm:pt-20 pb-10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2 }}
            className="absolute inset-0"
          >
            <div
              className="absolute top-[-30%] left-[-20%] w-[140%] h-[160%]"
              style={{
                background: `
                  radial-gradient(ellipse 50% 40% at 20% 50%, hsl(330 81% 60% / 0.22) 0%, transparent 70%),
                  radial-gradient(ellipse 40% 50% at 80% 30%, hsl(292 84% 61% / 0.18) 0%, transparent 70%),
                  radial-gradient(ellipse 45% 35% at 60% 80%, hsl(38 92% 50% / 0.16) 0%, transparent 70%)
                `,
                animation: "aurora-drift 20s ease-in-out infinite alternate",
              }}
            />
          </motion.div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {creatorCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full bg-card/80 border border-border/60 px-3 py-1.5 mb-6 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-foreground">
                {creatorCount.toLocaleString()} creators building on Rhozeland
              </span>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] text-foreground mb-5"
          >
            Own a piece of the
            <br />
            <span
              className="inline-block"
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              artists you love.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed"
          >
            Verified artists. Provable work. Real upside. A creative network
            where every contribution is on-chain — and every fan can be an early
            backer.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-3 flex-wrap justify-center"
          >
            <Link to="/auth">
              <Button className="rounded-full h-12 px-6 gap-2 text-sm font-semibold">
                Sign up free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/discover">
              <Button
                variant="outline"
                className="rounded-full h-12 px-6 gap-2 text-sm font-medium"
              >
                <Eye className="h-4 w-4" /> Look around first
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-10 max-w-3xl mx-auto text-left"
          >
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 mb-2">
                For creators
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">
                Earn $RHOZE by posting work, listing services, and attending
                events. Spend it on Rhozeland's photography, videography, and
                development services.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 mb-2">
                For fans
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">
                Buy and hold Artist Coins to support creators you believe in.
                When they grow, your coin grows with them.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Live globe — featured artists / events / spaces ────────────── */}
      <section className="relative px-4 sm:px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5">
              Featured worldwide
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              A living map of creative work.
            </h2>
          </div>
          <Suspense
            fallback={
              <div className="flex h-[420px] w-full items-center justify-center rounded-[2rem] border border-border/60 bg-card/40">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <DiscoverGlobe
              marketFilter={marketFilter}
              onSelectMarket={setMarketFilter}
              featuredSlides={featuredSlides}
              height={420}
            />
          </Suspense>
        </div>
      </section>

      {/* ─── Creator Pass preview — 3D tilt + tier ladder ───────────────── */}
      <section className="px-4 sm:px-6 py-16 border-t border-border/60 bg-card/30">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-14 items-center">
          {/* Left — tilt card */}
          <div className="flex justify-center">
            <Tilt3D className="w-full max-w-[320px] aspect-[1.586/1] rounded-[22px] overflow-hidden">
              <div
                className="h-full w-full p-5 flex flex-col justify-between text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(330 81% 60%), hsl(292 84% 61%) 50%, hsl(38 92% 50%))",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <img src={rhozelandLogo} alt="" className="h-5 w-5" />
                    <span className="font-body text-xs font-bold tracking-wider uppercase">
                      Creator Pass
                    </span>
                  </div>
                  <Sparkles className="h-4 w-4 opacity-90" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.25em] opacity-80">
                    Tier
                  </p>
                  <p className="font-display text-3xl font-bold tracking-tight">
                    Bloom
                  </p>
                  <p className="text-[11px] opacity-85">
                    1.25× rewards · 5% off Spaces · 2 IP anchors / mo
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] opacity-80">
                  <span>0001 · RHOZE</span>
                  <span>Earned, never bought</span>
                </div>
              </div>
            </Tilt3D>
          </div>

          {/* Right — tier ladder */}
          <div className="space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5">
                The Creator Pass
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                Hold $RHOZE. Unlock the network.
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                No subscriptions. Tiers are <em>earned</em> by holding $RHOZE —
                the credits you collect from real activity on the platform.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {TIERS.map((t) => (
                <div
                  key={t.id}
                  className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 p-3"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-0.5"
                    style={{ background: t.gradient }}
                  />
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-sm font-bold text-foreground">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {t.holdLabel}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {t.benefits[0]}
                  </p>
                </div>
              ))}
            </div>

            <Link to="/credits?tab=how" className="inline-flex items-center gap-1 text-xs text-foreground hover:underline underline-offset-4">
              How rewards work <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── How it works — 3 simple steps ──────────────────────────────── */}
      <section className="px-4 sm:px-6 py-16 border-t border-border/60">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5">
              How it works
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Three steps. No crypto knowledge required.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">
                  {s.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {s.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-20 border-t border-border/60">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Build, prove, and own — together.
          </h2>
          <p className="text-sm text-muted-foreground mb-7 max-w-md mx-auto">
            Sign up takes 10 seconds. No card. No wallet. Just the network.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link to="/auth">
              <Button className="rounded-full h-12 px-6 gap-2 text-sm font-semibold">
                Sign up free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/discover">
              <Button
                variant="outline"
                className="rounded-full h-12 px-6 gap-2 text-sm"
              >
                Explore as guest
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <img src={rhozelandLogo} alt="" className="h-4 w-4 opacity-50" />
            <span className="text-xs text-muted-foreground">© 2026 Rhozeland</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/auth" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link to="/discover" className="hover:text-foreground transition-colors">
              Discover
            </Link>
            <Link to="/credits?tab=how" className="hover:text-foreground transition-colors">
              How rewards work
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
