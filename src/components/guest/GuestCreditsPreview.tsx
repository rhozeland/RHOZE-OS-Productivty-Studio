import { motion } from "framer-motion";
import {
  Sparkles, Flower2, Sun, Gamepad, Coins, ArrowRight,
  Check, Palette, Radio, LayoutGrid, TrendingUp, Award, Zap, Star, MessageSquare, Flame,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TIERS = [
  {
    name: "Spark",
    price: "Free",
    gradient: "linear-gradient(135deg, hsl(205, 75%, 65%), hsl(220, 55%, 42%))",
    icon: Sparkles,
    features: ["3 Boards", "1 hr Drop Rooms", "Browse studios & creators", "Basic profile"],
  },
  {
    name: "Bloom",
    price: "$10/mo",
    gradient: "linear-gradient(135deg, hsl(330, 65%, 72%), hsl(345, 55%, 48%))",
    icon: Flower2,
    features: ["15 Boards", "4 hr Drop Rooms", "5% off studio bookings", "Marketplace access"],
  },
  {
    name: "Glow",
    price: "$20/mo",
    gradient: "linear-gradient(135deg, hsl(30, 90%, 60%), hsl(20, 80%, 42%))",
    icon: Sun,
    features: ["50 Boards", "12 hr Drop Rooms", "10% off studio bookings", "Priority booking"],
    popular: true,
  },
  {
    name: "Play",
    price: "$30/mo",
    gradient: "linear-gradient(135deg, hsl(50, 90%, 58%), hsl(38, 80%, 40%))",
    icon: Gamepad,
    features: ["Unlimited Boards", "Unlimited Drop Rooms", "15% off bookings", "Priority everything"],
  },
];

const EARN_ACTIONS = [
  { action: "Post to Flow", reward: "+2", icon: Flame },
  { action: "Receive a Like", reward: "+1", icon: Star },
  { action: "Leave a Review", reward: "+3", icon: MessageSquare },
  { action: "Milestone Approved", reward: "+10", icon: Award },
  { action: "Drop Room Post", reward: "+1", icon: Zap },
  { action: "7-Day Streak", reward: "+5", icon: TrendingUp },
];

const GuestCreditsPreview = () => (
  <div className="max-w-5xl mx-auto py-8 space-y-10">
    {/* Hero */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-4"
    >
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
        <Coins className="h-8 w-8 text-primary" />
      </div>
      <h1 className="font-display text-3xl md:text-4xl text-foreground">
        Creator Pass & $RHOZE
      </h1>
      <p className="text-muted-foreground font-body max-w-lg mx-auto leading-relaxed">
        Choose your tier, earn $RHOZE tokens through creative contribution, and unlock the full Rhozeland ecosystem.
      </p>
    </motion.div>

    {/* Tier cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {TIERS.map((tier, i) => (
        <motion.div
          key={tier.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.08 }}
          className={`relative rounded-xl border bg-card overflow-hidden ${tier.popular ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
        >
          {tier.popular && (
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-bl-lg font-body uppercase tracking-wider">
              Popular
            </div>
          )}
          <div className="h-2 w-full" style={{ background: tier.gradient }} />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <tier.icon className="h-5 w-5 text-foreground" />
              <span className="font-display text-lg text-foreground">{tier.name}</span>
            </div>
            <p className="font-display text-2xl text-foreground">{tier.price}</p>
            <ul className="space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      ))}
    </div>

    {/* How to Earn */}
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="space-y-4"
    >
      <h2 className="font-display text-xl text-foreground text-center">How You Earn $RHOZE</h2>
      <p className="text-xs text-muted-foreground text-center font-body max-w-md mx-auto">
        Every creative action earns tokens. Use them for bookings, marketplace purchases, or hold to unlock higher tiers.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {EARN_ACTIONS.map((a, i) => (
          <motion.div
            key={a.action}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.05 }}
            className="border border-border rounded-lg p-3 bg-card text-center"
          >
            <a.icon className="h-4 w-4 text-primary mx-auto mb-2" />
            <p className="text-[11px] text-foreground font-body font-medium mb-1">{a.action}</p>
            <p className="text-xs font-display text-primary">{a.reward} ◊</p>
          </motion.div>
        ))}
      </div>
    </motion.div>

    {/* Revenue split */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="border border-border rounded-lg p-6 bg-card text-center space-y-3"
    >
      <h3 className="font-display text-lg text-foreground">75 / 15 / 10 Revenue Split</h3>
      <p className="text-xs text-muted-foreground font-body max-w-md mx-auto leading-relaxed">
        Creators keep <strong className="text-foreground">75%</strong> of every sale. <strong className="text-foreground">15%</strong> goes to platform development. <strong className="text-foreground">10%</strong> fuels the $RHOZE buyback, giving tokens real value.
      </p>
    </motion.div>

    {/* CTA */}
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="text-center"
    >
      <Link to="/auth">
        <Button className="gap-2">
          Get Your Creator Pass <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </motion.div>
  </div>
);

export default GuestCreditsPreview;
