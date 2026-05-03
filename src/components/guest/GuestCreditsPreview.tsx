import { motion } from "framer-motion";
import { Coins, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import TierMatrix from "@/components/creators/TierMatrix";

/**
 * GuestCreditsPreview — shown to guests at /credits.
 * v8.3: tiers earned by holding $RHOZE only. Activity qualification removed.
 */
const GuestCreditsPreview = () => (
  <div className="max-w-5xl mx-auto py-8 space-y-8">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-4"
    >
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
        <Coins className="h-8 w-8 text-primary" />
      </div>
      <h1 className="font-display text-3xl md:text-4xl text-foreground">Creator Pass</h1>
      <p className="text-muted-foreground font-body max-w-lg mx-auto leading-relaxed">
        No subscriptions. Tiers unlock the moment you hold enough $RHOZE — earned, bought, or held.
      </p>
    </motion.div>

    <TierMatrix />

    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="text-center"
    >
      <Link to="/auth">
        <Button className="gap-2">
          Sign in to start earning <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </motion.div>
  </div>
);

export default GuestCreditsPreview;
