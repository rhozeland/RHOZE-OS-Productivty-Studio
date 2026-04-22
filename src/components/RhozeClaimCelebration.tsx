import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Coins } from "lucide-react";
import confetti from "canvas-confetti";

interface RhozeClaimCelebrationProps {
  open: boolean;
  amount: number;
  signature?: string;
  onClose: () => void;
}

const fireConfetti = () => {
  const duration = 2200;
  const end = Date.now() + duration;
  const colors = ["#f59e0b", "#fbbf24", "#fde68a", "#ec4899", "#a855f7"];

  // Initial big burst
  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.6 },
    colors,
    scalar: 1.1,
    ticks: 200,
  });

  // Side cannons
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

const RhozeClaimCelebration = ({ open, amount, signature, onClose }: RhozeClaimCelebrationProps) => {
  const [tickedAmount, setTickedAmount] = useState(0);

  useEffect(() => {
    if (!open) {
      setTickedAmount(0);
      return;
    }

    fireConfetti();

    // Count-up animation
    const start = performance.now();
    const duration = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setTickedAmount(Math.round(eased * amount));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Auto-close
    const timer = setTimeout(onClose, 4200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [open, amount, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="rhoze-celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Aurora glow */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-amber-300/40 via-pink-400/30 to-purple-500/30 blur-3xl" />
          </motion.div>

          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-8 text-center overflow-hidden shadow-2xl"
          >
            {/* Sparkles drift */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20, x: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  y: [-10, -60, -100],
                  x: [(i - 2.5) * 12, (i - 2.5) * 24],
                }}
                transition={{
                  duration: 2,
                  delay: 0.2 + i * 0.15,
                  repeat: Infinity,
                  repeatDelay: 0.6,
                }}
                className="absolute top-1/2 left-1/2 pointer-events-none"
              >
                <Sparkles className="h-3 w-3 text-amber-400" />
              </motion.div>
            ))}

            {/* Coin */}
            <motion.div
              initial={{ rotateY: 0, scale: 0.6 }}
              animate={{ rotateY: 720, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="relative h-24 w-24 mx-auto mb-5"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 shadow-[0_0_40px_hsl(38_90%_55%/0.6)] flex items-center justify-center">
                <Coins className="h-12 w-12 text-amber-900" strokeWidth={2.5} />
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xs font-body uppercase tracking-[0.2em] text-muted-foreground mb-2"
            >
              Reward Claimed
            </motion.p>

            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="font-display text-5xl text-foreground mb-1 tabular-nums"
            >
              +{tickedAmount.toLocaleString()}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="font-display text-lg bg-gradient-to-r from-amber-500 via-pink-500 to-purple-500 bg-clip-text text-transparent mb-4"
            >
              $RHOZE
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-sm text-muted-foreground font-body leading-relaxed"
            >
              Tokens are on their way to your wallet.
            </motion.p>

            {signature && (
              <motion.a
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                href={`https://solscan.io/tx/${signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-xs font-mono text-primary hover:underline"
              >
                View on Solscan →
              </motion.a>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RhozeClaimCelebration;
