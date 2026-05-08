/**
 * NextStepCard — surfaces a single prioritized "next step" for empty
 * Creator Pass users (0 verified works, 0 events, 0 streak days).
 *
 * Cycles through 3 actions, advancing past any already-complete step.
 * Auto-hides once all three are done OR the user dismisses it.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronRight, Flame, Shield, Ticket, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "rhozeland.nextstep.dismissed";

type Step = {
  id: "work" | "streak" | "event";
  done: boolean;
  icon: typeof Shield;
  label: string;
  cta: string;
  href: string;
};

const NextStepCard = () => {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(0);
  const [dismissed, setDismissed] = useState<boolean>(() =>
    typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1",
  );

  const { data: workCount } = useQuery({
    queryKey: ["nextstep-works", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  const { data: ticketCount } = useQuery({
    queryKey: ["nextstep-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("event_tickets")
        .select("id", { count: "exact", head: true })
        .eq("holder_id", user!.id);
      return count ?? 0;
    },
  });

  const { data: streak } = useQuery({
    queryKey: ["nextstep-streak", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("reward_streak")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.reward_streak ?? 0;
    },
  });

  const steps = useMemo<Step[]>(
    () => [
      {
        id: "work",
        done: (workCount ?? 0) > 0,
        icon: Shield,
        label: "Post your first work — earn 10 $RHOZE.",
        cta: "Post Work",
        href: "/works",
      },
      {
        id: "streak",
        done: (streak ?? 0) > 0,
        icon: Flame,
        label: "Start a streak — sign in & interact daily. 7 days = 5 $RHOZE.",
        cta: "Go to Discover",
        href: "/discover",
      },
      {
        id: "event",
        done: (ticketCount ?? 0) > 0,
        icon: Ticket,
        label: "Attend an event — earn $RHOZE and get verified.",
        cta: "Browse Events",
        href: "/events",
      },
    ],
    [workCount, ticketCount, streak],
  );

  const allEmpty =
    (workCount ?? 0) === 0 && (ticketCount ?? 0) === 0 && (streak ?? 0) === 0;
  const allDone = steps.every((s) => s.done);

  if (!user || dismissed || !allEmpty || allDone) return null;

  // Snap cursor onto next not-done step.
  const total = steps.length;
  let activeIdx = cursor % total;
  for (let i = 0; i < total; i++) {
    if (!steps[(activeIdx + i) % total].done) {
      activeIdx = (activeIdx + i) % total;
      break;
    }
  }
  const active = steps[activeIdx];
  const Icon = active.icon;

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const handleNext = () => setCursor((c) => (c + 1) % total);

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={active.id}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="relative rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-md overflow-hidden"
        aria-label="Your next step"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 100% at 0% 0%, hsl(var(--primary) / 0.10) 0%, transparent 60%)",
          }}
        />
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 z-10 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="relative px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-0.5 inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Your next step
              </p>
              <p className="text-sm sm:text-[15px] font-medium text-foreground leading-snug">
                {active.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:shrink-0">
            <Link to={active.href}>
              <Button size="sm" className="rounded-full gap-1.5">
                {active.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <button
              onClick={handleNext}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              aria-label="Show next step"
            >
              Skip <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Step indicator dots */}
        <div className="relative flex items-center justify-center gap-1.5 pb-3">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1 rounded-full transition-all",
                i === activeIdx
                  ? "w-6 bg-primary"
                  : s.done
                  ? "w-1.5 bg-primary/40"
                  : "w-1.5 bg-muted-foreground/30",
              )}
              aria-hidden
            />
          ))}
        </div>
      </motion.section>
    </AnimatePresence>
  );
};

export default NextStepCard;
