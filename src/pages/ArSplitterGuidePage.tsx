/**
 * ArSplitterGuidePage — public 3-step guide explaining how a Rhozeland Roster
 * artist sets up a Squads v4 multisig as their pump.fun creator wallet, so
 * pump.fun creator rewards stream into a shared address Rhozeland co-signs.
 *
 * Zero on-chain code on our side — this page is process + a settings field
 * to record the splitter address inside the A&R intake.
 */
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  ArrowUpRight,
  ExternalLink,
  Wallet,
  Handshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: 1,
    icon: Wallet,
    title: "Create a Squads v4 multisig",
    body: "Go to v4.squads.so and start a new multisig with two signers: your personal wallet and the Rhozeland treasury address (we'll share it in your A&R kickoff). Set the threshold to 1-of-2 for withdrawals so neither side is blocked. Splits are encoded in the off-chain A&R agreement — Squads is just the receiving address.",
    cta: { label: "Open Squads v4", href: "https://v4.squads.so", external: true },
  },
  {
    n: 2,
    icon: ShieldCheck,
    title: "Set the multisig as your pump.fun creator wallet",
    body: "On pump.fun, open your coin's creator dashboard and update the creator-rewards destination to the Squads vault address (NOT the multisig manager — the vault PDA). Every buy/sell will now route the ~0.05% creator fee straight into the multisig instead of your personal wallet.",
    cta: { label: "Open pump.fun", href: "https://pump.fun", external: true },
  },
  {
    n: 3,
    icon: Handshake,
    title: "Tell Rhozeland",
    body: "Paste the multisig vault address into the A&R intake (or DM your curator). We verify it on-chain, countersign the A&R contract, and schedule the first payout. From there, every withdrawal needs both signers — you stay in control.",
    cta: { label: "Open A&R intake", href: "/why-coin", external: false },
  },
];

const FAQ = [
  {
    q: "Why Squads and not Streamflow?",
    a: "Streamflow is one-way vesting (drip from A to B over time). Squads is a multisig vault — the right primitive for an A&R deal where both sides need to authorize each withdrawal. You can always layer Streamflow on top later for scheduled payouts.",
  },
  {
    q: "Do I need this if I'm DIY or Curated tier?",
    a: "No. The splitter is only required for the full Rhozeland Roster tier, where Rhozeland is the A&R label and shares in the creator rewards stream.",
  },
  {
    q: "What if I already launched my coin to my personal wallet?",
    a: "You can still update the creator-rewards destination on pump.fun after launch. Set up the Squads multisig, then point your coin's creator wallet at it. Future rewards route to the multisig.",
  },
  {
    q: "What share does Rhozeland take?",
    a: "Standard A&R Roster deal is 25% of the creator-rewards stream, but the actual share is negotiated in your A&R contract and recorded on your profile (admin-managed). You see the share before signing.",
  },
];

export default function ArSplitterGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-14 space-y-12">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <header className="space-y-5">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            A&R splitter wallet · Roster tier
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-tight">
            Share creator rewards{" "}
            <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-fuchsia-500 bg-clip-text text-transparent">
              without ever giving up custody
            </span>
            .
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            Rhozeland Roster artists route their pump.fun creator-rewards
            stream through a Squads multisig. Both sides sign every
            withdrawal. No middlemen, no platform-custody. Three steps,
            ~15 minutes.
          </p>
        </header>

        <section className="space-y-4">
          {STEPS.map(({ n, icon: Icon, title, body, cta }) => (
            <div
              key={n}
              className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6 flex gap-5"
            >
              <div className="shrink-0">
                <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center font-display font-semibold">
                  {n}
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display text-lg font-semibold">{title}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                  {cta.external ? (
                    <a href={cta.href} target="_blank" rel="noopener noreferrer">
                      {cta.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <Link to={cta.href}>
                      {cta.label}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-5">
          <h2 className="font-display text-2xl font-semibold">Common questions</h2>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card/30">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group p-5">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                  <span className="font-medium text-sm">{q}</span>
                  <span className="text-muted-foreground text-xs shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-6 sm:p-8 text-center space-y-4">
          <h2 className="font-display text-2xl font-semibold">Ready to start?</h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Apply to the Rhozeland Roster and we'll walk you through the setup
            on a kickoff call.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button asChild size="lg" className="rounded-full gap-2">
              <Link to="/why-coin">
                Apply to the Roster
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
