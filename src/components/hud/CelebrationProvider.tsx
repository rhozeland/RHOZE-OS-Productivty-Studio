import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Flame, Sparkles, Trophy, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playSwipeSound } from "@/lib/swipe-sound";
import { cn } from "@/lib/utils";

type CelebrationKind = "xp" | "rhoze" | "level" | "streak" | "milestone";

interface CelebrationEvent {
  id: string;
  kind: CelebrationKind;
  amount?: number;
  title: string;
  subtitle?: string;
}

interface CelebrationContextValue {
  celebrate: (e: Omit<CelebrationEvent, "id">) => void;
  effectsEnabled: boolean;
  setEffectsEnabled: (v: boolean) => void;
}

const STORAGE_KEY = "rhozeland.hudEffects";

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

export const useCelebration = () => {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error("useCelebration must be used inside CelebrationProvider");
  return ctx;
};

const fireConfetti = (kind: CelebrationKind) => {
  const palette: Record<CelebrationKind, string[]> = {
    xp: ["#fbbf24", "#f59e0b", "#fde68a"],
    rhoze: ["#ec4899", "#f472b6", "#fbcfe8"],
    level: ["#a78bfa", "#7c3aed", "#fbbf24", "#10b981"],
    streak: ["#f97316", "#fb923c", "#fbbf24"],
    milestone: ["#34d399", "#10b981", "#a7f3d0"],
  };
  const colors = palette[kind];
  if (kind === "level") {
    confetti({
      particleCount: 140,
      spread: 80,
      startVelocity: 45,
      origin: { y: 0.7 },
      colors,
    });
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors });
      confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors });
    }, 200);
  } else {
    confetti({
      particleCount: 40,
      spread: 50,
      startVelocity: 30,
      origin: { y: 0.85 },
      colors,
      scalar: 0.7,
    });
  }
};

const ICONS: Record<CelebrationKind, typeof Sparkles> = {
  xp: Sparkles,
  rhoze: Coins,
  level: Trophy,
  streak: Flame,
  milestone: Sparkles,
};

export const CelebrationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CelebrationEvent[]>([]);
  const [effectsEnabled, setEffectsEnabledState] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === "true";
  });

  const setEffectsEnabled = useCallback((v: boolean) => {
    setEffectsEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {}
  }, []);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const celebrate = useCallback(
    (e: Omit<CelebrationEvent, "id">) => {
      if (!effectsEnabled) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setEvents((prev) => [...prev, { ...e, id }]);
      if (!reducedMotion) {
        fireConfetti(e.kind);
        playSwipeSound(e.kind === "level" ? "up" : "right");
      }
      // Auto-clear
      setTimeout(() => {
        setEvents((prev) => prev.filter((x) => x.id !== id));
      }, e.kind === "level" ? 4000 : 2600);
    },
    [effectsEnabled, reducedMotion],
  );

  // Listen for reward events — credit_transactions inserts mean $RHOZE landed,
  // pending_rewards inserts mean XP/action was queued for approval.
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`celebrations-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row?.type === "reward" && row?.amount > 0) {
            celebrate({
              kind: "rhoze",
              amount: row.amount,
              title: `+${row.amount} $RHOZE`,
              subtitle: row.description ?? "Reward earned",
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pending_rewards",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          const xp = 2; // each reward action = 2 XP per useCreatorXP model
          celebrate({
            kind: row.action_type === "daily_streak" ? "streak" : "xp",
            amount: xp,
            title:
              row.action_type === "daily_streak"
                ? "Streak extended!"
                : `+${xp} XP`,
            subtitle: row.description ?? row.action_type,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, celebrate]);

  return (
    <CelebrationContext.Provider value={{ celebrate, effectsEnabled, setEffectsEnabled }}>
      {children}
      {/* Toast stack — top-right, above HUD */}
      <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {events
            .filter((e) => e.kind !== "level")
            .slice(-3)
            .map((e) => {
              const Icon = ICONS[e.kind];
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: 40, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  className={cn(
                    "pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full",
                    "bg-card/90 backdrop-blur-xl border border-border shadow-lg shadow-foreground/10",
                  )}
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{
                      background:
                        e.kind === "rhoze"
                          ? "hsl(var(--pink) / 0.18)"
                          : e.kind === "streak"
                            ? "hsl(var(--orange) / 0.18)"
                            : "hsl(var(--warm) / 0.18)",
                    }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{
                        color:
                          e.kind === "rhoze"
                            ? "hsl(var(--pink))"
                            : e.kind === "streak"
                              ? "hsl(var(--orange))"
                              : "hsl(var(--warm))",
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground font-body leading-tight">
                      {e.title}
                    </p>
                    {e.subtitle && (
                      <p className="text-[11px] text-muted-foreground font-body truncate max-w-[200px]">
                        {e.subtitle}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Level up — full-screen banner */}
      <AnimatePresence>
        {events
          .filter((e) => e.kind === "level")
          .slice(-1)
          .map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none bg-foreground/30 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.7, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 20 }}
                className="px-10 py-8 rounded-2xl bg-card border border-border shadow-2xl text-center"
              >
                <Trophy className="h-12 w-12 mx-auto mb-3 text-warm" />
                <p className="text-xs font-body font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Level Up
                </p>
                <h3 className="text-3xl font-display mt-2">{e.title}</h3>
                {e.subtitle && (
                  <p className="text-sm text-muted-foreground font-body mt-2">
                    {e.subtitle}
                  </p>
                )}
              </motion.div>
            </motion.div>
          ))}
      </AnimatePresence>
    </CelebrationContext.Provider>
  );
};
