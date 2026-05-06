/**
 * WelcomeModal — first-login welcome overlay.
 * Shown once per user (localStorage flag), dismissible.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe2, Coins, Handshake, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const storageKey = (uid: string) => `rhozeland.welcome.seen.${uid}`;

const ROWS = [
  { Icon: Globe2, text: "Discover creators, events, and spaces worldwide." },
  { Icon: Coins, text: "Earn $RHOZE just by being active." },
  { Icon: Handshake, text: "Collaborate, hire, and get hired." },
];

const WelcomeModal = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const seen = window.localStorage.getItem(storageKey(user.id));
    if (seen) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const first =
        data?.display_name?.split(" ")[0] ??
        data?.username ??
        user.email?.split("@")[0] ??
        "there";
      setName(first);
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = () => {
    if (user) window.localStorage.setItem(storageKey(user.id), "1");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 backdrop-blur-xl px-6"
          aria-modal="true"
          role="dialog"
        >
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 50% 60% at 50% 0%, hsl(330 81% 60% / 0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 50% 100%, hsl(38 92% 50% / 0.14) 0%, transparent 60%)",
            }}
          />
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="relative w-full max-w-md rounded-3xl border border-border/60 bg-card/80 backdrop-blur-2xl p-8 sm:p-10 text-center shadow-2xl"
          >
            {/* Wordmark */}
            <p className="font-display text-2xl tracking-tight bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent mb-6">
              Rhozeland
            </p>

            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
              Welcome to Rhozeland, {name}.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The network for creators who show up.
            </p>

            <ul className="mt-7 space-y-3 text-left">
              {ROWS.map(({ Icon, text }, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3.5 py-2.5"
                >
                  <span className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  <span className="text-sm text-foreground/90 leading-snug">
                    {text}
                  </span>
                </motion.li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col items-center gap-2.5">
              <Button onClick={dismiss} size="lg" className="w-full gap-2">
                Let's go <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeModal;
