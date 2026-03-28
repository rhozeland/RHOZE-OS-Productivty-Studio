import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  Users,
  FolderKanban,
  Coins,
  Flame,
  Play,
  MessageSquare,
  Calendar,
  Star,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const FEATURES = [
  {
    icon: Building2,
    title: "Book Studios",
    desc: "Browse and book creative spaces by the hour — recording, photo, video, and more.",
  },
  {
    icon: Users,
    title: "Hire Creatives",
    desc: "Find freelance talent on the marketplace and collaborate with built-in messaging.",
  },
  {
    icon: FolderKanban,
    title: "Ship Projects",
    desc: "End-to-end project management with milestones, budgets, and approval workflows.",
  },
  {
    icon: Coins,
    title: "Rose Coin",
    desc: "Earn tokens for completing work, leaving reviews, and contributing to the community.",
  },
];

const PREVIEW_SCREENS = [
  { label: "Dashboard", color: "from-primary/20 to-accent/10" },
  { label: "Hub", color: "from-orange-500/20 to-pink-500/10" },
  { label: "Studios", color: "from-violet-500/20 to-blue-500/10" },
  { label: "Messages", color: "from-emerald-500/20 to-teal-500/10" },
];

const LandingPage = () => {
  const { user } = useAuth();
  const [activePreview, setActivePreview] = useState(0);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-6xl">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              Rhozeland
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" className="rounded-full text-sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="rounded-full text-sm">
                    Get Early Access
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-16 md:pt-24 pb-12">
        {/* Subtle background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-primary/8 via-accent/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 mb-6">
              <Flame className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">
                Now in Early Access
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] text-foreground mb-4">
              Where creatives
              <br />
              <span className="gradient-text">build together.</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Book studios. Hire talent. Manage projects — all in one place.
              Rhozeland is the creative workspace designed for collaboration and
              payments.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth">
                <Button className="rounded-full h-12 px-8 gap-2 text-sm font-semibold shadow-lg shadow-primary/20">
                  Create Your Account <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/explore/studios">
                <Button
                  variant="outline"
                  className="rounded-full h-12 px-8 gap-2 text-sm"
                >
                  <Play className="h-3.5 w-3.5" /> Explore Preview
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* App Preview / Teaser */}
      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Preview tab bar */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {PREVIEW_SCREENS.map((screen, i) => (
              <button
                key={screen.label}
                onClick={() => setActivePreview(i)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activePreview === i
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {screen.label}
              </button>
            ))}
          </div>

          {/* Preview window */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/5"
          >
            {/* Fake title bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                <div className="w-3 h-3 rounded-full bg-green-400/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-3 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground">
                  rhozeland.app
                </div>
              </div>
            </div>

            {/* Preview content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activePreview}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={`h-[320px] sm:h-[400px] bg-gradient-to-br ${PREVIEW_SCREENS[activePreview].color} p-6 sm:p-8 flex flex-col`}
              >
                {activePreview === 0 && (
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-foreground/10 animate-pulse" />
                      <div>
                        <div className="h-4 w-32 rounded bg-foreground/10 mb-1" />
                        <div className="h-3 w-20 rounded bg-foreground/5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 flex-1">
                      {["Projects", "Messages", "Events"].map((label) => (
                        <div
                          key={label}
                          className="rounded-xl bg-background/40 backdrop-blur-sm border border-border/50 p-3 flex flex-col"
                        >
                          <span className="text-[10px] text-muted-foreground mb-1">
                            {label}
                          </span>
                          <span className="text-lg font-bold text-foreground/70">
                            —
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-background/40 backdrop-blur-sm border border-border/50 p-3 h-24" />
                      <div className="rounded-xl bg-background/40 backdrop-blur-sm border border-border/50 p-3 h-24" />
                    </div>
                  </div>
                )}
                {activePreview === 1 && (
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="h-5 w-5 text-orange-500/60" />
                      <span className="font-display text-sm font-bold text-foreground/60">
                        Creators Hub
                      </span>
                    </div>
                    <div className="flex gap-2 mb-3">
                      {["Trending", "New", "Services"].map((tab) => (
                        <div
                          key={tab}
                          className="px-3 py-1 rounded-full bg-background/40 text-[10px] text-muted-foreground border border-border/50"
                        >
                          {tab}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      {[1, 2, 3, 4].map((n) => (
                        <div
                          key={n}
                          className="rounded-xl bg-background/40 backdrop-blur-sm border border-border/50 p-3 flex flex-col justify-end"
                        >
                          <div className="h-3 w-16 rounded bg-foreground/10 mb-1" />
                          <div className="h-2 w-10 rounded bg-foreground/5" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activePreview === 2 && (
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-5 w-5 text-violet-500/60" />
                      <span className="font-display text-sm font-bold text-foreground/60">
                        Studios
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 flex-1">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="flex items-center gap-3 rounded-xl bg-background/40 backdrop-blur-sm border border-border/50 p-3"
                        >
                          <div className="h-12 w-12 rounded-lg bg-foreground/10 shrink-0" />
                          <div className="flex-1">
                            <div className="h-3 w-24 rounded bg-foreground/10 mb-1" />
                            <div className="h-2 w-16 rounded bg-foreground/5" />
                          </div>
                          <Star className="h-3.5 w-3.5 text-muted-foreground/30" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activePreview === 3 && (
                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-5 w-5 text-emerald-500/60" />
                      <span className="font-display text-sm font-bold text-foreground/60">
                        Messages
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      {[1, 2, 3, 4].map((n) => (
                        <div
                          key={n}
                          className={`flex items-start gap-3 ${n % 2 === 0 ? "flex-row-reverse" : ""}`}
                        >
                          <div className="h-8 w-8 rounded-full bg-foreground/10 shrink-0" />
                          <div
                            className={`rounded-2xl px-4 py-2.5 max-w-[60%] ${
                              n % 2 === 0
                                ? "bg-primary/20 rounded-tr-sm"
                                : "bg-background/40 border border-border/50 rounded-tl-sm"
                            }`}
                          >
                            <div className="h-2.5 w-20 rounded bg-foreground/10 mb-1" />
                            <div className="h-2 w-14 rounded bg-foreground/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* What's Coming */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Everything you need to create.
            </h2>
            <p className="text-sm text-muted-foreground">
              One platform. No switching between apps.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
                className="group rounded-2xl bg-card border border-border p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-bold text-foreground mb-1">
                  {f.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl bg-gradient-to-br from-foreground to-foreground/90 text-background p-8 sm:p-12 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10" />
            <div className="relative z-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
                Be part of the first wave.
              </h2>
              <p className="text-sm opacity-70 max-w-md mx-auto mb-6">
                Early members get founding badges, bonus Rose Coins, and first
                access to Creator Pass perks.
              </p>
              <Link to="/auth">
                <Button
                  variant="secondary"
                  className="rounded-full h-12 px-8 gap-2 text-sm font-semibold"
                >
                  Join Rhozeland <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-6 w-6" />
            <span className="font-display text-sm font-semibold text-foreground">
              Rhozeland
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 Rhozeland. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
