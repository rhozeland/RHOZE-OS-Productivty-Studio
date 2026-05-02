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
import { ArrowLeft, Coins, Sparkles, Shield, HelpCircle } from "lucide-react";
import RewardsDashboard from "@/components/creators/RewardsDashboard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FaqItem = {
  q: string;
  a: React.ReactNode;
  terms?: { word: string; tip: string }[];
};

const FAQ: FaqItem[] = [
  {
    q: "How do I earn?",
    a: (
      <>
        Show up. Post work to{" "}
        <Link to="/discover" className="underline underline-offset-2 hover:text-foreground">Discover</Link>,
        support other artists, complete milestones inside a Project, or
        keep a streak going. Every action has a fixed reward listed in the
        catalog below.
      </>
    ),
    terms: [
      { word: "milestones", tip: "Stages inside a Project that unlock payment + rewards once both sides approve." },
      { word: "streak", tip: "Consecutive days you post or interact. Resets if you skip a day." },
    ],
  },
  {
    q: "How do I claim what I've earned?",
    a: (
      <>
        Earnings sit as credits on your account until an admin approves
        them — this keeps the reward pool honest. Once approved, bind a
        Solana wallet in{" "}
        <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">Settings</Link>{" "}
        and claim on-chain. No wallet? Credits stay safely parked.
      </>
    ),
    terms: [
      { word: "admin approves", tip: "A manual gate that prevents reward farming. Usually cleared within 24h." },
      { word: "bind a Solana wallet", tip: "One wallet per account, locked on first connection. Cannot be swapped." },
    ],
  },
  {
    q: "What about paid Projects — how are splits handled?",
    a: (
      <>
        Paid Projects use a 75 / 15 / 10 split: creator, collaborators,
        platform. Splits are configured at lock and anchored on-chain so
        nobody can quietly rewrite them mid-project. See{" "}
        <Link to="/projects" className="underline underline-offset-2 hover:text-foreground">Projects</Link>{" "}
        for the full flow.
      </>
    ),
    terms: [
      { word: "anchored on-chain", tip: "A Solana memo records the split agreement at the moment the roadmap locks." },
      { word: "at lock", tip: "When all parties sign the roadmap and it becomes immutable." },
    ],
  },
  {
    q: "Do I need a wallet to use Rhozeland?",
    a: (
      <>
        No. Discovery, Hub, Spaces, Inbox, and paid Projects all work with
        a regular account. A wallet only matters if you want to claim
        $RHOZE on-chain or mint Verified IP for your work.
      </>
    ),
    terms: [
      { word: "Verified IP", tip: "A content hash of your file anchored to Solana — proves you posted it first." },
    ],
  },
  {
    q: "Can rewards be revoked?",
    a: (
      <>
        Approved on-chain claims are yours. Pending credits can be
        rejected if an action is flagged (spam, duplicate posts, fake
        engagement). The reasoning is always logged in your reward
        history.
      </>
    ),
  },
];

const TermTooltip = ({ children, tip }: { children: React.ReactNode; tip: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="underline decoration-dotted decoration-muted-foreground/60 underline-offset-2 cursor-help">
        {children}
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
      {tip}
    </TooltipContent>
  </Tooltip>
);

/** Wraps any term occurrences in the answer with a tooltip. */
const renderAnswer = (item: FaqItem): React.ReactNode => {
  if (!item.terms?.length) return item.a;
  // Walk the React tree replacing string children that contain any term.
  const wrap = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") {
      let parts: React.ReactNode[] = [node];
      item.terms!.forEach(({ word, tip }, ti) => {
        const next: React.ReactNode[] = [];
        parts.forEach((p, pi) => {
          if (typeof p !== "string") return next.push(p);
          const idx = p.toLowerCase().indexOf(word.toLowerCase());
          if (idx === -1) return next.push(p);
          next.push(p.slice(0, idx));
          next.push(
            <TermTooltip key={`t-${ti}-${pi}`} tip={tip}>
              {p.slice(idx, idx + word.length)}
            </TermTooltip>
          );
          next.push(p.slice(idx + word.length));
        });
        parts = next;
      });
      return <>{parts}</>;
    }
    if (Array.isArray(node)) return node.map((n, i) => <span key={i}>{wrap(n)}</span>);
    return node;
  };
  return wrap(item.a);
};

const RewardsPage = () => {
  return (
    <TooltipProvider delayDuration={150}>
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

        {/* FAQ — concise, tooltip-augmented */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold text-foreground">
              Quick FAQ
            </h2>
          </div>
          <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 px-4 sm:px-5">
            <Accordion type="single" collapsible className="w-full">
              {FAQ.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={`item-${i}`}
                  className="border-border/40 last:border-b-0"
                >
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline text-left">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {renderAnswer(item)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          <p className="text-[11px] text-muted-foreground/70 px-1">
            Still curious? Ping us in{" "}
            <Link to="/inbox" className="underline underline-offset-2 hover:text-foreground">
              Inbox
            </Link>{" "}
            — we read everything.
          </p>
        </section>

        {/* Existing RewardsDashboard — full catalog, balance, claim, history */}
        <section>
          <RewardsDashboard />
        </section>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default RewardsPage;
