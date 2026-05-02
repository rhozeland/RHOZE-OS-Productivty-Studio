/**
 * RewardsPage — `/rewards`
 *
 * v6: single explainer + control room for the $RHOZE reward layer.
 * The front door (Discover) and primary CTAs no longer pitch tokens —
 * anyone curious lands here from a quiet "How rewards work" link.
 *
 * This page wraps the existing RewardsDashboard component (catalog of
 * earning actions, balance, claim flow, history, leaderboard) so all
 * the reward UX lives in ONE route instead of being scattered.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Sparkles, Shield } from "lucide-react";
import RewardsDashboard from "@/components/creators/RewardsDashboard";

const RewardsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Back */}
        <Link
          to="/discover"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Discover
        </Link>

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/15 px-3 py-1">
            <Coins className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-primary tracking-wide uppercase">
              How rewards work
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-foreground">
            $RHOZE is the optional layer.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            Rhozeland is a discovery + support network for independent
            artists. You can use the whole platform without ever touching a
            token. $RHOZE just rewards the people who show up — posting
            work, supporting artists, completing milestones — and gives
            them a tradeable signal of their early contribution.
          </p>
        </motion.header>

        {/* Three-line explainer */}
        <section className="grid sm:grid-cols-3 gap-3">
          {[
            {
              icon: Sparkles,
              title: "Earn by contributing",
              desc: "Posting, reviewing, milestones, streaks. Every reward is logged and admin-approved.",
            },
            {
              icon: Shield,
              title: "Yours to keep",
              desc: "Bind a Solana wallet to claim on-chain. No wallet? No problem — credits stay on your account.",
            },
            {
              icon: Coins,
              title: "Use it or trade it",
              desc: "Pay for bookings at a discount, unlock higher Pass tiers, or hold long-term.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4"
            >
              <item.icon className="h-4 w-4 text-primary mb-2" />
              <h3 className="font-display text-sm font-semibold text-foreground mb-1">
                {item.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </section>

        {/* Existing RewardsDashboard — full catalog, balance, claim, history */}
        <section>
          <RewardsDashboard />
        </section>
      </div>
    </div>
  );
};

export default RewardsPage;
