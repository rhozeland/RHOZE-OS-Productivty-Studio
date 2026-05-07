/**
 * WelcomeModal — first-login welcome popup.
 * Shown once per user on the Discover page (localStorage flag), dismissible.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe2, Coins, Handshake, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const storageKey = (uid: string) => `rhozeland.welcome.seen.${uid}`;

const ROWS = [
  { Icon: Globe2, text: "Discover creators, events, and spaces worldwide." },
  { Icon: Coins, text: "Earn $RHOZE just by being active." },
  { Icon: Handshake, text: "Collaborate, hire, and get hired." },
];

const WelcomeModal = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    // Only show on the Discover page
    if (!location.pathname.startsWith("/discover")) return;
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
  }, [user, location.pathname]);

  const dismiss = () => {
    if (user) window.localStorage.setItem(storageKey(user.id), "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/60 bg-card/90 backdrop-blur-2xl">
        <div className="relative p-7 sm:p-8 text-center">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(330 81% 60% / 0.18) 0%, transparent 60%)",
            }}
          />
          <div className="relative">
            <p className="font-display text-xl tracking-tight bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent mb-4">
              Rhozeland
            </p>

            <DialogHeader className="space-y-1.5">
              <DialogTitle className="font-display text-2xl font-semibold leading-tight text-center">
                Welcome to Rhozeland, {name}.
              </DialogTitle>
              <DialogDescription className="text-center text-sm">
                The network for creators who show up.
              </DialogDescription>
            </DialogHeader>

            <ul className="mt-6 space-y-2.5 text-left">
              {ROWS.map(({ Icon, text }, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.06 }}
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

            <div className="mt-7 flex flex-col items-center gap-2">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
