/**
 * MyPassRedesign — everything that renders BELOW the holographic blue
 * CreatorPassCard on `/credits`. The blue card itself is unchanged; this
 * file owns sections 1-4, 6, 7 of the v11 Creator Pass redesign:
 *
 *   1. Your Next Move (balance · claim · top earning actions)
 *   2. How $RHOZE works (Earn · Hold · Spend trio)
 *   3. The Ladder (Spark → Play with savings calculator)
 *   4. Ways to earn (collapsible — wraps existing RewardsExplainerV2 catalog)
 *   6. Streak
 *   7. Quick FAQ
 *
 * Section 5 (Recent Activity) is still rendered by CreditShopPage via the
 * existing <ActivityPreview /> block — left untouched per spec.
 *
 * Visual styles, tokens, and gradients are reused verbatim from the rest of
 * the app: `surface-card`, primary HSL token, emerald reward pills, the
 * accordion + tier gradient system.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Coins, Sparkles, Wallet, Zap, Shield, Heart, Trophy, ArrowRight,
  ChevronDown, Flame, Info, Download, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { TIERS, getHoldTier, type TierId } from "@/lib/tier-matrix";
import { useRhozeMarketPrice } from "@/hooks/useRhozeMarketPrice";
import ClaimRhozeButton from "@/components/ClaimRhozeButton";
import RewardsExplainerV2 from "@/components/credits/RewardsExplainerV2";
import { cn } from "@/lib/utils";

const formatRhoze = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return Math.round(n).toLocaleString();
};

/* ═══════════════════ Section 1 — Your Next Move ═══════════════════ */
const NextMoveSection = () => {
  const { user } = useAuth();
  const [claimAmount, setClaimAmount] = useState(0);

  const { data: credits } = useQuery({
    queryKey: ["next-move-credits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const { data: market } = useRhozeMarketPrice();
  const priceUsd = market?.priceUsd ?? 0;
  const balance = Number(credits?.balance ?? 0);
  const usd = balance * priceUsd;

  const holdTier = getHoldTier(balance);
  const tierIdx = TIERS.findIndex((t) => t.id === holdTier);
  const next = TIERS[tierIdx + 1] ?? null;
  const remaining = next ? Math.max(0, next.hold - balance) : 0;

  const presets = [
    { label: "1", value: 1 },
    { label: "3", value: 3 },
    { label: "5", value: 5 },
    { label: "All", value: Math.floor(balance) },
  ];

  const actions = [
    { label: "Back an artist stage", amount: "+25 $RHOZE", cta: "Back now", href: "/discover" },
    { label: "Buy an artist coin", amount: "+50 $RHOZE", cta: "Explore coins", href: "/discover" },
    { label: "Refer a friend", amount: "+100 $RHOZE", cta: "Invite", href: "/settings#referrals" },
  ];

  return (
    <section className="surface-card p-5 sm:p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left — Balance */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            $RHOZE balance
          </p>
          <p className="font-display text-4xl sm:text-5xl font-bold text-foreground tabular-nums mt-1">
            {formatRhoze(balance)}
          </p>
          {next ? (
            <p className="text-sm font-medium text-primary mt-2">
              {formatRhoze(remaining)} $RHOZE to {next.label}
            </p>
          ) : (
            <p className="text-sm font-medium text-primary mt-2">Top tier reached</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            ≈ ${usd.toFixed(2)}
          </p>
        </div>

        {/* Right — Claim */}
        <div className="md:border-l md:border-border md:pl-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium inline-flex items-center gap-1.5">
              <Download className="h-3 w-3" /> Claim to Wallet
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {balance.toLocaleString()} available
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {presets.map((p) => {
              const disabled = p.value <= 0 || p.value > balance;
              const active = claimAmount === p.value && !disabled;
              return (
                <button
                  key={p.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => setClaimAmount(p.value)}
                  className={cn(
                    "h-9 rounded-full border text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted/50",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <ClaimRhozeButton
              creditsToClaim={claimAmount}
              onSuccess={() => setClaimAmount(0)}
              className="w-full"
              disabled={claimAmount <= 0 || claimAmount > balance}
            />
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <a
              href="https://phantom.app/learn/crypto-101/what-is-a-crypto-wallet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              What's a wallet? →
            </a>
            <span className="text-[11px] text-muted-foreground">Claim Later</span>
          </div>
        </div>
      </div>

      {/* Three action rows */}
      <div className="border-t border-border pt-4">
        <p className="text-sm font-display font-semibold text-foreground mb-3">
          Get to {next?.label ?? "the top"} faster:
        </p>
        <ul className="space-y-2">
          {actions.map((a) => (
            <li
              key={a.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5"
            >
              <div className="min-w-0 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.label}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {a.amount}
                  </p>
                </div>
              </div>
              <Link to={a.href}>
                <Button size="sm" variant="outline" className="gap-1 rounded-full shrink-0">
                  {a.cta}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

/* ═══════════════════ Section 2 — How $RHOZE Works ═══════════════════ */
const HowItWorksSection = ({ onJumpToEarn }: { onJumpToEarn: () => void }) => {
  const cards = [
    {
      icon: Zap,
      title: "Earn",
      body:
        "Every action on Rhozeland earns you $RHOZE. Back artists, post updates, hold coins, maintain your streak.",
      cta: { label: "See all ways to earn ↓", onClick: onJumpToEarn },
    },
    {
      icon: Shield,
      title: "Hold",
      body:
        "The more $RHOZE you hold the higher your tier. Higher tiers pay lower platform fees. More you hold, more you save.",
      cta: { label: "See tier benefits ↓", scrollTo: "ladder-section" },
    },
    {
      icon: Coins,
      title: "Spend",
      body:
        "Use $RHOZE to book studio sessions, buy artist coins, or cash out to your Solana wallet.",
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold text-foreground">How $RHOZE works</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 flex flex-col"
          >
            <c.icon className="h-5 w-5 text-primary mb-3" />
            <h3 className="font-display text-base font-semibold text-foreground">{c.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed flex-1">
              {c.body}
            </p>
            {c.title === "Spend" ? (
              <div className="flex flex-wrap gap-1.5 mt-4">
                <Link to="/discover?kind=space">
                  <Button size="sm" variant="outline" className="rounded-full text-xs h-7">
                    Book a studio
                  </Button>
                </Link>
                <Link to="/discover">
                  <Button size="sm" variant="outline" className="rounded-full text-xs h-7">
                    Buy coins
                  </Button>
                </Link>
                <Link to="/credits">
                  <Button size="sm" variant="outline" className="rounded-full text-xs h-7">
                    Cash out
                  </Button>
                </Link>
              </div>
            ) : (
              <button
                onClick={() => {
                  if ((c.cta as any)?.onClick) (c.cta as any).onClick();
                  else if ((c.cta as any)?.scrollTo) {
                    document
                      .getElementById((c.cta as any).scrollTo)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="text-xs text-primary hover:underline underline-offset-2 mt-4 text-left font-medium"
              >
                {c.cta?.label}
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  );
};

/* ═══════════════════ Section 3 — The Ladder ═══════════════════ */
const LadderSection = ({ currentTier }: { currentTier: TierId }) => {
  const tierFees: Record<TierId, { pct: number; perks: string[] }> = {
    spark: { pct: 15, perks: ["1× rewards", "Standard fees"] },
    bloom: { pct: 15, perks: ["1.25× rewards", "5% off Spaces"] },
    glow:  { pct: 10, perks: ["1.5× rewards", "Unlimited IP anchors"] },
    play:  { pct: 7,  perks: ["2× rewards", "Featured placement"] },
  };
  const currentIdx = TIERS.findIndex((t) => t.id === currentTier);

  return (
    <section id="ladder-section" className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Hold more. Pay less.</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your tier determines your platform fee on every transaction.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TIERS.map((t, i) => {
          const isYou = t.id === currentTier;
          const isLocked = i > currentIdx;
          const fee = tierFees[t.id];
          return (
            <div
              key={t.id}
              className={cn(
                "relative rounded-2xl border bg-card/60 backdrop-blur-sm p-4 overflow-hidden transition",
                isYou ? "border-primary border-2" : "border-border/60",
                isLocked && "opacity-60",
              )}
            >
              {isYou && (
                <span className="absolute top-2 right-2 text-[9px] font-bold tracking-wider uppercase bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                  You
                </span>
              )}
              {isLocked && (
                <Lock className="absolute top-3 right-3 h-3 w-3 text-muted-foreground" />
              )}
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0 ring-1 ring-white/20"
                  style={{ background: t.gradient }}
                  aria-hidden
                />
                <p className="font-display text-base font-bold text-foreground">{t.label}</p>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums mt-2">
                {t.holdLabel} $RHOZE
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">{fee.pct}% fee</p>
              <ul className="mt-3 space-y-1">
                {fee.perks.map((p) => (
                  <li key={p} className="text-[11px] text-muted-foreground leading-snug">
                    • {p}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Savings calculator */}
      <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
          At $1,000 in transactions:
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TIERS.map((t) => {
            const pct = tierFees[t.id].pct;
            return (
              <li key={t.id} className="flex flex-col">
                <span className="text-xs text-muted-foreground">{t.label}</span>
                <span className="font-display text-lg font-bold text-foreground tabular-nums">
                  pay ${(pct * 10).toFixed(0)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-sm font-semibold text-primary mt-3">
          Reach Play and save $80 on every $1,000
        </p>
      </div>
    </section>
  );
};

/* ═══════════════════ Section 4 — Ways to Earn (collapsible) ═══════════════════ */
const WaysToEarnSection = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  return (
    <section className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">Ways to earn</h2>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/40">
          <RewardsExplainerV2 />
        </div>
      )}
    </section>
  );
};

/* ═══════════════════ Section 6 — Streak ═══════════════════ */
const StreakSection = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_streaks")
        .select("current_streak, longest_streak")
        .eq("user_id", user.id)
        .maybeSingle();
      setStreak({
        current: data?.current_streak ?? 0,
        longest: data?.longest_streak ?? 0,
      });
    })();
  }, [user]);

  const current = streak.current;
  const longest = streak.longest;
  const dayInCycle = current === 0 ? 0 : ((current - 1) % 7) + 1;
  const toNext = current === 0 ? 7 : 7 - (current % 7 || 7);

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Flame className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="font-display text-3xl font-bold text-foreground tabular-nums leading-none">
              {current}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              day streak <span className="text-xs opacity-70">· longest {longest}</span>
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Next $RHOZE drop
          </p>
          <p className="font-display text-lg font-bold text-foreground tabular-nums">
            {toNext} day{toNext === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5 mt-5">
        {Array.from({ length: 7 }).map((_, i) => {
          const filled = i < dayInCycle;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-4 w-4 rounded-full transition",
                  filled
                    ? "bg-amber-500 shadow-[0_0_10px_-2px] shadow-amber-500/60"
                    : "border-2 border-border bg-transparent",
                )}
              />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                {["M","T","W","T","F","S","S"][i]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-3">
        Sign in every 7 days to earn $RHOZE
      </p>
    </section>
  );
};

/* ═══════════════════ Section 7 — Quick FAQ ═══════════════════ */
const FaqSection = () => (
  <section className="space-y-3">
    <div className="flex items-center gap-2">
      <Info className="h-4 w-4 text-primary" />
      <h2 className="font-display text-lg font-semibold text-foreground">Quick FAQ</h2>
    </div>
    <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 px-4 sm:px-5">
      <Accordion type="single" collapsible>
        <AccordionItem value="claim" className="border-border/40">
          <AccordionTrigger className="text-sm font-medium">How do I claim what I've earned?</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            Earnings are automatically credited when you complete qualifying
            actions. Our system verifies activity to keep rewards fair for
            everyone. To take $RHOZE on-chain, bind a Solana wallet in{" "}
            <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
              Settings
            </Link>{" "}
            and claim from <strong>My Pass</strong>.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="splits" className="border-border/40">
          <AccordionTrigger className="text-sm font-medium">How do paid project splits work?</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            Everyone on a project is a collaborator — split 100% however the
            team agrees. Platform fee is deducted first based on the lead's
            tier (15% Spark/Bloom · 10% Glow · 7% Play). Splits are locked
            and anchored on-chain so nobody can quietly rewrite them mid-project.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="wallet" className="border-border/40">
          <AccordionTrigger className="text-sm font-medium">Do I need a wallet?</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            No. Discovery, conversations, projects, and bookings all work
            with a regular account. A wallet only matters to claim $RHOZE
            on-chain or mint Verified IP.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="revoke" className="last:border-b-0">
          <AccordionTrigger className="text-sm font-medium">Can rewards be revoked?</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
            Approved on-chain claims are yours. Pending credits can be
            rejected if flagged (spam, duplicate, fake engagement). Reasoning
            is always logged in your reward history.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </section>
);

/* ═══════════════════ Public composition ═══════════════════ */
export const MyPassRedesign = ({
  currentTier,
  activityPreview,
}: {
  currentTier: TierId;
  /** Section 5 — kept as-is, injected from CreditShopPage. */
  activityPreview: React.ReactNode;
}) => {
  const [earnOpen, setEarnOpen] = useState(false);

  const jumpToEarn = () => {
    setEarnOpen(true);
    setTimeout(() => {
      document.getElementById("ways-to-earn-anchor")?.scrollIntoView({
        behavior: "smooth", block: "start",
      });
    }, 50);
  };

  return (
    <div className="space-y-6">
      <NextMoveSection />
      <HowItWorksSection onJumpToEarn={jumpToEarn} />
      <LadderSection currentTier={currentTier} />
      <div id="ways-to-earn-anchor">
        <WaysToEarnSection open={earnOpen} onOpenChange={setEarnOpen} />
      </div>
      {activityPreview}
      <StreakSection />
      <FaqSection />
    </div>
  );
};

export default MyPassRedesign;
