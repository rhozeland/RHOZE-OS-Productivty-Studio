import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  Palette,
  FolderKanban,
  Star,
  Users,
  Zap,
  MapPin,
  Music,
  Camera,
  Video,
  PenTool,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const STUDIO_CATEGORIES = [
  { icon: Music, label: "Recording", color: "hsl(280, 60%, 55%)" },
  { icon: Camera, label: "Photo", color: "hsl(35, 90%, 50%)" },
  { icon: Video, label: "Video", color: "hsl(340, 70%, 55%)" },
  { icon: PenTool, label: "Design", color: "hsl(175, 60%, 45%)" },
  { icon: Palette, label: "Art", color: "hsl(310, 60%, 65%)" },
];

const FEATURES = [
  {
    icon: Building2,
    title: "Book Studio Spaces",
    description: "Find and book creative studios by the hour — recording, photo, video, and more.",
  },
  {
    icon: Palette,
    title: "Hire Creative Talent",
    description: "Browse freelance designers, producers, videographers and more on the marketplace.",
  },
  {
    icon: FolderKanban,
    title: "Manage Projects Together",
    description: "Collaborate with your team using built-in project management, timelines, and deliverables.",
  },
  {
    icon: Zap,
    title: "Built-In Payments",
    description: "Handle escrow, milestone payments, and studio bookings — all within the platform.",
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">Rhozeland</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/explore/studios" className="hover:text-foreground transition-colors">Studios</Link>
            <Link to="/explore/creators" className="hover:text-foreground transition-colors">Creators</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm">Log in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="rounded-full text-sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Zap className="h-3.5 w-3.5" />
              Where creative teams get things done
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight text-foreground">
              Book studios.<br />
              Hire creatives.<br />
              <span className="gradient-text">Ship projects.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              The all-in-one platform for creative teams — find studio spaces, discover freelance talent, and manage projects with built-in collaboration and payments.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <Link to="/auth">
                <Button size="lg" className="rounded-full text-base h-12 px-8 gap-2">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/explore/studios">
                <Button size="lg" variant="outline" className="rounded-full text-base h-12 px-8 gap-2">
                  <Building2 className="h-4 w-4" /> Browse Studios
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Studio categories quick browse */}
      <section className="border-t border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-foreground">Explore Studio Spaces</h2>
            <Link to="/explore/studios" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {STUDIO_CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <Link
                  to={`/explore/studios?category=${cat.label.toLowerCase()}`}
                  className="flex flex-col items-center gap-3 rounded-2xl bg-card border border-border p-6 hover:shadow-lg hover:-translate-y-1 transition-all group"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl text-white shadow-md transition-transform group-hover:scale-110"
                    style={{ backgroundColor: cat.color }}
                  >
                    <cat.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{cat.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Everything creative teams need
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              From finding the perfect studio to managing complex projects — Rhozeland brings it all together.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl bg-card border border-border p-8 hover:shadow-lg transition-shadow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="border-t border-border bg-card/50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "500+", label: "Creative Professionals" },
              { value: "50+", label: "Studio Spaces" },
              { value: "1,000+", label: "Projects Completed" },
              { value: "4.9", label: "Average Rating", icon: Star },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl md:text-4xl font-bold text-foreground flex items-center justify-center gap-1">
                  {stat.value}
                  {stat.icon && <stat.icon className="h-6 w-6 text-warm fill-warm" />}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
            Ready to create?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
            Join the platform where studios, freelancers, and creative teams come together to build amazing work.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="rounded-full text-base h-12 px-8 gap-2">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/explore/studios">
              <Button size="lg" variant="outline" className="rounded-full text-base h-12 px-8 gap-2">
                <MapPin className="h-4 w-4" /> Find a Studio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-6 w-6" />
            <span className="font-display text-sm font-semibold text-foreground">Rhozeland</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/explore/studios" className="hover:text-foreground">Studios</Link>
            <Link to="/explore/creators" className="hover:text-foreground">Creators</Link>
            <Link to="/auth" className="hover:text-foreground">Sign In</Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 Rhozeland. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
