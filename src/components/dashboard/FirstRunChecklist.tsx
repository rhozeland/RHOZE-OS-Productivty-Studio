/**
 * FirstRunChecklist — slim onboarding card for new users.
 *
 * Renders at the top of the Dashboard *only* when the user looks new:
 * missing avatar/bio, no flow posts, etc. Auto-hides once everything
 * is checked off, or when the user explicitly dismisses it.
 *
 * v6 framing: the checklist's job is to get someone discoverable +
 * supportable as fast as possible. It surfaces the 4 actions that
 * matter for the discovery + support network — NOT every feature.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Check, ArrowRight, X, User, Flame, Compass, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "rhozeland.firstrun.dismissed";

interface ChecklistItem {
  id: string;
  done: boolean;
  label: string;
  helper: string;
  href: string;
  icon: typeof User;
}

const FirstRunChecklist = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });

  // Profile completeness
  const { data: profile } = useQuery({
    queryKey: ["firstrun-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, bio, display_name, wallet_address")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Has the user posted to Flow yet?
  const { data: flowCount } = useQuery({
    queryKey: ["firstrun-flow-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("flow_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Has the user reacted to anything? (proxy for "engaged with the network")
  const { data: interactionCount } = useQuery({
    queryKey: ["firstrun-interaction-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("flow_interactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const items = useMemo<ChecklistItem[]>(() => {
    const hasProfile = !!(profile?.avatar_url && profile?.bio);
    return [
      {
        id: "profile",
        done: hasProfile,
        label: "Complete your profile",
        helper: "Add an avatar and a one-line bio so people know it's you.",
        href: "/settings",
        icon: User,
      },
      {
        id: "post",
        done: (flowCount ?? 0) > 0,
        label: "Share something",
        helper: "Post a track, image, or work-in-progress to the Flow feed.",
        href: "/flow",
        icon: Flame,
      },
      {
        id: "explore",
        done: (interactionCount ?? 0) > 0,
        label: "Find your people",
        helper: "React to a piece of work in Discover — start your circle.",
        href: "/discover",
        icon: Compass,
      },
      {
        id: "wallet",
        done: !!profile?.wallet_address,
        label: "Connect a wallet (optional)",
        helper: "Unlocks Verified IP, on-chain support, and $RHOZE claims.",
        href: "/settings",
        icon: Wallet,
      },
    ];
  }, [profile, flowCount, interactionCount]);

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = completed === total;

  // Hide if dismissed, all done, or user already looks established
  // (has avatar + bio + at least one post — the "no checklist needed" bar).
  if (!user) return null;
  if (dismissed || allDone) return null;
  if (
    profile?.avatar_url &&
    profile?.bio &&
    (flowCount ?? 0) > 0
  ) {
    return null;
  }

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-5 sm:p-6 overflow-hidden"
        aria-label="First-run checklist"
      >
        {/* Aurora accent */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 100% 0%, hsl(330 81% 60% / 0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 0% 100%, hsl(38 92% 50% / 0.10) 0%, transparent 60%)",
          }}
        />

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss checklist"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="relative">
          {/* Header */}
          <div className="mb-4">
            <p className="text-[10px] font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-1.5">
              Get started · {completed} of {total}
            </p>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground leading-tight">
              Four small steps to get discovered.
            </h2>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full rounded-full bg-muted/60 overflow-hidden mb-5">
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${(completed / total) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>

          {/* Steps */}
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                      item.done
                        ? "border-border/40 bg-muted/30 opacity-70"
                        : "border-border/60 bg-background/40 hover:border-primary/40 hover:bg-card"
                    }`}
                  >
                    {/* Status circle */}
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                        item.done
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background"
                      }`}
                      aria-hidden
                    >
                      {item.done ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : (
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </span>

                    {/* Copy */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium leading-tight ${
                          item.done
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {item.label}
                      </p>
                      {!item.done && (
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                          {item.helper}
                        </p>
                      )}
                    </div>

                    {!item.done && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>Skip any step — you can always come back.</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleDismiss}
            >
              Hide for now
            </Button>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
};

export default FirstRunChecklist;
