/**
 * InfrastructurePage — `/infrastructure`
 * ─────────────────────────────────────────────────────────────────────────
 * Public-facing thesis page that reframes Rhozeland as **revenue
 * infrastructure for independent creators**, not "another creator app".
 *
 * Inspired by S33R Strategies' framing of the music-blockchain shift:
 * the real change isn't NFTs — it's the infrastructure stack underneath
 * (provenance → splits → settlement → capital).
 *
 * Each layer maps to something Rhozeland already ships, plus a one-line
 * note on what's coming. No backend reads — it's a static narrative page
 * that loads instantly for anonymous visitors and SEO crawlers.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Code2,
  Zap,
  TrendingUp,
  Layers,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

type Status = "live" | "soon";

interface Layer {
  index: string;
  icon: typeof ShieldCheck;
  title: string;
  tagline: string;
  body: string;
  liveToday: string;
  comingSoon: string;
  status: Status;
}

const LAYERS: Layer[] = [
  {
    index: "I",
    icon: ShieldCheck,
    title: "Provenance",
    tagline: "Timestamped, on-chain proof at the point of creation.",
    body:
      "Authorship and contribution disputes get resolved by contracts and lawyers today. Rhozeland writes a Solana memo every time a milestone is signed, a contribution is logged, or a roadmap locks — creating a verifiable, public record that doesn't depend on us.",
    liveToday:
      "Anchor Contributions and Works: every signed action and registered work emits a Solana memo with a public Solscan link.",
    comingSoon:
      "Royalty-on-resale and split-derivation tied to a work's content hash.",
    status: "live",
  },
  {
    index: "II",
    icon: Code2,
    title: "Programmable Splits",
    tagline: "Ownership becomes executable code, not a contract clause.",
    body:
      "A revenue split on Rhozeland isn't a PDF — it's a row of basis points stored on the platform and fingerprinted with a SHA-256 hash. When a milestone is approved, the split fires automatically. Curators are added through a verifiable invite handshake.",
    liveToday:
      "Creator / curator / buyback splits, curator invite & accept flow, milestone-triggered fan-out, and direct binding to a registered Work's content hash.",
    comingSoon:
      "N-recipient splits for full music collaboration (producer / writer / vocalist / label) and royalty-on-resale.",
    status: "live",
  },
  {
    index: "III",
    icon: Zap,
    title: "Settlement",
    tagline: "Months → minutes. Royalty streams as financial primitives.",
    body:
      "Industry royalties take 3–6 months to reach independent artists. Once data is normalized, settlement can move to stablecoin rails — reducing payment latency to seconds and turning earnings into auditable, real-time cash flows.",
    liveToday:
      "Square fiat payouts with USD wallet tracking, dedicated Withdrawal Panel, and per-Work settlement view in the Seller Dashboard — auditable cashflows indexed by anchored content hash.",
    comingSoon:
      "USDC-on-Solana opt-in per recipient — sub-minute settlement, public transaction proof.",
    status: "live",
  },
  {
    index: "IV",
    icon: TrendingUp,
    title: "Capital",
    tagline: "Earnings as collateral, not as a 6-month wait.",
    body:
      "When royalty streams become programmable financial primitives, they unlock something the music industry has gated for decades: capital access without label advances. Transparent earnings can collateralize lending, smooth cash flow, and shift financial power back to creators.",
    liveToday:
      "Per-creator USD wallet with $10 minimum withdrawal, Seller Dashboard transaction history, and a Capital advance estimator that scores trailing-90-day settlement gross, on-chain provenance ratio, tenure, and anchored-IP breadth into a one-click advance request.",
    comingSoon:
      "Underwriter automation + Anchor-program escrowed advances priced against on-chain settlement history, not gut feel.",
    status: "live",
  },
];

const InfrastructurePage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 max-w-5xl">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-body text-lg font-bold tracking-tight text-foreground">
              Rhozeland
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button size="sm" variant="ghost" className="text-sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="text-sm rounded-full gap-1.5">
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 opacity-[0.18] pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 30% 20%, hsl(var(--primary)/0.55), transparent 60%), radial-gradient(50% 40% at 80% 80%, hsl(var(--accent)/0.45), transparent 60%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-28 text-center">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 rounded-full px-3 py-1 bg-background/50 backdrop-blur"
          >
            <Layers className="h-3 w-3" /> The four-layer stack
          </Badge>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.05]"
          >
            Programmable revenue infrastructure for{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              independent creators
            </span>
            .
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Most platforms ship features. Rhozeland is rebuilding the layer
            underneath — how rights are registered, how splits execute, how
            payments settle. Treating apps like EVEN or Audius as the story is
            like treating the iPhone as a story about a touchscreen.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex items-center justify-center gap-3 flex-wrap"
          >
            <Link to="/auth">
              <Button size="lg" className="rounded-full gap-2">
                Build on it <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/">
              <Button size="lg" variant="ghost" className="rounded-full">
                See the product
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Layers */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24 space-y-10">
        {LAYERS.map((layer, i) => {
          const Icon = layer.icon;
          return (
            <motion.div
              key={layer.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="surface-card p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    Layer {layer.index}
                    {layer.status === "soon" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        Coming
                      </Badge>
                    )}
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                    {layer.title}
                  </h2>
                  <p className="text-sm sm:text-base text-accent mt-1 italic">
                    {layer.tagline}
                  </p>
                </div>
              </div>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {layer.body}
              </p>

              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg border border-border bg-background/40 p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Live today
                  </div>
                  <p className="text-sm text-foreground/90">{layer.liveToday}</p>
                </div>
                <div className="rounded-lg border border-dashed border-border bg-background/20 p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Next
                  </div>
                  <p className="text-sm text-foreground/80">{layer.comingSoon}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </section>

      {/* Convergence */}
      <section className="border-t border-border bg-muted/20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-20 text-center space-y-6">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
            The stack is forming.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Each layer enables the next. The entity that controls the data
            layer ultimately controls the system. The infrastructure is
            already here — the only question is who builds on it first.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-4 font-mono text-xs sm:text-sm">
            {["Provenance", "Splits", "Settlement", "Capital", "Applications"].map(
              (label, i, arr) => (
                <div key={label} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="rounded-full bg-background/60 backdrop-blur"
                  >
                    {label}
                  </Badge>
                  {i < arr.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              )
            )}
          </div>

          <div className="pt-8">
            <Link to="/auth">
              <Button size="lg" className="rounded-full gap-2">
                Start building <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">
          ← Back to Rhozeland
        </Link>
      </footer>
    </div>
  );
};

export default InfrastructurePage;
