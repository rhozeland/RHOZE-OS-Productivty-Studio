/**
 * HomePage — Public front door for guests.
 * ─────────────────────────────────────────────────────────────────────────
 * Goal: convert "I don't get what this is" + "I don't want yet another
 * crypto app" into "oh, this is a real creator network — let me try it."
 *
 * Strategy:
 *  1. Lead with concrete value ("book studios, hire talent, ship projects"),
 *     not tokens. $RHOZE is mentioned once, late, framed as a perk.
 *  2. Show LIVE platform activity (real Flow posts, real creator count) so
 *     the page never feels like marketing — it feels like a window into a
 *     working community.
 *  3. Two equal-weight CTAs: "Explore as guest" (no commitment) and
 *     "Sign up free" (one-click Google).
 *  4. Authed users skip this entirely — App.tsx routes them to /dashboard.
 */
import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowRight,
  Building2,
  Users,
  FolderKanban,
  Sparkles,
  Eye,
  Zap,
  CheckCircle2,
  ShoppingBag,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

type LiveStats = { creators: number; studios: number };
type LiveStudio = {
  id: string;
  name: string | null;
  cover_image_url: string | null;
  city: string | null;
};
type LiveCreator = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

const VALUE_PROPS = [
  {
    icon: Building2,
    title: "Book studios by the hour",
    desc: "Recording, photo, and video spaces — reserve, pay, done.",
  },
  {
    icon: Users,
    title: "Hire creators directly",
    desc: "Real portfolios, real reviews, real deliverables. No middlemen.",
  },
  {
    icon: FolderKanban,
    title: "Ship work with collaborators",
    desc: "Roadmaps, milestones, and budgets in one shared space.",
  },
];

const TRUST_BULLETS = [
  "Free to join — no credit card",
  "One-click Google sign in",
  "No spam, ever",
];

const HomePage = () => {
  const showcaseRef = useRef<HTMLDivElement>(null);
  const showcaseInView = useInView(showcaseRef, { once: true, amount: 0.2 });

  // Live platform stats — drives the "real, active community" feeling.
  const { data: stats } = useQuery<LiveStats>({
    queryKey: ["home-live-stats"],
    queryFn: async () => {
      const [c, s] = await Promise.all([
        supabase.from("profiles_public").select("*", { count: "exact", head: true }),
        supabase
          .from("studios")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("status", "approved"),
      ]);
      return {
        creators: c.count ?? 0,
        studios: s.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  // Featured studios — proof the platform is alive.
  const { data: studios } = useQuery<LiveStudio[]>({
    queryKey: ["home-live-studios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("id, name, cover_image_url, city")
        .eq("is_active", true)
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(6);
      return (data ?? []) as LiveStudio[];
    },
    staleTime: 60_000,
  });

  // Featured creators
  const { data: creators } = useQuery<LiveCreator[]>({
    queryKey: ["home-live-creators"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("user_id, display_name, avatar_url, username")
        .not("display_name", "is", null)
        .limit(8);
      return (data ?? []) as LiveCreator[];
    },
    staleTime: 60_000,
  });

  const creatorCount = stats?.creators ?? 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Nav ───────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <Link to="/" className="flex items-center gap-2">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-7 w-7" />
            <span className="font-body text-base font-bold tracking-tight text-foreground">
              Rhozeland
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/flow">
              <Button size="sm" variant="ghost" className="text-xs">
                Explore
              </Button>
            </Link>
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

      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-12 sm:pt-20 pb-16">
        {/* Aurora background */}
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
                  radial-gradient(ellipse 50% 40% at 20% 50%, hsl(280 80% 70% / 0.22) 0%, transparent 70%),
                  radial-gradient(ellipse 40% 50% at 80% 30%, hsl(320 80% 60% / 0.18) 0%, transparent 70%),
                  radial-gradient(ellipse 45% 35% at 60% 80%, hsl(30 90% 60% / 0.15) 0%, transparent 70%)
                `,
                animation: "aurora-drift 20s ease-in-out infinite alternate",
              }}
            />
          </motion.div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Live activity badge — REAL number, builds trust */}
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
                {creatorCount} {creatorCount === 1 ? "creator" : "creators"} building
                here right now
              </span>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] text-foreground mb-5 max-w-3xl mx-auto"
          >
            The creative network
            <br />
            <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              that pays you back.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed"
          >
            Book studios. Hire creators. Ship projects. Get rewarded for every
            contribution — no crypto knowledge required.
          </motion.p>

          {/* Dual primary CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-3 flex-wrap justify-center mb-4"
          >
            <Link to="/auth">
              <Button className="rounded-full h-12 px-6 gap-2 text-sm font-semibold">
                Sign up free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/explore/studios">
              <Button
                variant="outline"
                className="rounded-full h-12 px-6 gap-2 text-sm font-medium"
              >
                <Eye className="h-4 w-4" /> Look around first
              </Button>
            </Link>
          </motion.div>

          {/* Quick browse links — let guests pick exactly what to explore.
              Each route is fully public; auth only kicks in on actions. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 flex-wrap justify-center mb-5 text-xs"
          >
            <span className="text-muted-foreground/60">Browse:</span>
            <Link to="/explore/studios" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              Studios
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link to="/explore/creators" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              Creators
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link to="/marketplace" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              Marketplace
            </Link>
          </motion.div>

          {/* Trust signals — directly addresses "yet another app" + privacy */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-4 flex-wrap justify-center text-xs text-muted-foreground"
          >
            {TRUST_BULLETS.map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>{t}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Featured studios — real spaces guests can browse ──────────── */}
      {studios && studios.length > 0 && (
        <section ref={showcaseRef} className="border-t border-border/60 px-4 sm:px-6 py-12 bg-card/30">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
                  Featured studios
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                  Spaces you can book today
                </h2>
              </div>
              <Link to="/explore/studios">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  See all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {studios.slice(0, 6).map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={showcaseInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link
                    to={`/explore/studios/${s.id}`}
                    className="group block aspect-[4/3] rounded-xl overflow-hidden border border-border/50 bg-muted relative"
                  >
                    {s.cover_image_url ? (
                      <img
                        src={s.cover_image_url}
                        alt={s.name ?? "Studio"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/20">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                      <p className="text-sm font-semibold text-white truncate">
                        {s.name ?? "Studio"}
                      </p>
                      {s.city && (
                        <p className="text-[10px] text-white/70 truncate">{s.city}</p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Featured creators ─────────────────────────────────────────── */}
      {creators && creators.length > 0 && (
        <section className="border-t border-border/60 px-4 sm:px-6 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
                  Featured creators
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                  People building here
                </h2>
              </div>
              <Link to="/explore/creators">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  See all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {creators.slice(0, 8).map((c, i) => (
                <motion.div
                  key={c.user_id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border/50 bg-card/60 p-4 flex flex-col items-center text-center hover:border-border transition-all"
                >
                  <Avatar className="h-14 w-14 border border-border/40 mb-3">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback className="text-sm">
                      {c.display_name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-semibold text-foreground truncate w-full">
                    {c.display_name ?? "Creator"}
                  </p>
                  {c.username && (
                    <p className="text-[11px] text-muted-foreground truncate w-full">
                      @{c.username}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── What you can do — concrete value, no jargon ───────────────── */}
      <section className="px-4 sm:px-6 py-16 border-t border-border/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">
              What it actually is
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              A real workspace for creative people.
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto">
              Not a feed. Not a token. A place to make and ship work with other
              people — and get paid for it.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {VALUE_PROPS.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 hover:border-border transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">
                  {p.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {p.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── $RHOZE explained — last, briefly, no jargon ───────────────── */}
      <section className="px-4 sm:px-6 py-16 border-t border-border/60 bg-card/30">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-amber-500/10 mb-4">
            <Zap className="h-6 w-6 text-amber-500" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Get paid for showing up.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto mb-6">
            Every booking, sale, and project earns <strong className="text-foreground">$RHOZE</strong> — credits you can
            spend on studio time, creator services, or cash out. Think of it as
            airline miles for creative work. <span className="text-muted-foreground/70">No wallet to set up. No fees to start.</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border/60">
              <Building2 className="h-3 w-3" /> Book a studio → earn
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border/60">
              <ShoppingBag className="h-3 w-3" /> Sell your work → earn
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background border border-border/60">
              <FolderKanban className="h-3 w-3" /> Ship a project → earn
            </span>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-20 border-t border-border/60">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Try it. It's free.
          </h2>
          <p className="text-sm text-muted-foreground mb-7 max-w-md mx-auto">
            Sign up takes 10 seconds with Google. Or look around without an
            account first — we'll be here.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link to="/auth">
              <Button className="rounded-full h-12 px-6 gap-2 text-sm font-semibold">
                Sign up free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/explore/studios">
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
            <Link to="/flow" className="hover:text-foreground transition-colors">
              Explore
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
