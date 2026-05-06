/**
 * GettingStartedBanner — Creator Pass onboarding checklist.
 *
 * 5 steps:
 *   1. Join Rhozeland (auto)
 *   2. Drop your first work
 *   3. Attend an event
 *   4. Connect with 3 creators
 *   5. Reach a 7-day streak
 *
 * Auto-hides once all steps done (or user dismisses). Fires confetti +
 * toast the moment the final step flips to done.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Check, ChevronDown, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "rhozeland.gettingstarted.dismissed";
const CELEBRATED_KEY = "rhozeland.gettingstarted.celebrated";

interface Step {
  id: string;
  done: boolean;
  label: string;
  href: string;
}

const fireCompletionConfetti = () => {
  const colors = ["#ec4899", "#a78bfa", "#fbbf24", "#34d399", "#60a5fa"];
  confetti({ particleCount: 140, spread: 90, startVelocity: 45, origin: { y: 0.7 }, colors });
  setTimeout(() => {
    confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors });
    confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors });
  }, 220);
};

const GettingStartedBanner = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<boolean>(() =>
    typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1",
  );
  const [expanded, setExpanded] = useState(true);

  // First work uploaded?
  const { data: workCount } = useQuery({
    queryKey: ["gs-works", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  // Attended an event? (event_tickets row)
  const { data: ticketCount } = useQuery({
    queryKey: ["gs-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("event_tickets")
        .select("id", { count: "exact", head: true })
        .eq("holder_id", user!.id);
      return count ?? 0;
    },
  });

  // 3+ buddy connections
  const { data: buddyCount } = useQuery({
    queryKey: ["gs-buddies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const res = await (supabase as any).rpc("list_my_buddies");
      return Array.isArray(res?.data) ? res.data.length : 0;
    },
  });

  // 7-day streak
  const { data: streak } = useQuery({
    queryKey: ["gs-streak", user?.id],
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
      { id: "join", done: true, label: "Join Rhozeland", href: "/discover" },
      { id: "drop", done: (workCount ?? 0) > 0, label: "Drop your first work", href: "/works" },
      { id: "event", done: (ticketCount ?? 0) > 0, label: "Attend an event", href: "/events" },
      { id: "connect", done: (buddyCount ?? 0) >= 3, label: "Connect with 3 creators", href: "/discover" },
      { id: "streak", done: (streak ?? 0) >= 7, label: "Reach a 7-day streak", href: "/credits" },
    ],
    [workCount, ticketCount, buddyCount, streak],
  );

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;

  // Fire celebration once when fully complete
  useEffect(() => {
    if (!user || !allDone) return;
    const key = `${CELEBRATED_KEY}.${user.id}`;
    if (window.localStorage.getItem(key) === "1") return;
    window.localStorage.setItem(key, "1");
    fireCompletionConfetti();
    toast.success("You're all set on Rhozeland 🎉", {
      description: "Every checklist item complete.",
    });
  }, [allDone, user]);

  if (!user || dismissed || allDone) return null;

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md overflow-hidden"
      aria-label="Getting started checklist"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 100% 0%, hsl(330 81% 60% / 0.10) 0%, transparent 60%)",
        }}
      />
      <div className="relative">
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-[0.2em]">
              Get started
            </span>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {completed}/{total} complete
            </span>
            <div className="hidden sm:block h-1 w-32 rounded-full bg-muted/60 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500"
                initial={false}
                animate={{ width: `${(completed / total) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  handleDismiss();
                }
              }}
              className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="steps"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <ul className="px-3 sm:px-4 pb-4 space-y-1.5">
                {steps.map((step, i) => (
                  <li key={step.id}>
                    <Link
                      to={step.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                        step.done
                          ? "border-border/40 bg-muted/30 opacity-70"
                          : "border-border/60 bg-background/40 hover:border-primary/40 hover:bg-card",
                      )}
                    >
                      <motion.span
                        initial={false}
                        animate={
                          step.done
                            ? { scale: [1, 1.25, 1], backgroundColor: "hsl(var(--primary))" }
                            : { scale: 1 }
                        }
                        transition={{ duration: 0.4 }}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          step.done
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {step.done ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : (
                          <span className="text-[11px] tabular-nums">{i + 1}</span>
                        )}
                      </motion.span>
                      <p
                        className={cn(
                          "flex-1 text-sm font-medium leading-tight",
                          step.done ? "text-muted-foreground line-through" : "text-foreground",
                        )}
                      >
                        {step.label}
                      </p>
                      {!step.done && (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
};

export default GettingStartedBanner;
