/**
 * DailyDropModal — daily habit intercept overlay.
 *
 * Premium-feeling modal that drops in once per day to nudge the creator
 * back into a posting habit. Glassmorphic backdrop, centered card on
 * desktop, bottom-sheet on mobile.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Eye, Users, Coins, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DailyDropMomentum {
  views: number;
  newBackers: number;
  coinChangePct: number;
}

export interface DailyDropEcosystem {
  handle: string;
  changePct: number;
}

interface DailyDropModalProps {
  open: boolean;
  onClose: () => void;
  onAction: () => void;
  momentum: DailyDropMomentum;
  coachMessage: string;
  ecosystem: DailyDropEcosystem;
  currentStreak: number;
}

const formatDate = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

export const DailyDropModal = ({
  open,
  onClose,
  onAction,
  momentum,
  coachMessage,
  ecosystem,
  currentStreak,
}: DailyDropModalProps) => {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/40 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            initial={isMobile ? { y: 80, opacity: 0 } : { y: 20, opacity: 0, scale: 0.96 }}
            animate={isMobile ? { y: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={isMobile ? { y: 80, opacity: 0 } : { y: 20, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="relative w-full sm:max-w-md sm:mx-4 bg-card text-card-foreground border border-border/60 shadow-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden"
          >
            {/* Dismiss */}
            <button
              onClick={onClose}
              aria-label="Dismiss"
              className="absolute top-3 right-3 z-10 h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Accent stripe */}
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
              }}
            />

            <div className="p-6 sm:p-7 space-y-6">
              {/* Header */}
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.25em] font-bold mb-1"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, hsl(330 81% 60%), hsl(292 84% 61%), hsl(38 92% 50%))",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Your Daily Drop
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {formatDate()}
                  <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                    <Flame className="h-3 w-3" /> {currentStreak} day streak
                  </span>
                </p>
              </div>

              {/* Section 1 — Momentum */}
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs">
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{momentum.views}</span>
                  <span className="text-muted-foreground hidden sm:inline">views</span>
                </span>
                <span className="h-3 w-px bg-border" />
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{momentum.newBackers}</span>
                  <span className="text-muted-foreground hidden sm:inline">backers</span>
                </span>
                <span className="h-3 w-px bg-border" />
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                  <span
                    className={`font-semibold tabular-nums ${
                      momentum.coinChangePct >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {momentum.coinChangePct >= 0 ? "+" : ""}
                    {momentum.coinChangePct.toFixed(1)}%
                  </span>
                </span>
              </div>

              {/* Section 2 — The Coach */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">
                  Today's nudge
                </p>
                <p className="font-display text-lg sm:text-xl font-bold leading-snug text-foreground">
                  {coachMessage}
                </p>
              </div>

              {/* Section 3 — Ecosystem */}
              <p className="text-xs text-muted-foreground">
                🔥 <span className="font-medium text-foreground/80">{ecosystem.handle}</span>{" "}
                just spiked {ecosystem.changePct >= 0 ? "+" : ""}
                {ecosystem.changePct}% on the charts.
              </p>

              {/* Primary action */}
              <Button
                onClick={onAction}
                className="w-full h-12 rounded-full text-sm font-semibold gap-2"
              >
                Let's go <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * DailyDropContainer — convenience wrapper that owns the mock state.
 * Drop this anywhere to demo the intercept.
 */
export const DailyDropContainer = () => {
  const [showDailyDrop, setShowDailyDrop] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(2);

  const [momentum] = useState<DailyDropMomentum>({
    views: 124,
    newBackers: 3,
    coinChangePct: 4.2,
  });
  const [coachMessage] = useState(
    "You haven't posted a story update in 4 days — your backers are waiting.",
  );
  const [ecosystem] = useState<DailyDropEcosystem>({
    handle: "@J_Soul",
    changePct: 20,
  });

  const handleAction = () => {
    const next = currentStreak + 1;
    setCurrentStreak(next);
    setShowDailyDrop(false);
    toast.success(`Action completed! Streak increased to ${next} 🔥. You earned +10 $RHOZE.`);
  };

  return (
    <DailyDropModal
      open={showDailyDrop}
      onClose={() => setShowDailyDrop(false)}
      onAction={handleAction}
      momentum={momentum}
      coachMessage={coachMessage}
      ecosystem={ecosystem}
      currentStreak={currentStreak}
    />
  );
};

export default DailyDropModal;
