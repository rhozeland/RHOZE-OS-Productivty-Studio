/**
 * WhyLaunchCoinPage — Pillar 3 education hub.
 *
 * Editorial answer to "why should I launch a coin on pump.fun, and what
 * does Rhozeland do with it?" Surfaces:
 *   - The 3 reasons (creator rewards, fan ownership, discovery).
 *   - How pump.fun rewards work (bps of trade volume, instant streaming).
 *   - What Rhozeland adds on top (token-gated feed, discovery lane,
 *     read-only chip, A&R signals).
 *   - FAQ.
 *
 * Linked from StartCoinCta and CreatorRewardsCard.
 */
import { useNavigate } from "react-router-dom";
import {
  Coins,
  Sparkles,
  Users,
  Compass,
  ArrowUpRight,
  Lock,
  TrendingUp,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PUMP_FUN_CREATE_URL = "https://pump.fun/create";

const WHY_REASONS = [
  {
    icon: TrendingUp,
    title: "You earn on every trade",
    body: "pump.fun routes ~0.05% of every buy and sell of your coin back to the wallet that minted it. No payout schedule — fees stream in real time as fans trade.",
  },
  {
    icon: Users,
    title: "Fans get real ownership",
    body: "Your most committed fans can hold a slice of your project's upside. They're not just listeners — they're early backers with skin in the game.",
  },
  {
    icon: Compass,
    title: "Discovery becomes self-fueling",
    body: "Every trade pushes your coin up the pump.fun trending board and the Rhozeland Coins-in-Motion lane. New fans find you because old fans believed.",
  },
];

const PLATFORM_PERKS = [
  {
    icon: Lock,
    title: "Token-gated private feed",
    body: "Holding any amount of $TICKER unlocks the same private posts that $5/mo subscribers see — for 24h, auto-refreshing while they hold.",
  },
  {
    icon: Sparkles,
    title: "Coins-in-Motion lane",
    body: "Live price + 24h change + 7d sparkline surface above the Discover stream. Linked tokens get promoted; chip-less profiles don't.",
  },
  {
    icon: ShieldCheck,
    title: "Admin-approved & read-only",
    body: "Every token is reviewed before it shows. Rhozeland never custodies, swaps, or simulates trades — every CTA deeplinks to pump.fun.",
  },
];

const FAQ = [
  {
    q: "Do I need to launch a coin to use Rhozeland?",
    a: "No. Subscriptions, projects, A&R, spaces, and events all work without a coin. Launching one just adds a second unlock path and a passive revenue stream.",
  },
  {
    q: "What does pump.fun charge me to launch?",
    a: "A small SOL fee for the deploy transaction (~$2 at current SOL prices). Rhozeland charges nothing to link or display the coin.",
  },
  {
    q: "Who controls my coin?",
    a: "You do. The mint is deployed from your wallet. Rhozeland only stores the mint address + ticker after our admin approves the submission.",
  },
  {
    q: "Can I unlink it later?",
    a: "Yes — toggle Show token chip off in Settings, or contact support to remove the link entirely. The coin keeps trading on pump.fun either way.",
  },
  {
    q: "Where do fans actually trade?",
    a: "Only on pump.fun. Every Trade ${'$'}TICKER button on Rhozeland is a deeplink — we never run a swap UI.",
  },
];

export default function WhyLaunchCoinPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-14 space-y-12">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {/* Hero */}
        <header className="space-y-5">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Why launch a coin
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-tight">
            Turn your fans into{" "}
            <span className="bg-gradient-to-r from-amber-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
              early backers
            </span>
            .
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            A pump.fun coin is the lightest-weight way to share upside with the
            people who got you here. Rhozeland makes it count — token holders
            unlock your private feed, your coin earns from every trade, and
            discovery flywheels itself.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg" className="rounded-full gap-2">
              <a
                href={PUMP_FUN_CREATE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Coins className="h-4 w-4" />
                Launch on pump.fun
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full"
            >
              <a href="/settings#token">I already have a coin</a>
            </Button>
          </div>
        </header>

        {/* 3 reasons */}
        <section className="space-y-5">
          <h2 className="font-display text-2xl font-semibold">
            Three reasons artists are launching now
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {WHY_REASONS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card/50 p-5 space-y-3"
              >
                <div className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-display text-base font-semibold leading-tight">
                  {title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Rewards math */}
        <section className="rounded-2xl border border-foreground/20 bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.04] to-fuchsia-500/[0.08] p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            How rewards work
          </div>
          <h2 className="font-display text-2xl font-semibold">
            ~0.05% of every trade routes to your wallet
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            pump.fun's creator-rewards program pays the mint deployer (you) a
            fee on every buy and sell. It accrues in real time, streams
            straight into your wallet, and you can see it on your pump.fun
            profile dashboard.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <RewardExample volume="$10k" earned="≈ $5" />
            <RewardExample volume="$100k" earned="≈ $50" />
            <RewardExample volume="$1M" earned="≈ $500" />
          </div>
          <p className="text-[11px] text-muted-foreground/80 pt-1">
            Estimates — exact rate is set by pump.fun and may change. Always
            verify on your pump.fun creator dashboard.
          </p>
        </section>

        {/* What Rhozeland adds */}
        <section className="space-y-5">
          <h2 className="font-display text-2xl font-semibold">
            What Rhozeland adds on top
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLATFORM_PERKS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card/50 p-5 space-y-3"
              >
                <div className="h-9 w-9 rounded-xl bg-foreground/10 text-foreground flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-display text-base font-semibold leading-tight">
                  {title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-5">
          <h2 className="font-display text-2xl font-semibold">
            Common questions
          </h2>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card/30">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group p-5">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                  <span className="font-medium text-sm">{q}</span>
                  <span className="text-muted-foreground text-xs shrink-0 group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="rounded-2xl border border-border bg-card/40 p-6 sm:p-8 text-center space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            Ready when you are
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Launch the coin on pump.fun, paste the mint into Settings, and our
            team will approve it — usually same-day.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button asChild size="lg" className="rounded-full gap-2">
              <a
                href={PUMP_FUN_CREATE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Coins className="h-4 w-4" />
                Launch on pump.fun
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full"
            >
              <a href="/settings#token">Link an existing coin</a>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

const RewardExample = ({
  volume,
  earned,
}: {
  volume: string;
  earned: string;
}) => (
  <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-center">
    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      {volume} traded
    </p>
    <p className="font-display text-xl font-semibold tabular-nums mt-1">
      {earned}
    </p>
    <p className="text-[10px] text-muted-foreground/70 mt-1">to your wallet</p>
  </div>
);
