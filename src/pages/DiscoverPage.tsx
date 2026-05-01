/**
 * Discover — v6 front door.
 * ─────────────────────────────────────────────────────────────────────────
 * Phase 1 shell: minimal feed-led page that frames Rhozeland as a
 * discovery + support network for independent artists. The full
 * algorithmic feed lands in Phase 2; for now this surface routes
 * visitors into the existing Hub lanes + Spaces hub so the new dock
 * pillar isn't a dead end.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Building2, Compass } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DiscoverPage = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-10">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-2"
      >
        <p className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
          <Compass className="h-3 w-3" /> Discover
        </p>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl leading-[1.1] text-foreground">
          Get discovered.{" "}
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
            Get supported.
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl">
          Independent artists, the people who care, and the on-chain rewards
          that keep both sides showing up. {user ? "Pick a thread." : "Have a look around."}
        </p>
      </motion.header>

      {/* Phase 1: two-card jump-off into existing surfaces.
          Phase 2 will replace this with a real algorithmic feed
          (featured artist → trending → fresh works → events → coins). */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/hub"
          className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 min-h-[200px] hover:border-foreground/30 transition-colors"
        >
          <Sparkles className="h-5 w-5 text-primary mb-4" />
          <h2 className="font-display text-xl font-semibold text-foreground mb-1.5">
            What artists are saying
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Conversations, offerings, opportunities, verified works — the
            digital pulse of the network.
          </p>
          <span className="mt-5 inline-flex items-center text-xs font-medium text-primary gap-1 group-hover:gap-2 transition-all">
            Tune in <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        <Link
          to="/spaces"
          className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 min-h-[200px] hover:border-foreground/30 transition-colors"
        >
          <Building2 className="h-5 w-5 text-primary mb-4" />
          <h2 className="font-display text-xl font-semibold text-foreground mb-1.5">
            Where artists are showing up
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Spaces, events, residencies — the real-world proof that builds
            belief.
          </p>
          <span className="mt-5 inline-flex items-center text-xs font-medium text-primary gap-1 group-hover:gap-2 transition-all">
            Step in <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-2">
          Coming next
        </p>
        <p className="text-sm text-foreground max-w-md mx-auto">
          A featured artist of the week, trending creators, fresh verified
          works, live events, and coins moving today — all in one feed.
        </p>
        {!user && (
          <Link to="/auth" className="inline-block mt-4">
            <Button size="sm" className="rounded-full gap-1.5">
              Sign up free <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </section>
    </div>
  );
};

export default DiscoverPage;
