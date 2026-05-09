/**
 * RewardsExplainerV2 — visual rewrite of the "How rewards work" tab.
 *
 * Replaces walls of copy with:
 *  - 3 mini hero tiles (Earn / Hold / Spend)
 *  - Connect / Build / Earn switchable tabs (compact reward catalog)
 *  - Visual tier ladder (Spark → Bloom → Glow → Play)
 *  - Concise FAQ accordion
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins, Sparkles, Wallet, Heart, Trophy, Zap, ArrowDown, ChevronRight, Info,
} from "lucide-react";
import { REWARDS_BY_LANE } from "@/lib/rewards-catalog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const LANES = [
  {
    key: "connect" as const,
    label: "Connect",
    icon: Heart,
    blurb: "Engage with artists + community.",
    accent: "hsl(330 80% 60%)",
  },
  {
    key: "build" as const,
    label: "Build",
    icon: Trophy,
    blurb: "Ship projects, host Spaces, post work.",
    accent: "hsl(30 90% 60%)",
  },
];

const TIERS = [
  { key: "spark", label: "Spark",  threshold: "0 $RHOZE",        fee: "15% fee", color: "hsl(40 85% 60%)" },
  { key: "bloom", label: "Bloom",  threshold: "1,000 $RHOZE",    fee: "15% fee", color: "hsl(330 75% 60%)" },
  { key: "glow",  label: "Glow",   threshold: "10,000 $RHOZE",   fee: "10% fee", color: "hsl(280 70% 60%)" },
  { key: "play",  label: "Play",   threshold: "100,000 $RHOZE",  fee: "7% fee",  color: "hsl(180 70% 50%)" },
];

const HERO_TILES = [
  { icon: Sparkles, title: "Earn",  desc: "Posting, attending, milestones. Admin-approved." },
  { icon: Wallet,   title: "Hold",  desc: "Climb tiers and lower your platform fee." },
  { icon: Coins,    title: "Spend", desc: "Bookings, services, or cash out on Solana." },
];

const RewardsExplainerV2 = () => {
  const [lane, setLane] = useState<"connect" | "build">("connect");

  return (
    <div className="space-y-8">
      {/* ─── Hero strip: 3 tiles ─── */}
      <section className="grid sm:grid-cols-3 gap-3">
        {HERO_TILES.map((t, i) => (
          <motion.div
            key={t.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-4"
          >
            <t.icon className="h-4 w-4 text-primary mb-2" />
            <h3 className="font-display text-sm font-semibold text-foreground">{t.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* ─── Lane switcher + reward catalog ─── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">How you earn</h3>
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          {LANES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setLane(key)}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                lane === key
                  ? "bg-card shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={lane}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-border/50 bg-card/60 p-4"
          >
            <p className="text-xs text-muted-foreground mb-3">
              {LANES.find((l) => l.key === lane)!.blurb}
            </p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {REWARDS_BY_LANE[lane].map((r) => (
                <li
                  key={r.action}
                  className="rounded-xl border border-border/50 bg-background/40 p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {r.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary whitespace-nowrap">{r.amount}</p>
                    {r.cap && <p className="text-[10px] text-muted-foreground whitespace-nowrap">{r.cap}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ─── Visual tier ladder ─── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">The ladder</h3>
          <span className="text-[11px] text-muted-foreground ml-1">
            Hold $RHOZE → unlock the next tier.
          </span>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {TIERS.map((t, i) => (
              <motion.div
                key={t.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="relative rounded-xl border border-border/60 bg-background/50 p-4 overflow-hidden"
              >
                <div
                  className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-xl"
                  style={{ background: t.color }}
                />
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center mb-3"
                  style={{ background: `${t.color}25`, border: `1px solid ${t.color}50` }}
                >
                  <Zap className="h-3.5 w-3.5" style={{ color: t.color }} />
                </div>
                <p className="font-display text-base font-bold text-foreground">{t.label}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{t.threshold}</p>
                <p className="text-[11px] font-medium text-foreground mt-2">{t.fee}</p>
                {i < TIERS.length - 1 && (
                  <ChevronRight className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                )}
                {i < TIERS.length - 1 && (
                  <ArrowDown className="sm:hidden absolute left-1/2 -translate-x-1/2 -bottom-2 h-4 w-4 text-muted-foreground/40" />
                )}
              </motion.div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 text-center">
            Lower tiers pay <span className="text-foreground font-medium">15%</span> platform fee.
            Glow drops it to <span className="text-foreground font-medium">10%</span>, Play to <span className="text-foreground font-medium">7%</span>.
          </p>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">Quick FAQ</h3>
        </div>
        <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 px-4 sm:px-5">
          <Accordion type="single" collapsible>
            <AccordionItem value="claim" className="border-border/40">
              <AccordionTrigger className="text-sm font-medium">How do I claim what I've earned?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                Earnings sit as credits until an admin approves them — keeps the
                reward pool honest. Once approved, bind a Solana wallet in{" "}
                <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">Settings</Link>{" "}
                and claim on-chain from <strong>My Pass</strong>.
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
    </div>
  );
};

export default RewardsExplainerV2;
